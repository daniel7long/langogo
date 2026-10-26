"""RESEARCH DATA, SERVER ONLY. The app never receives or shows any of this (no speech rate, no timings).
Export it with `python export_speech_data.py`.

Records how long learners spend speaking each line, so the speech rate can be worked out.

One entry is written for every recording that is scored. It is kept in the saved state
(state["speech_log"], newest last, the latest 2000 entries) and also appended to
backend/data/speech_log.jsonl, a plain file you can open in Excel / pandas for analysis.

Fields of an entry
    participant             anonymous ID (a hash of the account id): the same person always has the same ID
    (only learners who agreed to research use are logged; deleting an account removes their rows)
    at                      when the line was recorded (UTC, ISO 8601)
    lang, lesson_id, turn_id, text
    engine                  "azure" or "demo" (demo numbers are made up)
    unit, units             what was counted (words or characters) and how many were in the line
    client_ms               how long the record button was on, as measured by the app
    recorded_seconds        length of the recording itself, measured by the server (null in demo mode)
    speech_seconds          first word to last word, from Azure's word timings (null in demo mode)
    rate_per_min            units per minute while speaking (uses speech_seconds, else recorded_seconds)
    recorded_rate_per_min   units per minute over the whole recording, pauses included
    fluency, pronunciation, completeness
"""
import json
from datetime import datetime, timezone

import store
from paths import DATA_DIR

LOG_FILE = DATA_DIR / "speech_log.jsonl"
KEEP = 2000


def record(lang, lesson_id, turn_id, text, client_ms, result, metrics):
    """Logs one spoken line, but only for learners who agreed to research use (Settings > Privacy)."""
    if not store.STATE["user"].get("research_consent"):
        return None
    entry = {
        "participant": store.current().participant,  # anonymous ID: no name, no email
        "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "lang": lang, "lesson_id": lesson_id, "turn_id": turn_id, "text": text,
        "engine": result["engine"],
        "unit": metrics["unit"], "units": metrics["units"],
        "client_ms": client_ms,
        "recorded_seconds": metrics["recorded_seconds"], "speech_seconds": metrics["speech_seconds"],
        "rate_per_min": metrics["rate_per_min"], "recorded_rate_per_min": metrics["recorded_rate_per_min"],
        "fluency": result["fluency"], "pronunciation": result["pronunciation"],
        "completeness": result["completeness"],
    }
    log = store.STATE.setdefault("speech_log", [])
    log.append(entry)
    del log[:-KEEP]
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError as e:
        print(f"Could not write the speech log: {e}")
    return entry


def _mean(values):
    values = [v for v in values if v is not None]
    return round(sum(values) / len(values), 1) if values else None


def stats(lang=None):
    """Totals and averages per language, for the learner's speech-rate overview."""
    rows = [e for e in store.STATE.get("speech_log", []) if lang in (None, e["lang"])]
    by_lang = {}
    for e in rows:
        by_lang.setdefault(e["lang"], []).append(e)
    return {
        "lines": len(rows),
        "total_recorded_seconds": round(sum(e["recorded_seconds"] or (e["client_ms"] or 0) / 1000 for e in rows), 1),
        "languages": {
            code: {
                "lines": len(items),
                "unit": items[-1]["unit"],
                "avg_rate_per_min": _mean(e["rate_per_min"] for e in items),
                "avg_recorded_rate_per_min": _mean(e["recorded_rate_per_min"] for e in items),
                "avg_pronunciation": _mean(e["pronunciation"] for e in items),
                "avg_fluency": _mean(e["fluency"] for e in items),
            }
            for code, items in by_lang.items()
        },
    }


def entries(lesson_id=None, limit=200):
    rows = [e for e in store.STATE.get("speech_log", []) if lesson_id in (None, e["lesson_id"])]
    return rows[-limit:]


def forget(participant):
    """Removes every logged row of one participant (used when an account is deleted)."""
    try:
        lines = LOG_FILE.read_text(encoding="utf-8").splitlines()
    except OSError:
        return 0
    keep = []
    for line in lines:
        try:
            if json.loads(line).get("participant") == participant:
                continue
        except ValueError:
            pass
        keep.append(line)
    try:
        LOG_FILE.write_text("".join(l + "\n" for l in keep), encoding="utf-8")
    except OSError:
        return 0
    return len(lines) - len(keep)
