"""Private learning dashboard:  https://<your-backend>/admin/dashboard?key=<LANGOGO_ADMIN_KEY>

  /admin/dashboard                      everyone: language, level + lesson, time and lessons today / this week
  /admin/dashboard/learner?id=...       one learner: progress per language, days, weeks, lesson scores, retries
  /admin/dashboard/export?kind=...      CSV: summary | daily | weekly | lessons | retries   (all learners)

Off unless LANGOGO_ADMIN_KEY is set. It never shows passwords, tokens or recordings.
"""
import csv
import io
from html import escape
from urllib.parse import quote

from fastapi import APIRouter
from fastapi.responses import HTMLResponse, Response

import analytics
import db
from routers.admin import _check

router = APIRouter(prefix="/admin/dashboard", tags=["admin"])

CSS = """body{font-family:system-ui,sans-serif;background:#FFFCF8;color:#1F1B16;margin:24px;max-width:1200px}
h1{margin:0 0 4px}h2{margin:28px 0 8px}.n{color:#6B6259;font-size:14px}.w{overflow-x:auto}
table{border-collapse:collapse;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(120,70,20,.08)}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #EADFD3;font-size:14px;white-space:nowrap}
th{background:#FFF1E4;color:#B84A08}a{color:#B84A08}a.b{display:inline-block;margin:4px 6px 4px 0;padding:6px 14px;border-radius:99px;background:#D95F0E;color:#fff;text-decoration:none;font-size:14px}
.low{color:#B3261E;font-weight:600}.good{color:#1E7B34;font-weight:600}.card{display:inline-block;background:#fff;border-radius:12px;padding:10px 16px;margin:0 8px 8px 0;box-shadow:0 2px 12px rgba(120,70,20,.08)}
.card b{display:block;font-size:22px}"""


