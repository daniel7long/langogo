"""The database: one row per learner, kept where it survives restarts.

Two places are supported, chosen by one setting:
  * DATABASE_URL set  -> PostgreSQL (your Supabase database). Use this on Render: Render's free disk is wiped
                         on every restart, redeploy and sleep, a Supabase database is not.
  * DATABASE_URL empty -> SQLite file backend/data/langogo.db (fine on your own computer).

Each row keeps the learner's whole progress as JSON (the same shape the app has always used), the scored
lines of the lesson in progress ("attempts"), and a few columns that make the leaderboard and sharing quick
to look up. The research speech log has its own table. Nothing else in the app talks to the database.
"""
import json
import sqlite3
import threading
import time
from datetime import datetime, timezone

import config
from paths import DATA_DIR

DB_FILE = DATA_DIR / "langogo.db"

_ready = set()  # which databases already have their tables in this process
_lock = threading.Lock()

_TABLES = [
    """CREATE TABLE IF NOT EXISTS users (
           id TEXT PRIMARY KEY,
           email TEXT,
           share_key TEXT UNIQUE,
           display_name TEXT,
           language TEXT,
           level INTEGER DEFAULT 1,
           weekly_flowers INTEGER DEFAULT 0,
           state TEXT NOT NULL,
           attempts TEXT,
           created_at TEXT,
           updated_at TEXT
       )""",
    """CREATE TABLE IF NOT EXISTS speech_log (
           participant TEXT,
           lang TEXT,
           at TEXT,
           entry TEXT NOT NULL
       )""",
    "CREATE INDEX IF NOT EXISTS speech_log_participant ON speech_log (participant)",
]


def is_postgres():
    return bool(config.database_url())


def storage_name():
    return "postgres" if is_postgres() else "sqlite"


def _q(sql):
    """The SQL is written with ? marks (SQLite); PostgreSQL wants %s."""
    return sql.replace("?", "%s") if is_postgres() else sql


def _connect():
    url = config.database_url()
    if url:
        import psycopg  # only needed when DATABASE_URL is set
        # prepare_threshold=None: Supabase's pooler cannot keep prepared statements between calls.
        con = psycopg.connect(url, connect_timeout=10, prepare_threshold=None)
    else:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(DB_FILE, timeout=10)
    key = url or str(DB_FILE)
    if key not in _ready:
        with _lock:
            if key not in _ready:
                _make_tables(con, bool(url))
                _ready.add(key)
    return con


def _make_tables(con, postgres):
    for sql in _TABLES:
        con.execute(sql)
    if postgres:
        con.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS attempts TEXT")
        # Supabase lets anyone with the public key read tables through its Data API unless row level
        # security is on. Switched on with no policy, only this server (the owner) can read or write them.
        con.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY")
        con.execute("ALTER TABLE speech_log ENABLE ROW LEVEL SECURITY")
    else:
        columns = {row[1] for row in con.execute("PRAGMA table_info(users)")}
        if "attempts" not in columns:  # a database made by an older version
            con.execute("ALTER TABLE users ADD COLUMN attempts TEXT")
    con.commit()


def _run(work, retries=3):
    """Opens a connection, does `work(con)`, closes it. A hiccup (sleeping database, network blip) is retried."""
    last = None
    for attempt in range(retries):
        con = None
        try:
            con = _connect()
            return work(con)
        except Exception as e:  # noqa: BLE001 - driver errors differ between SQLite and PostgreSQL
            last = e
            time.sleep(0.4 * (2 ** attempt))
        finally:
            if con is not None:
                try:
                    con.close()
                except Exception:  # noqa: BLE001
                    pass
    raise last


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _loads(text, default):
    """JSON text -> a dict, or `default` if it is missing or broken."""
    try:
        value = json.loads(text)
    except (TypeError, ValueError):
        return default
    return value if isinstance(value, dict) else default


def ping():
    """True when the database answers (used by /health)."""
    try:
        _run(lambda con: con.execute("SELECT 1").fetchone(), retries=1)
        return True
    except Exception:  # noqa: BLE001
        return False


