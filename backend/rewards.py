"""How flowers are earned (the "Earning flowers" table of the Gift Menu spec) and the daily cap.

Every payment goes through award(): it checks the limit of the rule, the daily cap, updates the learner's balance and
writes one line to state["flower_log"] (shown on the dashboard).

state["rewards"] keeps the counters:
    days   {"2026-11-12": {"earned": 40, "counts": {"lesson": 2}, "practiced": True}}   (the last 60 days)
    weeks  {"2026-W46": {"weekly_goal": 1}}
    once   {"new_language:fr": True}
    friends  [share keys of the friends who were paid]
"""
import hashlib

import analytics
import db

DAILY_CAP = 100  # flowers per day, from every rule except the friend bonus
PRACTICE_SECONDS = 5 * 60  # "5+ min"
WEEKLY_PRACTICE_DAYS = 3
FREETALK_SECONDS = 5 * 60

# kind: flowers, limit, period ("day", "week", "language" = once per language, "total"), label shown to the learner
RULES = {
    "daily_practice": {"flowers": 5, "limit": 1, "per": "day", "label": "First practice of the day (5+ min)"},
    "lesson": {"flowers": 15, "limit": 2, "per": "day", "label": "Complete a lesson"},
    "retry": {"flowers": 3, "limit": 3, "per": "day", "label": "Retry and improve a score"},
    "freetalk": {"flowers": 10, "limit": 2, "per": "day", "label": "Free Talk session (5+ min)"},
    "weekly_goal": {"flowers": 30, "limit": 1, "per": "week", "label": "Weekly goal (practice on 3 days)"},
    "new_language": {"flowers": 10, "limit": 1, "per": "language", "label": "First time trying a new language"},
    "friend": {"flowers": 100, "limit": 5, "per": "total", "label": "Friend joins and finishes lesson 1"},
}
NOT_CAPPED = {"friend"}  # the friend bonus is paid in full, whatever else was earned that day
KEEP_DAYS = 60
KEEP_LOG = 400


def _data(state):
    r = state.setdefault("rewards", {})
    r.setdefault("days", {})
    r.setdefault("weeks", {})
    r.setdefault("once", {})
    r.setdefault("friends", [])
    return r


def _today_key():
    return analytics.today().isoformat()


def _week_key(d=None):
    d = d or analytics.today()
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def _day(state, key=None):
    return _data(state)["days"].setdefault(key or _today_key(), {"earned": 0, "counts": {}, "practiced": False})


def earned_today(state):
    return _day(state)["earned"]


def used(state, kind):
    """How many times the rule has paid in its current period (today / this week / ever)."""
    rule, r = RULES[kind], _data(state)
    if rule["per"] == "day":
        return _day(state)["counts"].get(kind, 0)
    if rule["per"] == "week":
        return r["weeks"].get(_week_key(), {}).get(kind, 0)
    if rule["per"] == "language":
        return sum(1 for k in r["once"] if k.startswith(kind + ":"))
    return len(r["friends"])


def award(state, kind, key=None):
    """Pays one reward if its limit and the daily cap allow it. Returns the flowers paid (0 = nothing)."""
    rule, r = RULES[kind], _data(state)
    day = _day(state)
    if rule["per"] == "day" and day["counts"].get(kind, 0) >= rule["limit"]:
        return 0
    if rule["per"] == "week" and r["weeks"].get(_week_key(), {}).get(kind, 0) >= rule["limit"]:
        return 0
    if rule["per"] == "language" and r["once"].get(f"{kind}:{key}"):
        return 0
    if rule["per"] == "total" and len(r["friends"]) >= rule["limit"]:
        return 0
    amount = rule["flowers"]
    if kind not in NOT_CAPPED:
        amount = min(amount, DAILY_CAP - day["earned"])
    if amount <= 0:
        return 0  # the daily cap is reached: the limit is not used up, so it can still pay tomorrow
    if rule["per"] == "day":
        day["counts"][kind] = day["counts"].get(kind, 0) + 1
    elif rule["per"] == "week":
        w = r["weeks"].setdefault(_week_key(), {})
        w[kind] = w.get(kind, 0) + 1
    elif rule["per"] == "language":
        r["once"][f"{kind}:{key}"] = True
    else:
        r["friends"].append(key)
    if kind not in NOT_CAPPED:
        day["earned"] += amount
    user = state["user"]
    user["flowers"] += amount
    user["weekly_flowers"] += amount
    log = state.setdefault("flower_log", [])
    log.append({"at": analytics.now_iso(), "kind": kind, "amount": amount, "key": key})
    del log[:-KEEP_LOG]
    for old in sorted(r["days"])[:-KEEP_DAYS]:
        del r["days"][old]
    return amount


def practiced(state):
    """The learner did something that counts as practice today (a lesson, a retry, a Free Talk). Returns flowers paid."""
    _day(state)["practiced"] = True
    return maybe_daily(state)


def maybe_daily(state):
    """First practice of the day: 5 flowers once the learner has practised and been in the app for 5 minutes.
    Also checks the weekly goal. Called after practice and from the 30-second ping."""
    day = _day(state)
    if not day["practiced"] or day["counts"].get("daily_practice"):
        return 0
    seconds = state.get("usage", {}).get("days", {}).get(_today_key(), {}).get("sec", 0)
    if seconds < PRACTICE_SECONDS:
        return 0
    paid = award(state, "daily_practice")
    if day["counts"].get("daily_practice"):
        paid += maybe_weekly(state)
    return paid


def maybe_weekly(state):
    """Weekly goal: 30 flowers once the learner has had a 'first practice' on 3 different days of this week."""
    start = analytics.week_start(analytics.today())
    days = _data(state)["days"]
    n = 0
    for i in range(7):
        d = (start.fromordinal(start.toordinal() + i)).isoformat()
        if days.get(d, {}).get("counts", {}).get("daily_practice"):
            n += 1
    return award(state, "weekly_goal") if n >= WEEKLY_PRACTICE_DAYS else 0


# ---- Friends --------------------------------------------------------------------------------------------
def code_of(uid):
    """The invite code of a learner (the same short key their share links use)."""
    return hashlib.sha256(uid.encode()).hexdigest()[:12]


def claim_friends(state, my_code):
    """Pays 100 flowers for each friend who entered my code and has finished lesson 1 (up to 5 friends).
    Looks through the learners' saved states, so call it only when the learner opens the Gift Menu."""
    r = _data(state)
    paid = 0
    if len(r["friends"]) >= RULES["friend"]["limit"]:
        return 0
    for uid, _email, _created, _updated, other in db.all_states():
        ref = other.get("referral") or {}
        friend = code_of(uid)
        if ref.get("by") == my_code and ref.get("done") and friend != my_code and friend not in r["friends"]:
            paid += award(state, "friend", key=friend)
    return paid


def friends_summary(state, my_code):
    joined = done = 0
    for uid, _email, _created, _updated, other in db.all_states():
        ref = other.get("referral") or {}
        if ref.get("by") == my_code:
            joined += 1
            done += 1 if ref.get("done") else 0
    return {"joined": joined, "finished_lesson_1": done, "paid": len(_data(state)["friends"]), "max": RULES["friend"]["limit"]}


def rules_out(state):
    """The earning table with this learner's progress, for the Gift Menu."""
    out = []
    for kind, rule in RULES.items():
        out.append({"kind": kind, "label": rule["label"], "flowers": rule["flowers"], "limit": rule["limit"],
                    "per": rule["per"], "used": min(used(state, kind), rule["limit"])})
    return out
