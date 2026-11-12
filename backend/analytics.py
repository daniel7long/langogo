"""Learning analytics: time spent, lessons finished, scores and retries.

What is saved (inside each learner's state, see store.py):
  * state["usage"]["days"][YYYY-MM-DD] = {"sec": seconds in the app, "sessions": n, "by_lang": {"fr": seconds}}
    The app sends a short "I'm here" ping every 30 seconds while it is open and in front (POST /me/ping).
  * every finished lesson is a record (state["records"]) with its time ("at"), scores and the practice words
    ("first_score" is the score of the word right after the lesson, "score" the latest one).
  * state["retry_log"]: one row per retry take: when, which word, the score before and after.
  * Free Talk: day["freetalk_sec"] is the part of the time spent in Free Talk (the app says so in its ping), and
    state["freetalk_log"] has one row per dialogue (finished or left early) with its scores. A finished dialogue is
    also a record (kind "freetalk"), so its words to practise and their retries are tracked like a lesson's.

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
KEEP_FREETALK = 500


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
def add_time(state, lang, seconds, new_session=False, area=None):
    seconds = max(0, min(int(seconds), MAX_PING))
    days = state.setdefault("usage", {}).setdefault("days", {})
    day = days.setdefault(today().isoformat(), {"sec": 0, "sessions": 0, "by_lang": {}})
    day["sec"] += seconds
    if area == "freetalk":
        day["freetalk_sec"] = day.get("freetalk_sec", 0) + seconds
    day["by_lang"][lang] = day["by_lang"].get(lang, 0) + seconds
    if new_session:
        day["sessions"] += 1
    state["usage"]["last_seen"] = now_iso()
    return day


def log_freetalk(state, row):
    log = state.setdefault("freetalk_log", [])
    log.append(row)
    del log[:-KEEP_FREETALK]


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
    recs = sorted((r for r in state.get("records", []) if r.get("kind") != "freetalk"),
                  key=lambda r: (r.get("at") or "", _record_no(r)))
    count, rows = {}, []
    for r in recs:
        n = count[r["lesson_id"]] = count.get(r["lesson_id"], 0) + 1
        local = to_local(r.get("at"))
        rows.append({"at": local.strftime("%Y-%m-%d %H:%M") if local else "", "day": local.date().isoformat() if local else "",
                     "lang": r.get("lang", "fr"), "lesson_id": r["lesson_id"], "title": r.get("title", ""),
                     "attempt": n, "part": "other speaker" if r.get("swapped") else "main", "grade": r.get("grade", ""), "fluency": r.get("fluency"),
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
                         "source": "Free Talk" if r.get("kind") == "freetalk" else "Lesson",
                         "lesson_id": r["lesson_id"], "title": r.get("title", ""), "word": w.get("text", ""),
                         "kind": w.get("kind", "word"), "first": first, "latest": latest, "retries": n,
                         "change": (latest - first) if (latest is not None and first is not None) else None,
                         "low": low, "status": status})
    return rows


def freetalk_rows(state):
    """Every Free Talk dialogue, oldest first: time, turns, ratings and how many words were retried afterwards."""
    takes = {}
    for e in state.get("retry_log", []):
        takes[e.get("record_id")] = takes.get(e.get("record_id"), 0) + 1
    rows = []
    for e in sorted(state.get("freetalk_log", []), key=lambda e: e.get("at") or ""):
        local = to_local(e.get("at"))
        rows.append({"at": local.strftime("%Y-%m-%d %H:%M") if local else "", "day": local.date().isoformat() if local else "",
                     "lang": e.get("lang", ""), "topic": e.get("topic", ""), "cefr": e.get("cefr", ""),
                     "status": "finished" if e.get("completed") else "left early",
                     "minutes": round((e.get("seconds") or 0) / 60, 1), "turns": e.get("turns", 0),
                     "hints_used": e.get("hints_used", 0), "grade": e.get("grade", ""),
                     "pronunciation": e.get("pronunciation"), "fluency": e.get("fluency"),
                     "completeness": e.get("completeness"), "flowers": e.get("flowers", 0),
                     "retry_takes": takes.get(e.get("record_id"), 0) if e.get("record_id") else 0})
    return rows


def flower_rows(state):
    """Every payment of flowers (what for, how many), oldest first."""
    rows = []
    for e in state.get("flower_log", []):
        local = to_local(e.get("at"))
        rows.append({"at": local.strftime("%Y-%m-%d %H:%M") if local else "", "day": local.date().isoformat() if local else "",
                     "reason": e.get("kind", ""), "flowers": e.get("amount", 0)})
    return rows


def redemption_rows(state):
    """Everything the learner spent flowers on (Gift Menu), oldest first. Impact gifts (tree, meal) are the ones to fulfil."""
    rows = []
    for e in state.get("spend_log", []):
        local = to_local(e.get("at"))
        impact = e.get("item_id", "").startswith("impact_")
        rows.append({"at": local.strftime("%Y-%m-%d %H:%M") if local else "", "gift": e.get("name", ""),
                     "type": "impact (to fulfil)" if impact else "style", "flowers": e.get("price", 0), "lang": e.get("lang", "")})
    return rows


def freetalk_minutes(state):
    """(today, this week, total) minutes spent in Free Talk, from the pings."""
    days = state.get("usage", {}).get("days", {})
    t = today()
    ws = week_start(t).isoformat()
    sec = lambda keys: sum(days[k].get("freetalk_sec", 0) for k in keys)
    return (round(sec([k for k in days if k == t.isoformat()]) / 60, 1),
            round(sec([k for k in days if k >= ws]) / 60, 1), round(sec(list(days)) / 60, 1))


def level_test_rows(state):
    """The finished level tests (the app keeps the latest 5 per learner), newest first."""
    rows = []
    for t in state.get("level_tests", {}).values():
        if t.get("stage") != "done":
            continue
        local = to_local(t.get("at"))
        rows.append({"at": local.strftime("%Y-%m-%d %H:%M") if local else "(before tracking)",
                     "type": ("match test" + (" (switched)" if t.get("applied") else " (stayed)")) if t.get("purpose") == "match" else "first test",
                     "score": t.get("score"), "level": t.get("level"), "questions_score": t.get("completion_score"),
                     "correct": f"{t.get('correct_count')}/{t.get('total_questions')}", "speaking_score": t.get("speech_score"),
                     "start_lesson": t.get("start_lesson_id"), "start_title": t.get("start_lesson_title")})
    return sorted(rows, key=lambda r: r["at"], reverse=True)


def daily_rows(state, days=30):
    usage = state.get("usage", {}).get("days", {})
    lessons = {}
    for r in lesson_rows(state):
        if r["day"]:
            lessons[r["day"]] = lessons.get(r["day"], 0) + 1
    freetalks = {}
    for r in freetalk_rows(state):
        if r["day"] and r["status"] == "finished":
            freetalks[r["day"]] = freetalks.get(r["day"], 0) + 1
    keys = sorted(set(usage) | set(lessons) | set(freetalks), reverse=True)[:days]
    return [{"day": d, "minutes": round(usage.get(d, {}).get("sec", 0) / 60, 1),
             "sessions": usage.get(d, {}).get("sessions", 0), "lessons": lessons.get(d, 0),
             "freetalk_minutes": round(usage.get(d, {}).get("freetalk_sec", 0) / 60, 1),
             "freetalks": freetalks.get(d, 0),
             "by_lang": usage.get(d, {}).get("by_lang", {})} for d in keys]


def weekly_rows(state):
    weeks = {}
    for d in daily_rows(state, days=3650):
        ws = week_start(date.fromisoformat(d["day"])).isoformat()
        w = weeks.setdefault(ws, {"week": ws, "minutes": 0.0, "sessions": 0, "lessons": 0, "days_active": 0,
                                                "freetalk_minutes": 0.0, "freetalks": 0})
        w["minutes"] = round(w["minutes"] + d["minutes"], 1)
        w["sessions"] += d["sessions"]
        w["lessons"] += d["lessons"]
        w["freetalk_minutes"] = round(w["freetalk_minutes"] + d["freetalk_minutes"], 1)
        w["freetalks"] += d["freetalks"]
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
    lt = level_test_rows(state)
    ft = freetalk_rows(state)
    ft_today, ft_week, ft_total = freetalk_minutes(state)
    ft_done = [r for r in ft if r["status"] == "finished"]
    ft_p = [r["pronunciation"] for r in ft_done if r["pronunciation"] is not None]
    spent = sum(r["flowers"] for r in redemption_rows(state))
    return {
        "flowers_spent": spent,
        "freetalk_min_today": ft_today, "freetalk_min_week": ft_week, "freetalk_min_total": ft_total,
        "freetalk_finished": len(ft_done), "freetalk_left_early": len(ft) - len(ft_done),
        "freetalk_avg_pronunciation": round(sum(ft_p) / len(ft_p)) if ft_p else "",
        "level_test": f"{lt[0]['score']} ({lt[0]['level']})" if lt else "",
        "minutes_today": td["minutes"] if td else 0, "minutes_week": round(sum(d["minutes"] for d in week), 1),
        "minutes_total": round(sum(d["minutes"] for d in days), 1),
        "lessons_today": td["lessons"] if td else 0, "lessons_week": sum(d["lessons"] for d in week),
        "lessons_total": len(lessons), "avg_pronunciation": round(sum(scores) / len(scores)) if scores else "",
        "retries_total": sum(r["retries"] for r in retries), "low_words": sum(1 for r in retries if r["low"]),
        "last_seen": (to_local(state.get("usage", {}).get("last_seen")) or datetime.min.replace(tzinfo=tz())).strftime("%Y-%m-%d %H:%M")
        if state.get("usage", {}).get("last_seen") else "",
    }
