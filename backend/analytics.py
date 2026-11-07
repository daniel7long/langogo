"""Learning analytics: time spent, lessons finished, scores and retries.

What is saved (inside each learner's state, see store.py):
  * state["usage"]["days"][YYYY-MM-DD] = {"sec": seconds in the app, "sessions": n, "by_lang": {"fr": seconds}}
    The app sends a short "I'm here" ping every 30 seconds while it is open and in front (POST /me/ping).
  * every finished lesson is a record (state["records"]) with its time ("at"), scores and the practice words
    ("first_score" is the score of the word right after the lesson, "score" the latest one).
  * state["retry_log"]: one row per retry take: when, which word, the score before and after.

Days and weeks follow the time zone in LANGOGO_TZ (default America/New_York). Weeks start on Monday.
Everything here is read-only except add_time / log_retry.
"""
import os
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import content
import languages

LOW_SCORE = 70       # a practice word below this counts as a "low score"
MAX_PING = 90        # seconds one ping may add (a phone left open can't inflate the time)
KEEP_RETRIES = 2000


def tz():
    try:
        return ZoneInfo(os.getenv("LANGOGO_TZ", "America/New_York"))
    except Exception:  # noqa: BLE001
        return timezone.utc


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def to_local(iso):
    try:
        return datetime.fromisoformat(iso).astimezone(tz())
    except (TypeError, ValueError):
        return None


def today():
    return datetime.now(tz()).date()


def week_start(d):
    return d - timedelta(days=d.weekday())


# ---- Writing ---------------------------------------------------------------------------------------
def add_time(state, lang, seconds, new_session=False):
    seconds = max(0, min(int(seconds), MAX_PING))
    days = state.setdefault("usage", {}).setdefault("days", {})
    day = days.setdefault(today().isoformat(), {"sec": 0, "sessions": 0, "by_lang": {}})
    day["sec"] += seconds
    day["by_lang"][lang] = day["by_lang"].get(lang, 0) + seconds
    if new_session:
        day["sessions"] += 1
    state["usage"]["last_seen"] = now_iso()
    return day


def log_retry(state, record, word, previous, score, number):
    log = state.setdefault("retry_log", [])
    log.append({"at": now_iso(), "lang": record.get("lang"), "lesson_id": record.get("lesson_id"),
                "record_id": record.get("id"), "word_id": word.get("id"), "text": word.get("text"),
                "previous": previous, "score": score, "n": number})
    del log[:-KEEP_RETRIES]


# ---- Reading ---------------------------------------------------------------------------------------
def _lang_name(lang):
    try:
        return languages.get(lang)["name"]
    except Exception:  # noqa: BLE001
        return lang


def _record_no(r):
    try:
        return int(str(r.get("id", "r0"))[1:])
    except ValueError:
        return 0


def progress(state):
    """Per language the learner picked: level, current lesson and how many lessons are done."""
    out = []
    langs = list(state.get("levels", {}).keys())
    cur = state.get("user", {}).get("language")
    if cur and cur not in langs:
        langs.append(cur)
    done = set(state.get("completed", []))
    for lang in langs:
        try:
            lv_map = content.levels(lang)
        except Exception:  # noqa: BLE001
            lv_map = {}
        level = state.get("levels", {}).get(lang, 1)
        lessons = lv_map.get(level, {}).get("lessons", [])
        nxt = next(((lid, title) for lid, title in lessons if lid not in done), None)
        total = sum(len(v["lessons"]) for v in lv_map.values())
        finished = sum(1 for lid in done if lid.startswith(f"{lang}-"))
        out.append({"lang": lang, "language": _lang_name(lang), "level": level,
                    "lesson": (nxt[0].split("-")[-1] if nxt else "all done"),
                    "lesson_title": nxt[1] if nxt else "", "finished": finished, "total": total,
                    "current": lang == cur})
    return out


def lesson_rows(state):
    """Every finished lesson, oldest first, with its attempt number for that lesson."""
    recs = sorted(state.get("records", []), key=lambda r: (r.get("at") or "", _record_no(r)))
    count, rows = {}, []
    for r in recs:
        n = count[r["lesson_id"]] = count.get(r["lesson_id"], 0) + 1
        local = to_local(r.get("at"))
        rows.append({"at": local.strftime("%Y-%m-%d %H:%M") if local else "", "day": local.date().isoformat() if local else "",
                     "lang": r.get("lang", "fr"), "lesson_id": r["lesson_id"], "title": r.get("title", ""),
                     "attempt": n, "grade": r.get("grade", ""), "fluency": r.get("fluency"),
                     "pronunciation": r.get("pronunciation"), "completeness": r.get("completeness"),
                     "flowers": r.get("flowers_earned", 0)})
    return rows


