"""Lists the learners saved in backend/data/langogo.db. Run from the backend folder:

    python list_users.py            # a table of everyone
    python list_users.py --csv      # also writes data/users.csv (open in Excel)

Shows what the app stores (name, email, language, level, flowers, lessons done, research opt-in).
Passwords are never here: Supabase keeps them. Treat this list as private personal data.
"""
import csv
import json
import sqlite3
import sys

from db import DB_FILE
from paths import DATA_DIR


def main():
    if not DB_FILE.is_file():
        print(f"No database yet ({DB_FILE}). It appears after the first learner opens the app.")
        return
    con = sqlite3.connect(DB_FILE)
    rows = []
    for uid, email, created, updated, state in con.execute(
        "SELECT id, email, created_at, updated_at, state FROM users ORDER BY created_at"
    ):
        s = json.loads(state)
        u = s.get("user", {})
        rows.append({
            "name": u.get("name"), "email": email or u.get("email") or "", "language": u.get("language") or "",
            "level": u.get("level", 1), "flowers": u.get("flowers", 0),
            "lessons_done": len(s.get("completed", [])), "research_opt_in": "yes" if u.get("research_consent") else "no",
            "joined": (created or "")[:10], "last_active": (updated or "")[:16].replace("T", " "), "id": uid,
        })
    print(f"{len(rows)} learner(s)\n")
    for r in rows:
        print(f"{r['name'] or '-':<12} {r['email']:<30} {r['language'] or '-':<4} L{r['level']:<3} "
              f"{r['flowers']:>5} flowers  {r['lessons_done']:>3} lessons  research:{r['research_opt_in']:<3}  last {r['last_active']}")
    if "--csv" in sys.argv and rows:
        out = DATA_DIR / "users.csv"
        with out.open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)
        print(f"\nWritten to {out}")


if __name__ == "__main__":
    main()
