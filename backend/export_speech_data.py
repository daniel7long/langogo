"""Research export of the speech data (server side only: the app never shows or receives it).

Every scored recording of a learner who agreed to research is saved in the database (see speech_log.py).
Run this from the backend folder to turn it into a spreadsheet and print a short summary. To export what your
live app collected, put the same DATABASE_URL as on Render in backend/.env first.

    python export_speech_data.py                 # all languages
    python export_speech_data.py fr              # one language

Output: data/speech_export.csv  (open in Excel, or load with pandas)
"""
import csv
import json
import sys
from pathlib import Path

import db

DATA = Path(__file__).parent / "data"
OUT = DATA / "speech_export.csv"
COLUMNS = ["participant", "at", "lang", "lesson_id", "turn_id", "text", "engine", "unit", "units", "client_ms",
           "recorded_seconds", "speech_seconds", "rate_per_min", "recorded_rate_per_min",
           "fluency", "pronunciation", "completeness"]


def mean(values):
    values = [v for v in values if v is not None]
    return round(sum(values) / len(values), 1) if values else None


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    rows = db.speech_rows(only)
    if not rows:
        print(f"No speech log yet in the {db.storage_name()} database. Record a lesson (with research use on) first.")
        return
    DATA.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(f"{len(rows)} spoken lines written to {OUT}")
    for lang in sorted({r["lang"] for r in rows}):
        items = [r for r in rows if r["lang"] == lang]
        real = [r for r in items if r.get("engine") == "azure"]
        print(f"  {lang}: {len(items)} lines ({len(real)} scored by Azure) | "
              f"avg rate {mean(r['rate_per_min'] for r in real)} {items[-1]['unit']}/min | "
              f"pronunciation {mean(r['pronunciation'] for r in real)} | fluency {mean(r['fluency'] for r in real)}")


if __name__ == "__main__":
    main()