def retry_rows(state):
    """Practice words of every lesson: first score, latest score, number of retries and improvement."""
    log = state.get("retry_log", [])
    counts = state.get("retries", {})
    rows = []
    for r in sorted(state.get("records", []), key=lambda r: (r.get("at") or "", _record_no(r))):
        local = to_local(r.get("at"))
        for w in r.get("words", []):
            key = f"{r['id']}:{w.get('id')}"
            takes = [e for e in log if e.get("record_id") == r["id"] and e.get("word_id") == w.get("id")]
            first = w.get("first_score")
            if first is None:
                first = takes[0]["previous"] if takes and takes[0].get("previous") is not None else w.get("score")
            latest = w.get("score")
            n = max(counts.get(key, 0), len(takes))
            low = first is not None and first < LOW_SCORE
            if n == 0:
                status = "not retried" if low else "ok"
            else:
                status = "improved" if latest is not None and first is not None and latest > first else "not improved"
                if latest is not None and latest < LOW_SCORE:
                    status += ", still low"
            rows.append({"at": local.strftime("%Y-%m-%d %H:%M") if local else "", "lang": r.get("lang", "fr"),
                         "lesson_id": r["lesson_id"], "title": r.get("title", ""), "word": w.get("text", ""),
                         "kind": w.get("kind", "word"), "first": first, "latest": latest, "retries": n,
                         "change": (latest - first) if (latest is not None and first is not None) else None,
                         "low": low, "status": status})
    return rows


def daily_rows(state, days=30):
    usage = state.get("usage", {}).get("days", {})
    lessons = {}
    for r in lesson_rows(state):
        if r["day"]:
            lessons[r["day"]] = lessons.get(r["day"], 0) + 1
    keys = sorted(set(usage) | set(lessons), reverse=True)[:days]
    return [{"day": d, "minutes": round(usage.get(d, {}).get("sec", 0) / 60, 1),
             "sessions": usage.get(d, {}).get("sessions", 0), "lessons": lessons.get(d, 0),
             "by_lang": usage.get(d, {}).get("by_lang", {})} for d in keys]


def weekly_rows(state):
    weeks = {}
    for d in daily_rows(state, days=3650):
        ws = week_start(date.fromisoformat(d["day"])).isoformat()
        w = weeks.setdefault(ws, {"week": ws, "minutes": 0.0, "sessions": 0, "lessons": 0, "days_active": 0})
        w["minutes"] = round(w["minutes"] + d["minutes"], 1)
        w["sessions"] += d["sessions"]
        w["lessons"] += d["lessons"]
        w["days_active"] += 1 if (d["minutes"] or d["lessons"]) else 0
    return sorted(weeks.values(), key=lambda w: w["week"], reverse=True)


def summary(state):
    """One line per learner for the overview table."""
    t = today()
    days = daily_rows(state, days=3650)
    ws = week_start(t).isoformat()
    td = next((d for d in days if d["day"] == t.isoformat()), None)
    week = [d for d in days if d["day"] >= ws]
    lessons = lesson_rows(state)
    scores = [r["pronunciation"] for r in lessons if r["pronunciation"] is not None]
    retries = retry_rows(state)
    return {
        "minutes_today": td["minutes"] if td else 0, "minutes_week": round(sum(d["minutes"] for d in week), 1),
        "minutes_total": round(sum(d["minutes"] for d in days), 1),
        "lessons_today": td["lessons"] if td else 0, "lessons_week": sum(d["lessons"] for d in week),
        "lessons_total": len(lessons), "avg_pronunciation": round(sum(scores) / len(scores)) if scores else "",
        "retries_total": sum(r["retries"] for r in retries), "low_words": sum(1 for r in retries if r["low"]),
        "last_seen": (to_local(state.get("usage", {}).get("last_seen")) or datetime.min.replace(tzinfo=tz())).strftime("%Y-%m-%d %H:%M")
        if state.get("usage", {}).get("last_seen") else "",
    }
