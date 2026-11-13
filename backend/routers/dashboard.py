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
import charity
import rewards
import store
from routers.admin import _check

router = APIRouter(prefix="/admin/dashboard", tags=["admin"])

CSS = """body{font-family:system-ui,sans-serif;background:#FFFCF8;color:#1F1B16;margin:24px;max-width:1200px}
h1{margin:0 0 4px}h2{margin:28px 0 8px}.n{color:#6B6259;font-size:14px}.w{overflow-x:auto}
table{border-collapse:collapse;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(120,70,20,.08)}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #EADFD3;font-size:14px;white-space:nowrap}
th{background:#FFF1E4;color:#B84A08}a{color:#B84A08}a.b{display:inline-block;margin:4px 6px 4px 0;padding:6px 14px;border-radius:99px;background:#D95F0E;color:#fff;text-decoration:none;font-size:14px}
.low{color:#B3261E;font-weight:600}.good{color:#1E7B34;font-weight:600}.card{display:inline-block;background:#fff;border-radius:12px;padding:10px 16px;margin:0 8px 8px 0;box-shadow:0 2px 12px rgba(120,70,20,.08)}
.card b{display:block;font-size:22px}
body.app{margin:0;max-width:none}.shell{display:grid;grid-template-columns:300px 1fr;min-height:100vh}
.side{background:#fff;border-right:1px solid #EADFD3;padding:16px 12px;position:sticky;top:0;height:100vh;overflow-y:auto;box-sizing:border-box}
.side h1{font-size:22px;margin:0 4px 2px}.side .n{margin:0 4px 10px}.side input{width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #EADFD3;border-radius:10px;margin:6px 0 10px;font-size:14px}
.who{display:block;text-decoration:none;color:#1F1B16;padding:9px 10px;border-radius:12px;margin-bottom:2px}.who:hover{background:#FFF1E4}
.who.on{background:#FFE3CC;box-shadow:inset 3px 0 0 #D95F0E}.who b{display:block;font-size:14px}.who span{display:block;font-size:12px;color:#6B6259;overflow:hidden;text-overflow:ellipsis}
.main{padding:24px 28px;min-width:0}.main h1{margin:0}.panel{background:#fff;border-radius:16px;padding:16px 18px;margin:0 0 18px;box-shadow:0 2px 12px rgba(120,70,20,.08)}
.panel h2{margin:0 0 10px;font-size:17px}.panel table{box-shadow:none;border-radius:0}.panel .w{max-height:420px;overflow-y:auto}.side a.b{margin:2px 4px 8px 0;padding:5px 10px;font-size:12px}
@media(max-width:800px){.shell{grid-template-columns:1fr}.side{position:static;height:auto;max-height:45vh}}"""


