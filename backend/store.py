"""Learner state and demo content.

Every learner has their own state (progress, records, notes, settings). `STATE` and `ATTEMPTS` below look
like plain dicts, but they always point at the learner who sent the current request, so the routers can
keep using `store.STATE[...]` unchanged. The main.py middleware picks the learner from the login token
(see auth.py) and saves their state to the database (db.py) after every change.

Without accounts (SUPABASE_URL not set) there is one local learner, "dev".
"""
import contextvars
import hashlib
import json
from collections.abc import MutableMapping
from datetime import date

import config
import content
import db  # levels and lessons are authored as JSON files in backend/content/
import languages
from paths import DATA_DIR, RECORDINGS_DIR

STATE_FILE = DATA_DIR / "state.json"

# ---- Topics ----------------------------------------------------------------------
# cost = flowers needed to unlock (0 = free). Names/levels/costs come from the F3S2 frame.
TOPICS = [
    {"id": "cooking", "name": "Cooking", "cefr": "A2", "cost": 0},
    {"id": "dancing", "name": "Dancing", "cefr": "A2", "cost": 0},
    {"id": "hiking", "name": "Hiking", "cefr": "A2", "cost": 0},
    {"id": "traveling", "name": "Traveling", "cefr": "A2", "cost": 0},
    {"id": "photography", "name": "Photography", "cefr": "B1", "cost": 0},
    {"id": "comics", "name": "Comics", "cefr": "B1", "cost": 50},
    {"id": "sports", "name": "Sports", "cefr": "B2", "cost": 65},
    {"id": "music", "name": "Music", "cefr": "A2", "cost": 45},
    {"id": "esports", "name": "Esports", "cefr": "B1", "cost": 70},
    {"id": "shopping", "name": "Shopping", "cefr": "A1", "cost": 50},
    {"id": "tourism", "name": "Tourism", "cefr": "A2", "cost": 75},
]
TOPIC_BY_ID = {t["id"]: t for t in TOPICS}

# Topics offered on the "My Favorite Topics" screen (F1S5), in display order.
FAVORITE_CHOICES = ["cooking", "dancing", "esports", "hiking", "traveling", "photography"]

# Lesson titles shown inside a topic (F3S3). Sports comes from the mockup, the rest are placeholders.
TOPIC_LESSONS = {
    "sports": ["The World Cup", "American football", "The Premier League", "NBA Championships"],
    "comics": ["Superheroes", "Reading manga", "Making a comic", "Comic conventions"],
    "music": ["Going to a concert", "Learning an instrument", "French chanson", "Music festivals"],
    "esports": ["Gaming with friends", "Streaming", "Tournaments", "Game reviews"],
    "shopping": ["At the market", "Buying clothes", "Bargaining", "Online shopping"],
    "tourism": ["Booking a hotel", "Visiting museums", "Asking for directions", "Local food"],
}
TOPIC_WORD_COUNT = 120
TOPIC_SCENARIO_COUNT = 20

PLANS = [
    {"id": "monthly", "price": 19.9, "label": "$19.9/m", "note": None},
    {"id": "yearly", "price": 99.0, "label": "$99/yr", "note": "save $140/yr"},
]

GRADE_FLOWERS = {"A+": 35, "A": 30, "B+": 25, "B": 20, "C": 10, "D": 5}
RETRY_REWARD = 5  # "Earn 5 flowers for each retry!" (F3S5). There is no cap yet.

# Demo learners for the leaderboard until there are real accounts. Flowers = flowers earned this week.
LEADERBOARD_OTHERS = [
    {"name": "Lisa", "level": 18, "flowers": 148},
    {"name": "Noah", "level": 14, "flowers": 121},
    {"name": "Mary", "level": 9, "flowers": 96},
    {"name": "Jane", "level": 11, "flowers": 78},
    {"name": "Omar", "level": 6, "flowers": 55},
    {"name": "Yuki", "level": 4, "flowers": 34},
    {"name": "Sofia", "level": 3, "flowers": 18},
]

# Learner settings (Settings screen). Saved with the rest of the state.
DEFAULT_SETTINGS = {"speech_speed": "normal", "show_translation": True, "effects": True}
SETTING_CHOICES = {"speech_speed": ("slow", "normal")}

# ---- State -----------------------------------------------------------------------
# ATTEMPTS (defined below with STATE): the latest scored attempt per spoken line,
# {lesson_id: {turn_id: {fluency, pronunciation}}}. Kept on the server so the client cannot invent scores.


STATE_VERSION = 2  # bump when the shape of the saved state changes (an older file is then ignored)


