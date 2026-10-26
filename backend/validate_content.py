"""Checks all lesson content. Run from the backend folder:  python validate_content.py"""
import sys

import content

ICON = {"ok": "OK     ", "missing": "todo   ", "error": "ERROR  ", "unlisted": "unlisted"}

try:
    rows = content.report()
except content.ContentError as e:
    print(f"ERROR  {e}")
    sys.exit(1)

for r in rows:
    print(f"{ICON[r['status']]} {r["id"]:<8} {r['title']:<28} {r['detail']}")
bad = [r for r in rows if r["status"] in ("error", "unlisted")]
print(f"\n{sum(r['status'] == 'ok' for r in rows)} ready, "
      f"{sum(r['status'] == 'missing' for r in rows)} still to write, {len(bad)} problem(s).")
sys.exit(1 if bad else 0)