def _page(title, body, cls=""):
    return HTMLResponse(f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>{escape(title)}</title>
<style>{CSS}</style></head><body class="{cls}">{body}</body></html>""")


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


def _referral_rows(people):
    """One row per learner who entered a friend's code: who invited them, did they finish lesson 1, was the 100-flower bonus paid."""
    by_code = {rewards.code_of(L["id"]): L for L in people}
    rows = []
    for L in people:
        ref = L["state"].get("referral")
        if not ref:
            continue
        inviter = by_code.get(ref.get("by"))
        paid = bool(inviter) and rewards.code_of(L["id"]) in (inviter["state"].get("rewards") or {}).get("friends", [])
        rows.append({"at": (ref.get("at") or "")[:16].replace("T", " "), "friend": L["name"] or L["email"], "friend_email": L["email"],
                     "invited_by": (inviter["name"] or inviter["email"]) if inviter else "(unknown code)",
                     "invited_by_email": inviter["email"] if inviter else "", "code_used": ref.get("by", ""),
                     "finished_lesson_1": "yes" if ref.get("done") else "not yet", "bonus_paid_100_flowers": "yes" if paid else "no"})
    rows.sort(key=lambda r: r["at"], reverse=True)
    return rows


def _gifts_view(k, note=""):
    """Charity quota (what you pre-paid), gifts to fulfil, and every referral."""
    people = _learners()
    st = charity.status()
    forms = ""
    for unit, label in charity.UNITS.items():
        q = st[unit]
        left = "no quota set (unlimited)" if q["remaining"] is None else f"{q['remaining']} left"
        forms += f"""<form method=get action="/admin/dashboard/charity" class=panel>
<input type=hidden name=key value="{escape(key_plain(k))}"><input type=hidden name=unit value="{unit}">
<h2>{escape(label)}: {q['used']} given, {left}</h2>
<p class=n>Partner <input name=partner value="{escape(q['partner'])}" placeholder="e.g. the organisation you buy from">
 Link <input name=url value="{escape(q['url'])}" placeholder="https://..." size=34>
 Pre-paid total <input name=prepaid type=number min=0 value="{'' if q['prepaid'] is None else q['prepaid']}" style="width:90px" required>
 <button class=b type=submit>Save</button></p>
<p class=n>"Pre-paid total" is everything you have bought so far, not just the newest batch. Learners use it up one by one; at 0 the gift shows "Back soon".</p></form>"""
    fulfil = []
    for L in people:
        for r in analytics.redemption_rows(L["state"]):
            if r["type"].startswith("impact"):
                fulfil.append({"learner": L["name"] or L["email"], "email": L["email"], **r})
    fulfil.sort(key=lambda r: r["at"], reverse=True)
    ft = _table([("at", "When"), ("learner", "Learner"), ("email", "Email"), ("gift", "Gift"), ("flowers", "Flowers spent")], fulfil)
    refs = _table([("at", "Entered code"), ("friend", "New learner"), ("friend_email", "Email"), ("invited_by", "Invited by"), ("invited_by_email", "Inviter email"),
                   ("code_used", "Code"), ("finished_lesson_1", "Finished lesson 1"), ("bonus_paid_100_flowers", "100 flowers paid to inviter")], _referral_rows(people))
    return f"""<h1>Gifts, charity quota and referrals</h1>{note}<p class=n><a href="/admin/dashboard?key={k}">&larr; Back to learners</a></p>
{forms}<div class=panel><h2>Impact gifts redeemed ({len(fulfil)})</h2>{ft}</div>
<div class=panel><h2>Referrals ({len(_referral_rows(people))})</h2>{refs}</div>"""


def key_plain(k):
    from urllib.parse import unquote
    return unquote(k)


@router.get("/charity")
def charity_save(key: str = "", unit: str = "", partner: str = "", url: str = "", prepaid: int = 0):
    _check(key)
    k = quote(key)
    if unit not in charity.UNITS:
        return _page("Charity", _gifts_view(k, '<p class=low>Unknown gift.</p>'))
    charity.set_unit(unit, partner, url, prepaid)
    return _page("Charity", _gifts_view(k, f'<p class=good>Saved: {escape(charity.UNITS[unit])}.</p>'))


@router.get("")
def overview(key: str = "", id: str = "", view: str = ""):
    _check(key)
    k = quote(key)
    if view == "gifts":
        return _page("Gifts and referrals", f"<div class=main>{_gifts_view(k)}</div>", cls="app")
    if view != "table":
        return _shell(id, k)
    rows = []
    for L in _learners():
        s = analytics.summary(L["state"])
        prog = analytics.progress(L["state"])
        langs = "; ".join(f"{p['language']}: L{p['level']} lesson {p['lesson']}" + (" ★" if p["current"] else "") for p in prog) or "-"
        rows.append({**L, **s, "langs": langs, "flowers": L["state"].get("user", {}).get("flowers", 0),
                     "name_link": f'<a href="/admin/dashboard/learner?id={quote(L["id"])}&amp;key={k}">{escape(L["name"] or L["email"] or L["id"][:8])}</a>'})
    rows.sort(key=lambda r: r.get("last_seen") or "", reverse=True)
    cols = [("name_link", "Learner"), ("email", "Email"), ("langs", "Languages: level, current lesson (★ = now)"),
            ("minutes_today", "Min today"), ("minutes_week", "Min this week"), ("lessons_today", "Lessons today"),
            ("lessons_week", "Lessons this week"), ("lessons_total", "Lessons total"), ("level_test", "Level test (latest)"), ("avg_pronunciation", "Avg pronunciation"),
            ("retries_total", "Retries"), ("low_words", "Low-score words"),
            ("freetalk_min_week", "Free Talk min this week"), ("freetalk_min_total", "Free Talk min total"),
            ("freetalk_finished", "Free Talk dialogues done"), ("freetalk_avg_pronunciation", "Free Talk avg pronunciation"),
            ("flowers", "Flowers now"), ("flowers_spent", "Flowers spent"), ("last_seen", "Last seen"), ("joined", "Joined")]
    exports = "".join(f'<a class=b href="/admin/dashboard/export?kind={x}&amp;key={k}">{x} CSV</a>'
                      for x in ("summary", "daily", "weekly", "lessons", "retries", "freetalk", "flowers", "redemptions", "referrals", "leveltests"))
    fulfil = []
    for L in _learners():
        for r in analytics.redemption_rows(L["state"]):
            if r["type"].startswith("impact"):
                fulfil.append({"learner": L["name"] or L["email"], "email": L["email"], **r})
    fulfil.sort(key=lambda r: r["at"], reverse=True)
    gifts_tab = _table([("at", "When"), ("learner", "Learner"), ("email", "Email"), ("gift", "Gift to give"), ("flowers", "Flowers spent")], fulfil)
    return _page("Langogo dashboard", f"""<h1>Langogo dashboard</h1>
<p class=n>{len(rows)} learners. Private: contains personal data. {escape(_tz_note())} Time in the app is counted while the app is open and in front.</p>
<a class=b href="/admin/dashboard?key={k}">&larr; Back to learner view</a> {exports}{_table(cols, rows, raw=("name_link",))}
<h2>Gift redemptions to fulfil (plant a tree / donate a meal)</h2><p class=n>Each costs you about $1. The app only records the request.</p>{gifts_tab}""")


def _detail(match, k, note=""):
    st = match["state"]
    s = analytics.summary(st)
    cards = "".join(f'<div class=card>{escape(lbl)}<b>{escape(str(v))}</b></div>' for lbl, v in [
        ("Minutes today", s["minutes_today"]), ("Minutes this week", s["minutes_week"]), ("Minutes total", s["minutes_total"]),
        ("Lessons today", s["lessons_today"]), ("Lessons this week", s["lessons_week"]), ("Lessons total", s["lessons_total"]),
        ("Retries", s["retries_total"]), ("Low-score words", s["low_words"]),
        ("Free Talk min today", s["freetalk_min_today"]), ("Free Talk min this week", s["freetalk_min_week"]),
        ("Free Talk min total", s["freetalk_min_total"]), ("Free Talk dialogues finished", s["freetalk_finished"]),
        ("Free Talk left early", s["freetalk_left_early"])])
    lt = _table([("at", "When"), ("type", "Test"), ("score", "Final score /100"), ("level", "CEFR"), ("questions_score", "Questions part"),
                 ("correct", "Correct"), ("speaking_score", "Speaking part"), ("start_lesson", "Placed at"), ("start_title", "Lesson")],
                analytics.level_test_rows(st))
    prog = _table([("language", "Language"), ("level", "Level"), ("lesson", "Current lesson"), ("lesson_title", "Title"),
                   ("finished", "Lessons done"), ("total", "Lessons in course")], analytics.progress(st))
    daily = analytics.daily_rows(st, 30)
    for d in daily:
        d["langs"] = ", ".join(f"{l}: {round(sec / 60, 1)} min" for l, sec in d["by_lang"].items())
    days = _table([("day", "Day"), ("minutes", "Minutes in app"), ("freetalk_minutes", "of which Free Talk"), ("sessions", "Sessions"),
                   ("lessons", "Lessons finished"), ("freetalks", "Free Talk dialogues finished"), ("langs", "By language")], daily)
    weeks = _table([("week", "Week starting (Mon)"), ("minutes", "Minutes"), ("freetalk_minutes", "of which Free Talk"), ("lessons", "Lessons finished"),
                    ("freetalks", "Free Talk dialogues finished"), ("days_active", "Days active"), ("sessions", "Sessions")], analytics.weekly_rows(st))
    ltab = _table([("at", "When"), ("lang", "Lang"), ("lesson_id", "Lesson"), ("title", "Title"), ("attempt", "Attempt #"),
                   ("part", "Part spoken"), ("grade", "Grade"), ("pronunciation", "Pronunciation"), ("fluency", "Fluency"),
                   ("completeness", "Completeness"), ("flowers", "Flowers")], list(reversed(analytics.lesson_rows(st))))
    retries = list(reversed(analytics.retry_rows(st)))
    for r in retries:
        r["word_html"] = f'<span class="{"low" if r["low"] else ""}">{escape(str(r["word"]))}</span>'
        r["change_txt"] = "" if r["change"] is None else f"{r['change']:+d}"
        bad = "still low" in r["status"] or r["status"] == "not retried"
        r["status_html"] = f'<span class="{"low" if bad else ("good" if r["status"].startswith("improved") else "")}">{escape(r["status"])}</span>'
    rtab = _table([("at", "When"), ("source", "Source"), ("lesson_id", "Lesson"), ("kind", "Kind"), ("word_html", "Practice item"), ("first", "First score"),
                   ("latest", "Latest score"), ("change_txt", "Change"), ("retries", "Retry times"), ("status_html", "Status")],
                  retries, raw=("word_html", "status_html"))
    log = list(reversed(st.get("retry_log", [])))[:200]
    for e in log:
        t = analytics.to_local(e["at"])
        e["when"] = t.strftime("%Y-%m-%d %H:%M") if t else ""
    ltk = _table([("when", "When"), ("lesson_id", "Lesson"), ("text", "Item"), ("previous", "Before"), ("score", "After"), ("n", "Take #")], log)
    ft = _table([("at", "When"), ("lang", "Lang"), ("topic", "Topic"), ("cefr", "Level talked at"), ("status", "Status"),
                 ("minutes", "Minutes"), ("turns", "Turns"), ("hints_used", "Turns with hints"), ("grade", "Grade"),
                 ("pronunciation", "Pronunciation"), ("fluency", "Fluency"), ("completeness", "Completeness"),
                 ("flowers", "Flowers"), ("retry_takes", "Retry takes")], list(reversed(analytics.freetalk_rows(st))))
    fl = _table([("at", "When"), ("reason", "Earned for"), ("flowers", "Flowers")], list(reversed(analytics.flower_rows(st)))[:150])
    rd = _table([("at", "When"), ("gift", "Gift"), ("type", "Type"), ("flowers", "Flowers spent")], list(reversed(analytics.redemption_rows(st))))
    balance = st.get("user", {}).get("flowers", 0)
    adjust = f"""<form method=get action="/admin/dashboard/flowers" class=panel>
<input type=hidden name=key value="{escape(key_plain(k))}"><input type=hidden name=id value="{escape(match['id'])}">
<h2>Flowers: {balance} now (you can change it)</h2>
<p class=n><select name=mode><option value=set>Set balance to</option><option value=add>Add (use a minus to remove)</option></select>
 <input name=amount type=number required style="width:110px" placeholder="e.g. 100">
 Note <input name=note placeholder="why (shown in the Earned list)" size=30>
 <button class=b type=submit>Save</button></p>
<p class=n>Changes show in the learner's app straight away and appear in the Earned list as "admin". They do not count toward the weekly leaderboard.</p></form>"""
    code = rewards.code_of(match["id"])
    mine = [r for r in _referral_rows(_learners()) if r["code_used"] == code]
    ref = st.get("referral")
    inv = next((r["invited_by"] for r in _referral_rows(_learners()) if r["friend_email"] == match["email"] and r["code_used"] == (ref or {}).get("by")), "")
    rf = _table([("at", "Entered code"), ("friend", "Friend"), ("friend_email", "Email"), ("finished_lesson_1", "Finished lesson 1"),
                 ("bonus_paid_100_flowers", "100 flowers paid")], mine)
    who = escape(match["name"] or match["email"] or match["id"])
    seen = f" · last seen {escape(s['last_seen'])}" if s["last_seen"] else " · no time tracked yet"
    return f"""<h1>{who}</h1><p class=n>{escape(match["email"])} · joined {escape(match["joined"])}{seen}</p>{note}{adjust}{cards}
<div class=panel><h2>Languages: level and current lesson</h2>{prog}</div>
<div class=panel><h2>Level test results</h2>{lt}</div>
<div class=panel><h2>Per day (last 30 days)</h2>{days}</div>
<div class=panel><h2>Per week</h2>{weeks}</div>
<div class=panel><h2>Flowers: balance {st.get("user", {}).get("flowers", 0)}, spent {s["flowers_spent"]}</h2><h3>Gifts redeemed</h3>{rd}<h3>Earned (newest 150)</h3>{fl}</div>
<div class=panel><h2>Referrals</h2><p class=n>Invite code: <b>{escape(code)}</b>. {("Invited by " + escape(inv) + (", finished lesson 1" if ref and ref.get("done") else ", has not finished lesson 1 yet") + ".") if ref else "Did not enter a friend's code."}
 Friends who used this learner's code ({len(mine)}):</p>{rf}</div>
<div class=panel><h2>Free Talk: every dialogue</h2><p class=n>"left early" = ended before {store.FREETALK_MIN_TURNS} turns, so no rating or flowers. Words to practise from a finished dialogue and their retries are in the retry tables below (Source = Free Talk).</p>{ft}</div>
<div class=panel><h2>Lesson scores (every finished lesson)</h2>{ltab}</div>
<div class=panel><h2>Retry data: first vs latest score of each practice item</h2><p class=n>Red = below {analytics.LOW_SCORE} on the first try.</p>{rtab}</div>
<div class=panel><h2>Retry takes (newest 200)</h2>{ltk}</div>"""


def _shell(selected, k, note=""):
    """Left: the learners. Right: the one picked."""
    people = _learners()
    for L in people:
        L["_sum"] = analytics.summary(L["state"])
    people.sort(key=lambda L: L["_sum"]["last_seen"] or "", reverse=True)
    match = next((L for L in people if L["id"] == selected), None) or (people[0] if people else None)
    items = ""
    for L in people:
        prog = analytics.progress(L["state"])
        cur = next((p for p in prog if p["current"]), prog[0] if prog else None)
        line = f"{cur['language']} · L{cur['level']} lesson {cur['lesson']}" if cur else "-"
        on = " on" if match and L["id"] == match["id"] else ""
        label = L["name"] or L["email"] or L["id"][:8]
        items += (f'<a class="who{on}" data-q="{escape((label + " " + L["email"]).lower())}" '
                  f'href="/admin/dashboard?id={quote(L["id"])}&amp;key={k}"><b>{escape(label)}</b><span>{escape(line)}</span>'
                  f'<span>{escape(L["_sum"]["last_seen"] or "no activity tracked yet")}</span></a>')
    exports = "".join(f'<a class=b href="/admin/dashboard/export?kind={x}&amp;key={k}">{x}</a>'
                      for x in ("summary", "daily", "weekly", "lessons", "retries", "freetalk", "flowers", "redemptions", "referrals", "leveltests"))
    side = f"""<div class=side><h1>Langogo</h1><p class=n>{len(people)} learners · {escape(_tz_note())}</p>
<a class=b href="/admin/dashboard?view=table&amp;key={k}">All learners table</a>
<a class=b href="/admin/dashboard?view=gifts&amp;key={k}">Gifts, charity &amp; referrals</a>
<input id=q placeholder="Search learners" oninput="for(const a of document.querySelectorAll('.who'))a.style.display=a.dataset.q.includes(this.value.toLowerCase())?'':'none'">
{items}<p class=n style="margin:14px 4px 4px">CSV downloads</p>{exports}</div>"""
    main = _detail(match, k, note) if match else "<p>No learners yet.</p>"
    return _page("Langogo dashboard", f'<div class=shell>{side}<div class=main>{main}</div></div>', cls="app")


@router.get("/flowers")
def change_flowers(key: str = "", id: str = "", mode: str = "set", amount: int = 0, note: str = ""):
    """Admin: set a learner's flower balance, or add / remove flowers. Recorded in their Earned list as "admin"."""
    _check(key)
    k = quote(key)
    sessions = store._SESSIONS
    session = sessions.get(id)  # a learner who is online has their state in memory: change that one, or their next save would undo it
    if session is not None:
        state, email = session.state, session.email
    else:
        state, attempts = db.load_full(id)
        email = None
        if state is None:
            return _shell(id, k, '<p class=low>Learner not found.</p>')
    user = state.setdefault("user", {})
    before = int(user.get("flowers", 0))
    after = max(0, amount if mode == "set" else before + amount)
    delta = after - before
    user["flowers"] = after
    if delta:
        log = state.setdefault("flower_log", [])
        log.append({"at": analytics.now_iso(), "kind": "admin", "amount": delta, "key": note.strip()[:80] or None})
        del log[:-rewards.KEEP_LOG]
    if session is not None:
        store._write(session)
    else:
        db.save(id, state, email, rewards.code_of(id), attempts)
    return _shell(id, k, f'<p class=good>Flowers changed from {before} to {after}.</p>')


@router.get("/learner")
def learner(id: str = "", key: str = ""):
    _check(key)
    return _shell(id, quote(key))


@router.get("/export")
def export(kind: str = "summary", key: str = ""):
    _check(key)
    rows, cols = [], []
    for L in _learners():
        base = {"learner": L["name"], "email": L["email"], "id": L["id"]}
        st = L["state"]
        if kind == "daily":
            for d in analytics.daily_rows(st, 3650):
                rows.append({**base, **{k: d[k] for k in ("day", "minutes", "freetalk_minutes", "sessions", "lessons", "freetalks")},
                             "by_language": "; ".join(f"{l}={round(sec / 60, 1)}" for l, sec in d["by_lang"].items())})
        elif kind == "weekly":
            rows += [{**base, **w} for w in analytics.weekly_rows(st)]
        elif kind == "lessons":
            rows += [{**base, **r} for r in analytics.lesson_rows(st)]
        elif kind == "flowers":
            rows += [{**base, **r} for r in analytics.flower_rows(st)]
        elif kind == "referrals":
            if not rows:
                rows = _referral_rows(_learners())
            break
        elif kind == "redemptions":
            rows += [{**base, **r} for r in analytics.redemption_rows(st)]
        elif kind == "freetalk":
            rows += [{**base, **r} for r in analytics.freetalk_rows(st)]
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