def fresh_state():
    """A brand-new learner: no language chosen yet, French (and every other language) starts at Level 1."""
    return {
        "version": STATE_VERSION,
        "user": {"name": "Learner", "streak": 1, "last_active": None,
                 "settings": dict(DEFAULT_SETTINGS), "level": 1, "flowers": 0,
                 "weekly_flowers": 0, "plan": None, "language": None},
        "levels": {},                         # current level per language: {"fr": 1, "es": 1}
        "favorites": [],
        "unlocked": [],                       # topic ids bought with flowers
        "completed": [],                      # finished lesson ids ("fr-1-1", "es-1-1", ...)
        "records": [],                        # newest first; each has "lang"
        "retries": {},
        "notes": {},                          # Vocab Notes: "lesson_id:vocab_id" -> note (see notes.py)
        "speech_log": [],                     # one entry per spoken line (see speech_log.py)
        "next_record": 1,
    }


def _week():
    y, w, _ = date.today().isocalendar()
    return f"{y}-W{w:02d}"


def _legacy_state():
    """The old single-user demo file (backend/data/state.json), used once to start the local dev learner."""
    try:
        saved = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        if isinstance(saved, dict) and saved.get("version") == STATE_VERSION:
            return saved
    except (OSError, ValueError):
        pass
    return None


def _complete(saved):
    """A saved state with any newer fields filled in."""
    state = fresh_state()
    if isinstance(saved, dict) and saved.get("version") == STATE_VERSION:
        user = {**state["user"], **saved.get("user", {})}
        state.update(saved)
        state["user"] = user
    return state


# ---- Who is asking ---------------------------------------------------------------
class Session:
    """One learner while a request is handled: id, state and the scored attempts of the lesson in progress."""

    def __init__(self, uid, email, state):
        self.uid = uid
        self.email = email
        self.state = state
        self.attempts = {}
        self.share_key = hashlib.sha256(uid.encode()).hexdigest()[:12]
        self.participant = hashlib.sha256((config.pseudonym_salt() + uid).encode()).hexdigest()[:16]


_SESSIONS = {}  # kept in memory so two quick requests from one learner never overwrite each other
_current = contextvars.ContextVar("langogo_session", default=None)


def activate(uid, email=None, name=None):
    """Loads (or creates) the learner and makes them the current one for this request."""
    session = _SESSIONS.get(uid)
    if session is None:
        saved = db.load(uid)
        if saved is None and uid == "dev":
            saved = _legacy_state()
        is_new = saved is None
        state = _complete(saved)
        user = state["user"]
        if is_new:
            user["name"] = name or "Learner"
            user["research_consent"] = not config.auth_enabled()  # your own local runs are always logged
            user["created_at"] = date.today().isoformat()
        user.setdefault("research_consent", not config.auth_enabled())
        if email:
            user["email"] = email
        session = Session(uid, email or user.get("email"), state)
        _SESSIONS[uid] = session
    user = session.state["user"]
    if user.get("week") != _week():  # the leaderboard counts flowers earned this week
        user["week"] = _week()
        user["weekly_flowers"] = 0
    _current.set(session)
    return session


def current():
    return _current.get() or activate("dev")


def save_current():
    session = _current.get()
    if session is not None and _SESSIONS.get(session.uid) is session:  # not after the account was deleted
        db.save(session.uid, session.state, session.email, session.share_key)


def forget(uid):
    """Drops a learner from memory (after their account was deleted)."""
    _SESSIONS.pop(uid, None)


class _Live(MutableMapping):
    """Behaves like a dict, but is always the current learner's STATE / ATTEMPTS."""

    def __init__(self, attr):
        self._attr = attr

    def _d(self):
        return getattr(current(), self._attr)

    def __getitem__(self, k):
        return self._d()[k]

    def __setitem__(self, k, v):
        self._d()[k] = v

    def __delitem__(self, k):
        del self._d()[k]

    def __iter__(self):
        return iter(self._d())

    def __len__(self):
        return len(self._d())

    def __repr__(self):
        return repr(self._d())


STATE = _Live("state")
ATTEMPTS = _Live("attempts")


def reset_state():
    """Development only: the current learner starts over."""
    current().state.clear()
    current().state.update(_complete(None))
    ATTEMPTS.clear()


def user_recordings_dir():
    """Where this learner's voice takes are saved: backend/recordings/<anonymous id>/."""
    return RECORDINGS_DIR / current().participant


# ---- Helpers ---------------------------------------------------------------------
def grade_for(avg):
    """Beginner-friendly grading: A+ from 85, A from 75, B+ from 65, B from 55, otherwise C.
    There is no D: a learner who finished a lesson never sees a failing grade."""
    if avg >= 85:
        return "A+"
    if avg >= 75:
        return "A"
    if avg >= 65:
        return "B+"
    if avg >= 55:
        return "B"
    return "C"


# ---- Languages -------------------------------------------------------------------------------
def current_lang(state=None):
    """The language being learned (French until the learner chooses one)."""
    state = state or STATE
    return languages.get(state["user"].get("language"))["id"]


def level_of(lang, state=None):
    state = state or STATE
    return state["levels"].get(lang, 1)


def set_level(lang, level, state=None):
    state = state or STATE
    state["levels"][lang] = level
    if current_lang(state) == lang:
        state["user"]["level"] = level