def _page(title, body):
    return HTMLResponse(f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>{escape(title)}</title>
<style>{CSS}</style></head><body>{body}</body></html>""")


def _table(cols, rows, raw=()):
    head = "".join(f"<th>{escape(label)}</th>" for _, label in cols)
    body = ""
    for r in rows:
        tds = ""
        for k, _ in cols:
            v = r.get(k, "")
            v = "" if v is None else v
            tds += f"<td>{v if k in raw else escape(str(v))}</td>"
        body += f"<tr>{tds}</tr>"
    if not rows:
        body = f"<tr><td colspan={len(cols)} class=n>Nothing yet.</td></tr>"
    return f'<div class=w><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'


def _learners():
    out = []
    for uid, email, created, updated, state in db.all_states():
        user = state.get("user", {})
        out.append({"id": uid, "name": user.get("name") or "", "email": email or user.get("email") or "",
                    "joined": (created or "")[:10], "state": state})
    return out


def _tz_note():
    return f"Days and weeks use the {analytics.tz().key if hasattr(analytics.tz(), 'key') else 'UTC'} time zone; weeks start on Monday."


@router.get("")
def overview(key: str = ""):
    _check(key)
    k = quote(key)
    rows = []
    for L in _learners():
        s = analytics.summary(L["state"])
        prog = analytics.progress(L["state"])
        langs = "; ".join(f"{p['language']}: L{p['level']} lesson {p['lesson']}" + (" ★" if p["current"] else "") for p in prog) or "-"
        rows.append({**L, **s, "langs": langs,
                     "name_link": f'<a href="/admin/dashboard/learner?id={quote(L["id"])}&amp;key={k}">{escape(L["name"] or L["email"] or L["id"][:8])}</a>'})
    rows.sort(key=lambda r: r.get("last_seen") or "", reverse=True)
    cols = [("name_link", "Learner"), ("email", "Email"), ("langs", "Languages: level, current lesson (★ = now)"),
            ("minutes_today", "Min today"), ("minutes_week", "Min this week"), ("lessons_today", "Lessons today"),
            ("lessons_week", "Lessons this week"), ("lessons_total", "Lessons total"), ("level_test", "Level test (latest)"), ("avg_pronunciation", "Avg pronunciation"),
            ("retries_total", "Retries"), ("low_words", "Low-score words"), ("last_seen", "Last seen"), ("joined", "Joined")]
    exports = "".join(f'<a class=b href="/admin/dashboard/export?kind={x}&amp;key={k}">{x} CSV</a>'
                      for x in ("summary", "daily", "weekly", "lessons", "retries", "leveltests"))
    return _page("Langogo dashboard", f"""<h1>Langogo dashboard</h1>
<p class=n>{len(rows)} learners. Private: contains personal data. {escape(_tz_note())} Time in the app is counted while the app is open and in front.</p>
{exports}{_table(cols, rows, raw=("name_link",))}""")


@router.get("/learner")
def learner(id: str = "", key: str = ""):
    _check(key)
    k = quote(key)
    match = next((L for L in _learners() if L["id"] == id), None)
    if match is None:
        return _page("Not found", f'<p>No such learner. <a href="/admin/dashboard?key={k}">Back</a></p>')
    st = match["state"]
    s = analytics.summary(st)
    cards = "".join(f'<div class=card>{escape(lbl)}<b>{escape(str(v))}</b></div>' for lbl, v in [
        ("Minutes today", s["minutes_today"]), ("Minutes this week", s["minutes_week"]), ("Minutes total", s["minutes_total"]),
        ("Lessons today", s["lessons_today"]), ("Lessons this week", s["lessons_week"]), ("Lessons total", s["lessons_total"]),
        ("Retries", s["retries_total"]), ("Low-score words", s["low_words"])])
    lt = _table([("at", "When"), ("score", "Final score /100"), ("level", "CEFR"), ("questions_score", "Questions part"),
                 ("correct", "Correct"), ("speaking_score", "Speaking part"), ("start_lesson", "Placed at"), ("start_title", "Lesson")],
                analytics.level_test_rows(st))
    prog = _table([("language", "Language"), ("level", "Level"), ("lesson", "Current lesson"), ("lesson_title", "Title"),
                   ("finished", "Lessons done"), ("total", "Lessons in course")], analytics.progress(st))
    daily = analytics.daily_rows(st, 30)
    for d in daily:
        d["langs"] = ", ".join(f"{l}: {round(sec / 60, 1)} min" for l, sec in d["by_lang"].items())
    days = _table([("day", "Day"), ("minutes", "Minutes in app"), ("sessions", "Sessions"), ("lessons", "Lessons finished"), ("langs", "By language")], daily)
    weeks = _table([("week", "Week starting (Mon)"), ("minutes", "Minutes"), ("lessons", "Lessons finished"),
                    ("days_active", "Days active"), ("sessions", "Sessions")], analytics.weekly_rows(st))
    lessons = list(reversed(analytics.lesson_rows(st)))
    ltab = _table([("at", "When"), ("lang", "Lang"), ("lesson_id", "Lesson"), ("title", "Title"), ("attempt", "Attempt #"),
                   ("grade", "Grade"), ("pronunciation", "Pronunciation"), ("fluency", "Fluency"),
                   ("completeness", "Completeness"), ("flowers", "Flowers")], lessons)
    retries = list(reversed(analytics.retry_rows(st)))
    for r in retries:
        cls = "low" if r["low"] else ""
        r["word_html"] = f'<span class="{cls}">{escape(str(r["word"]))}</span>'
        r["change_txt"] = "" if r["change"] is None else f"{r['change']:+d}"
        r["status_html"] = f'<span class="{"good" if r["status"].startswith("improved") and "still" not in r["status"] else ("low" if "still low" in r["status"] or r["status"] == "not retried" else "")}">{escape(r["status"])}</span>'
    rtab = _table([("at", "When"), ("lesson_id", "Lesson"), ("kind", "Kind"), ("word_html", "Practice item"), ("first", "First score"),
                   ("latest", "Latest score"), ("change_txt", "Change"), ("retries", "Retry times"), ("status_html", "Status")],
                  retries, raw=("word_html", "status_html"))
    log = list(reversed(st.get("retry_log", [])))[:200]
    for e in log:
        t = analytics.to_local(e["at"])
        e["when"] = t.strftime("%Y-%m-%d %H:%M") if t else ""
    ltk = _table([("when", "When"), ("lesson_id", "Lesson"), ("text", "Item"), ("previous", "Before"), ("score", "After"), ("n", "Take #")], log)
    who = escape(match["name"] or match["email"] or id)
    return _page(f"Langogo - {who}", f"""<p><a href="/admin/dashboard?key={k}">&larr; All learners</a></p>
<h1>{who}</h1><p class=n>{escape(match["email"])} · joined {escape(match["joined"])} · {escape(_tz_note())}</p>{cards}
<h2>Level test results</h2>{lt}
<h2>Languages: level and current lesson</h2>{prog}
<h2>Time and lessons per day (last 30 days)</h2>{days}
<h2>Time and lessons per week</h2>{weeks}
<h2>Lesson scores (every finished lesson)</h2>{ltab}
<h2>Retry data: practice words, first vs latest score</h2><p class=n>Red = below {analytics.LOW_SCORE} on the first try.</p>{rtab}
<h2>Retry takes (newest 200)</h2>{ltk}""")


@router.get("/export")
def export(kind: str = "summary", key: str = ""):
    _check(key)
    rows, cols = [], []
    for L in _learners():
        base = {"learner": L["name"], "email": L["email"], "id": L["id"]}
        st = L["state"]
        if kind == "daily":
            for d in analytics.daily_rows(st, 3650):
                rows.append({**base, **{k: d[k] for k in ("day", "minutes", "sessions", "lessons")},
                             "by_language": "; ".join(f"{l}={round(sec / 60, 1)}" for l, sec in d["by_lang"].items())})
        elif kind == "weekly":
            rows += [{**base, **w} for w in analytics.weekly_rows(st)]
        elif kind == "lessons":
            rows += [{**base, **r} for r in analytics.lesson_rows(st)]
        elif kind == "leveltests":
            rows += [{**base, **r} for r in analytics.level_test_rows(st)]
        elif kind == "retries":
            rows += [{**base, **r} for r in analytics.retry_rows(st)]
        else:
            s = analytics.summary(st)
            for p in analytics.progress(st) or [{}]:
                rows.append({**base, "language": p.get("language", ""), "level": p.get("level", ""),
                             "current_lesson": p.get("lesson", ""), "lessons_done_in_language": p.get("finished", ""), **s})
    cols = list(dict.fromkeys(k for r in rows for k in r))
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)
    return Response("﻿" + buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=langogo-{kind}.csv"})
