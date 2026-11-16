"""The pool of real gift card codes (for example $10 Starbucks eGift cards) that learners get when they redeem the Coffee Card.

You buy the cards, paste their codes (or claim links) on the dashboard (Gifts page > Coffee Card codes), one per line. When a
learner redeems, the next unused code is handed to them in the app. The stock left is simply the number of unused codes.
DAILY_CAP stops a bug or a flower-farming trick from giving away the whole pool in one day (change it with the env var COFFEE_DAILY_CAP).
"""
import os
import db
import analytics

KEY = "giftcodes"
DAILY_CAP = int(os.environ.get("COFFEE_DAILY_CAP", "5"))


def _all():
    return db.get_setting(KEY)


def _pool(unit):
    return _all().get(unit) or []


def _save(unit, pool):
    data = _all()
    data[unit] = pool
    db.set_setting(KEY, data)


def add(unit, text):
    """Add codes from pasted text (one per line, blanks and duplicates skipped). Returns how many were added."""
    pool = _pool(unit)
    have = {c["code"] for c in pool}
    n = 0
    for line in (text or "").splitlines():
        code = line.strip()[:300]
        if code and code not in have:
            pool.append({"code": code, "added": analytics.now_iso()})
            have.add(code)
            n += 1
    _save(unit, pool)
    return n


def counts(unit):
    pool = _pool(unit)
    given = sum(1 for c in pool if c.get("to"))
    void = sum(1 for c in pool if c.get("void") and not c.get("to"))
    return {"total": len(pool), "given": given, "void": void, "remaining": len(pool) - given - void}


def given_today(unit):
    today = analytics.now_iso()[:10]
    return sum(1 for c in _pool(unit) if str(c.get("at", ""))[:10] == today)


def take(unit, uid, email, gift_id):
    """Hand out the next unused code, or None if there is none left. Marks it as given to this learner."""
    pool = _pool(unit)
    for c in pool:
        if not c.get("to") and not c.get("void"):
            c.update(to=uid, email=email, at=analytics.now_iso(), gift_id=gift_id)
            _save(unit, pool)
            return c["code"]
    return None


def give_back(unit, code):
    """Put a code back in the pool (used if the redeem failed after the code was taken)."""
    pool = _pool(unit)
    for c in pool:
        if c["code"] == code:
            for k in ("to", "email", "at", "gift_id"):
                c.pop(k, None)
    _save(unit, pool)


def void(unit, code):
    pool = _pool(unit)
    for c in pool:
        if c["code"] == code and not c.get("to"):
            c["void"] = True
    _save(unit, pool)


def rows(unit):
    return list(reversed(_pool(unit)))
