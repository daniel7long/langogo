"""The database: one row per learner, in backend/data/langogo.db (SQLite, part of Python).

Each row keeps the learner's whole progress as JSON (the same shape the app has always used) plus a few
columns that make the leaderboard and sharing quick to look up. SQLite is plenty for the first thousands
of learners. To grow beyond that, move to Postgres (Supabase gives you one): only this file changes.
"""
import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone

from paths import DATA_DIR

DB_FILE = DATA_DIR / "langogo.db"


def _connect():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_FILE, timeout=10)
    con.execute(
        """CREATE TABLE IF NOT EXISTS users (
               id TEXT PRIMARY KEY,
               email TEXT,
               share_key TEXT UNIQUE,
               display_name TEXT,
               language TEXT,
               level INTEGER DEFAULT 1,
               weekly_flowers INTEGER DEFAULT 0,
               state TEXT NOT NULL,
               created_at TEXT,
               updated_at TEXT
           )"""
    )
    return con


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load(uid):
    """The saved state (a dict) of one learner, or None."""
    with closing(_connect()) as con:
        row = con.execute("SELECT state FROM users WHERE id = ?", (uid,)).fetchone()
    if not row:
        return None
    try:
        return json.loads(row[0])
    except ValueError:
        return None


def save(uid, state, email=None, share_key=None):
    user = state.get("user", {})
    with closing(_connect()) as con:
        con.execute(
            """INSERT INTO users (id, email, share_key, display_name, language, level, weekly_flowers, state, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                   email = COALESCE(excluded.email, users.email),
                   share_key = COALESCE(excluded.share_key, users.share_key),
                   display_name = excluded.display_name, language = excluded.language, level = excluded.level,
                   weekly_flowers = excluded.weekly_flowers, state = excluded.state, updated_at = excluded.updated_at""",
            (uid, email, share_key, user.get("name"), user.get("language"), user.get("level", 1),
             user.get("weekly_flowers", 0), json.dumps(state, ensure_ascii=False), _now(), _now()),
        )
        con.commit()


def delete(uid):
    with closing(_connect()) as con:
        con.execute("DELETE FROM users WHERE id = ?", (uid,))
        con.commit()


def state_by_share_key(key):
    """Used by the public share page: the saved state of the learner who owns this share key."""
    with closing(_connect()) as con:
        row = con.execute("SELECT state FROM users WHERE share_key = ?", (key,)).fetchone()
    if not row:
        return None
    try:
        return json.loads(row[0])
    except ValueError:
        return None


def top_weekly(language, exclude_uid, limit=20):
    """The most active learners of one language this week: [{name, level, flowers}]."""
    with closing(_connect()) as con:
        rows = con.execute(
            """SELECT display_name, level, weekly_flowers FROM users
               WHERE language = ? AND id != ? AND weekly_flowers > 0
               ORDER BY weekly_flowers DESC LIMIT ?""",
            (language, exclude_uid, limit),
        ).fetchall()
    return [{"name": n or "Learner", "level": lv or 1, "flowers": wf or 0} for n, lv, wf in rows]


def list_users():
    """Everyone saved in the database, oldest first, with the fields the admin page shows."""
    out = []
    with closing(_connect()) as con:
        rows = con.execute("SELECT id, email, created_at, updated_at, state FROM users ORDER BY created_at").fetchall()
    for uid, email, created, updated, state in rows:
        try:
            s = json.loads(state)
        except ValueError:
            s = {}
        u = s.get("user", {})
        out.append({
            "id": uid, "name": u.get("name") or "", "email": email or u.get("email") or "",
            "language": u.get("language") or "", "level": u.get("level", 1), "flowers": u.get("flowers", 0),
            "lessons_done": len(s.get("completed", [])), "research_opt_in": "yes" if u.get("research_consent") else "no",
            "joined": (created or "")[:10], "last_active": (updated or "")[:16].replace("T", " "),
        })
    return out