# ---- Learners -------------------------------------------------------------------------------------
def load_full(uid):
    """(saved state, attempts of the lesson in progress) of one learner, or (None, {}) if new.
    Raises if the database cannot be reached: the app must never start a learner afresh because of that."""
    def work(con):
        return con.execute(_q("SELECT state, attempts FROM users WHERE id = ?"), (uid,)).fetchone()
    row = _run(work)
    if not row:
        return None, {}
    state = _loads(row[0], None)
    if state is None:
        raise ValueError("The saved data of this learner could not be read.")  # never overwrite it with a blank one
    return state, _loads(row[1], {})


def load(uid):
    """The saved state (a dict) of one learner, or None."""
    return load_full(uid)[0]


def save(uid, state, email=None, share_key=None, attempts=None):
    user = state.get("user", {})
    now = _now()
    values = (uid, email, share_key, user.get("name"), user.get("language"), user.get("level", 1),
              user.get("weekly_flowers", 0), json.dumps(state, ensure_ascii=False, default=str),
              json.dumps(attempts or {}, ensure_ascii=False, default=str), now, now)

    def work(con):
        con.execute(
            _q("""INSERT INTO users (id, email, share_key, display_name, language, level, weekly_flowers, state, attempts, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                      email = COALESCE(excluded.email, users.email),
                      share_key = COALESCE(excluded.share_key, users.share_key),
                      display_name = excluded.display_name, language = excluded.language, level = excluded.level,
                      weekly_flowers = excluded.weekly_flowers, state = excluded.state,
                      attempts = excluded.attempts, updated_at = excluded.updated_at"""),
            values,
        )
        con.commit()
    _run(work)


def delete(uid):
    def work(con):
        con.execute(_q("DELETE FROM users WHERE id = ?"), (uid,))
        con.commit()
    _run(work)


def state_by_share_key(key):
    """Used by the public share page: the saved state of the learner who owns this share key."""
    row = _run(lambda con: con.execute(_q("SELECT state FROM users WHERE share_key = ?"), (key,)).fetchone())
    return _loads(row[0], None) if row else None


def top_weekly(language, exclude_uid, limit=20):
    """The most active learners of one language this week: [{name, level, flowers}]."""
    rows = _run(lambda con: con.execute(
        _q("""SELECT display_name, level, weekly_flowers FROM users
              WHERE language = ? AND id != ? AND weekly_flowers > 0
              ORDER BY weekly_flowers DESC LIMIT ?"""),
        (language, exclude_uid, limit)).fetchall())
    return [{"name": n or "Learner", "level": lv or 1, "flowers": wf or 0} for n, lv, wf in rows]


def list_users():
    """Everyone saved in the database, oldest first, with the fields the admin page shows."""
    rows = _run(lambda con: con.execute(
        "SELECT id, email, created_at, updated_at, state FROM users ORDER BY created_at").fetchall())
    out = []
    for uid, email, created, updated, state in rows:
        s = _loads(state, {})
        u = s.get("user", {})
        out.append({
            "id": uid, "name": u.get("name") or "", "email": email or u.get("email") or "",
            "language": u.get("language") or "", "level": u.get("level", 1), "flowers": u.get("flowers", 0),
            "lessons_done": len(s.get("completed", [])), "research_opt_in": "yes" if u.get("research_consent") else "no",
            "joined": (created or "")[:10], "last_active": (updated or "")[:16].replace("T", " "),
        })
    return out


# ---- Research speech log (see speech_log.py) --------------------------------------------------------
def log_speech(entry):
    def work(con):
        con.execute(_q("INSERT INTO speech_log (participant, lang, at, entry) VALUES (?, ?, ?, ?)"),
                    (entry.get("participant"), entry.get("lang"), entry.get("at"),
                     json.dumps(entry, ensure_ascii=False, default=str)))
        con.commit()
    _run(work)


def forget_speech(participant):
    """Removes every logged row of one participant. Returns how many."""
    def work(con):
        cur = con.execute(_q("DELETE FROM speech_log WHERE participant = ?"), (participant,))
        con.commit()
        return cur.rowcount
    return _run(work) or 0


def speech_rows(lang=None):
    """Every logged row (oldest first), optionally of one language."""
    if lang:
        rows = _run(lambda con: con.execute(
            _q("SELECT entry FROM speech_log WHERE lang = ? ORDER BY at"), (lang,)).fetchall())
    else:
        rows = _run(lambda con: con.execute("SELECT entry FROM speech_log ORDER BY at").fetchall())
    return [e for e in (_loads(r[0], None) for r in rows) if e]