def set_language(lang, state=None):
    """Switches the course. Each language keeps its own level and finished lessons."""
    state = state or STATE
    state["user"]["language"] = lang
    state["user"]["level"] = state["levels"].setdefault(lang, 1)


def is_unlocked(topic, state=None):
    state = state or STATE
    return topic["cost"] == 0 or topic["id"] in state["unlocked"] or state["user"]["plan"] is not None


def topic_out(topic, state=None):
    return {**topic, "unlocked": is_unlocked(topic, state)}


CURRENT_ROW = 3  # the current lesson is shown on this row (0 = first), so 3 finished lessons sit above it


def touch_streak(user, today=None):
    """Counts consecutive days with a finished lesson: same day = unchanged, next day = +1, a gap = back to 1."""
    from datetime import date, timedelta
    today = today or date.today()
    last = user.get("last_active")
    try:
        last = date.fromisoformat(last) if last else None
    except ValueError:
        last = None
    if last == today:
        pass
    elif last == today - timedelta(days=1):
        user["streak"] = user.get("streak", 0) + 1
    else:
        user["streak"] = 1
    user["last_active"] = today.isoformat()


GRADE_ORDER = ["D", "C", "B", "B+", "A", "A+"]


def _lesson_facts(lesson_id, state):
    """What the lesson card shows: how many key words and dialogue lines it has (None while the
    lesson is only listed, not written yet) and the best grade earned so far (None if not done)."""
    try:
        data = content.lesson(lesson_id)
        words, lines = len(data["vocab"]), len(data["dialogue"])
    except Exception:  # noqa: BLE001 - a missing or broken file just means no counts on the card
        words = lines = None
    grades = [r["grade"] for r in state.get("records", []) if r.get("lesson_id") == lesson_id and r.get("grade") in GRADE_ORDER]
    best = max(grades, key=GRADE_ORDER.index) if grades else None
    return {"words": words, "lines": lines, "grade": best}


def course_out(state=None):
    state = state or STATE
    user = state["user"]
    lang = current_lang(state)
    level = level_of(lang, state)
    levels = content.levels(lang)
    spec = levels.get(level)
    done = set(state["completed"])

    # Every lesson in order: earlier levels (finished), this level, and the next level (locked).
    sequence, current_found = [], False
    for lv in sorted(levels):
        if lv > level + 1:
            break
        for no, (lid, title) in enumerate(levels[lv]["lessons"], start=1):
            if lv < level or (lv == level and lid in done):
                status = "completed"
            elif lv == level and not current_found:
                status, current_found = "current", True
            else:
                status = "locked"
            sequence.append({"id": lid, "level": lv, "no": no, "title": title, "status": status,
                             **_lesson_facts(lid, state)})

    this_level = [l for l in sequence if l["level"] == level]
    total = len(this_level)
    completed = sum(1 for l in this_level if l["status"] == "completed")
    current = next((l for l in sequence if l["status"] == "current"), None)

    # The list scrolls like a ladder: the current lesson always sits on the 4th row (so it is easy
    # to reach), the 3 lessons before it are above, and the following lessons are below.
    # After finishing Lv5 lesson 4 the screen therefore shows Lv5 lessons 2-4, then Lv6 lesson 1 (current), 2, ...
    if current:
        anchor = sequence.index(current)
    else:
        anchor = max((i for i, l in enumerate(sequence) if l["level"] <= level), default=0)
    lessons = sequence[max(0, anchor - CURRENT_ROW):]

    hint = None
    if (level + 1) in levels and current and current["no"] == total:
        hint = f"Finish Lesson {current['no']} to unlock Lv{level + 1}"

    language = languages.get(lang)
    return {
        "language": {"id": language["id"], "name": language["name"], "native": language["native"], "locale": language["locale"]},
        "level": level,
        "next_level": level + 1,
        "title": f"Level {level} - {spec['title']}" if spec else f"Level {level}",
        "level_titles": {str(lv): f"Level {lv} - {levels[lv]['title']}" for lv in levels},
        "completed": completed,
        "total": total,
        "progress": (completed / total) if total else 0,
        "flowers": user["flowers"],
        "streak": user.get("streak", 1),
        "hint": hint,
        "lessons": lessons,
    }


def leaderboard_out(state=None):
    """This week's most active learners of the same language, with you in it.
    Real learners come first; made-up demo learners fill the list until enough real ones exist."""
    state = state or STATE
    session = current()
    user = state["user"]
    rows = [{**r, "you": False} for r in db.top_weekly(user.get("language"), session.uid, limit=7)]
    if config.demo_leaderboard():
        names = {r["name"] for r in rows}
        for r in LEADERBOARD_OTHERS:
            if len(rows) >= 7:
                break
            if r["name"] not in names:
                rows.append({**r, "you": False})
    rows.append({"name": user.get("name", "You"), "level": user["level"], "flowers": user["weekly_flowers"], "you": True})
    rows.sort(key=lambda r: -r["flowers"])
    for i, r in enumerate(rows, start=1):
        r["rank"] = i
    return rows
