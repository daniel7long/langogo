"""The real charity behind the impact gifts, and the quota you have pre-paid for.

You buy trees / meals from a partner ahead of time (for example through a planting or hunger-relief programme) and enter the
number you bought on the dashboard (Charity partners & prepaid quota). Every time a learner redeems "Plant a tree" or
"Donate a meal" one unit of that quota is used. When it reaches 0 the gift shows "Back soon" in the app until you add more.
If you have not entered a quota for a gift yet, it is not limited (so the app keeps working while you set things up).
"""
import db

KEY = "charity"
UNITS = {"tree": "Plant a tree", "meal": "Donate a meal"}


def config():
    cfg = db.get_setting(KEY)
    return {u: cfg.get(u) or {} for u in UNITS}


def set_unit(unit, partner, url, prepaid, note=""):
    if unit not in UNITS:
        raise ValueError("unknown unit")
    cfg = db.get_setting(KEY)
    cfg[unit] = {"partner": partner.strip()[:80], "url": url.strip()[:300], "note": note.strip()[:200],
                 "prepaid": max(0, int(prepaid))}
    db.set_setting(KEY, cfg)


def used_counts():
    """{'tree': n, 'meal': n}: everything learners have redeemed so far, across all learners."""
    out = {u: 0 for u in UNITS}
    for _uid, _email, _c, _u, state in db.all_states():
        for r in (state.get("gifts") or {}).get("redeemed", []):
            if r.get("unit") in out:
                out[r["unit"]] += 1
    return out


def status():
    """Per unit: partner, link, prepaid, used, remaining (None = no quota set, unlimited) and whether it can be redeemed now."""
    cfg, used = config(), used_counts()
    out = {}
    for unit in UNITS:
        c = cfg[unit]
        prepaid = c.get("prepaid")
        remaining = None if prepaid is None else max(0, prepaid - used[unit])
        out[unit] = {"partner": c.get("partner", ""), "url": c.get("url", ""), "note": c.get("note", ""), "prepaid": prepaid,
                     "used": used[unit], "remaining": remaining, "available": remaining is None or remaining > 0}
    return out
