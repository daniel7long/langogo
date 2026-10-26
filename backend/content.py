"""Loads the lesson content that is authored as JSON files in backend/content/.

    content/<lang>/levels.json          which levels exist and which lessons they list (in order)
    content/<lang>/lessons/<id>.json    the full content of one lesson (files starting with _ are ignored)
    content/audio/<id>/<file>           optional recorded voice for a dialogue line, served at /media/...
<lang> is a language code from languages.py (fr, es, zh, ko, ja, de); lesson ids look like "fr-1-1"
(language, level, lesson).

Files are re-read automatically when they change, so you do not need to restart the server
after editing a lesson. Run `python validate_content.py` to check everything at once.
"""
import json
from pathlib import Path

import languages

CONTENT_DIR = Path(__file__).parent / "content"
AUDIO_DIR = CONTENT_DIR / "audio"
AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".ogg", ".webm"}
CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
DEFAULT_CEFR = "A2"


class ContentError(Exception):
    """A content file is missing or wrongly filled in. The message says what to fix."""


_cache = {}  # path -> (mtime_ns, parsed)


def _read_json(path):
    try:
        mtime = path.stat().st_mtime_ns
    except FileNotFoundError:
        raise ContentError(f"{path.name} was not found.")
    hit = _cache.get(path)
    if hit and hit[0] == mtime:
        return hit[1]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ContentError(f"{path.name} is not valid JSON (line {e.lineno}, column {e.colno}): {e.msg}")
    _cache[path] = (mtime, data)
    return data


def _str(obj, key, where, required=True):
    v = obj.get(key)
    if v is None or v == "":
        if required:
            raise ContentError(f"{where}: \"{key}\" is missing.")
        return None
    if not isinstance(v, str):
        raise ContentError(f"{where}: \"{key}\" must be text.")
    return v


def levels_file(lang):
    return CONTENT_DIR / lang / "levels.json"


def lessons_dir(lang):
    return CONTENT_DIR / lang / "lessons"


def levels(lang=languages.DEFAULT):
    """{5: {"title": ..., "lessons": [(lesson_id, title), ...]}, ...} for one language.
    A language without a levels.json yet gives {}."""
    path = levels_file(lang)
    if not path.is_file():
        return {}
    raw = _read_json(path)
    out, seen = {}, set()
    for i, lv in enumerate(raw.get("levels", [])):
        where = f"{lang}/levels.json, entry {i + 1}"
        number = lv.get("level")
        if not isinstance(number, int) or number in out:
            raise ContentError(f"{where}: \"level\" must be a unique whole number.")
        lessons = []
        for j, ls in enumerate(lv.get("lessons", [])):
            w = f"{where}, lesson {j + 1}"
            lid, title = _str(ls, "id", w), _str(ls, "title", w)
            if lid in seen:
                raise ContentError(f"{w}: lesson id \"{lid}\" is used twice.")
            seen.add(lid)
            lessons.append((lid, title))
        out[number] = {"title": _str(lv, "title", where), "lessons": lessons}
    return out


def find_in_levels(lesson_id):
    """(level_number, position starting at 1, title) or None."""
    lang = languages.of_lesson(lesson_id)
    if lang is None:
        return None
    for number, spec in levels(lang["id"]).items():
        for pos, (lid, title) in enumerate(spec["lessons"], start=1):
            if lid == lesson_id:
                return number, pos, title
    return None


def _build_lesson(lesson_id, raw, level, no, title):
    lang = languages.of_lesson(lesson_id)
    where = f"{lang['id']}/lessons/{lesson_id}.json"
    if raw.get("id") not in (None, lesson_id):
        raise ContentError(f"{where}: \"id\" must match the file name.")
    lesson_cefr = raw.get("cefr", DEFAULT_CEFR)
    if lesson_cefr not in CEFR_LEVELS:
        raise ContentError(f"{where}: \"cefr\" must be one of {', '.join(CEFR_LEVELS)}.")
    vocab = raw.get("vocab", [])
    for k, v in enumerate(vocab, start=1):
        w = f"{where}, vocab {k}"
        v.setdefault("id", f"v{k}")
        for key in ("word", "ipa", "pos", "meaning"):
            _str(v, key, w)
        if v.get("cefr") is not None and v["cefr"] not in CEFR_LEVELS:
            raise ContentError(f"{w}: \"cefr\" must be one of {', '.join(CEFR_LEVELS)}.")
        if not v.get("examples"):
            raise ContentError(f"{w}: add at least one example.")
        for e in v["examples"]:
            # the sentence in the language being learned is "target" ("fr" is accepted too)
            e["target"] = e["fr"] = _str(e, "target", w, required=False) or _str(e, "fr", w)
            _str(e, "en", w)

    dialogue = raw.get("dialogue", [])
    if not dialogue:
        raise ContentError(f"{where}: \"dialogue\" is empty.")
    ids = set()
    for k, t in enumerate(dialogue, start=1):
        w = f"{where}, dialogue line {k}"
        tid = _str(t, "id", w)
        if tid in ids:
            raise ContentError(f"{w}: id \"{tid}\" is used twice.")
        ids.add(tid)
        _str(t, "speaker", w)
        if t.get("role") not in ("npc", "you"):
            raise ContentError(f"{w}: \"role\" must be \"npc\" or \"you\".")
        text = _str(t, "text", w)
        _str(t, "en", w, required=False)  # English translation, shown by the "Show translation" switch
        for g in t.get("glosses", []):
            gt = _str(g, "text", w)
            _str(g, "pos", w), _str(g, "meaning", w)
            if gt not in text:
                raise ContentError(f"{w}: gloss \"{gt}\" does not appear in the line's text "
                                   f"(it must be copied exactly, including capitals).")
        audio = _str(t, "audio", w, required=False)
        if audio:
            if Path(audio).suffix.lower() not in AUDIO_EXTS:
                raise ContentError(f"{w}: audio must be one of {', '.join(sorted(AUDIO_EXTS))}.")
            if not (AUDIO_DIR / lesson_id / audio).is_file():
                raise ContentError(f"{w}: audio file content/audio/{lesson_id}/{audio} was not found.")
    if not any(t["role"] == "you" for t in dialogue):
        raise ContentError(f"{where}: needs at least one line with role \"you\".")

    words = raw.get("practice_words", [])
    for k, pw in enumerate(words, start=1):
        pw.setdefault("id", f"w{k}")
        _str(pw, "text", f"{where}, practice word {k}"), _str(pw, "tip", f"{where}, practice word {k}")

    maxf = raw.get("max_flowers", 35)
    if not isinstance(maxf, int) or maxf <= 0:
        raise ContentError(f"{where}: \"max_flowers\" must be a positive whole number.")

    return {
        "id": lesson_id, "lang": lang["id"], "locale": lang["locale"], "unit": lang["unit"],
        "language": lang["name"], "level": level, "no": no, "title": title,
        "emoji": raw.get("emoji", "📘"), "max_flowers": maxf, "cefr": lesson_cefr,
        "vocab": vocab, "dialogue": dialogue, "practice_words": words,
    }


def lesson(lesson_id):
    """The lesson dict, or None when the lesson isn't listed or has no file yet.
    Raises ContentError when the file exists but is wrongly filled in."""
    if not lesson_id or lesson_id.startswith("_") or "/" in lesson_id or "\\" in lesson_id or ".." in lesson_id:
        return None
    pos = find_in_levels(lesson_id)
    path = lessons_dir(languages.of_lesson(lesson_id)["id"] if pos else "fr") / f"{lesson_id}.json"
    if pos is None or not path.is_file():
        return None
    level, no, title = pos
    return _build_lesson(lesson_id, _read_json(path), level, no, title)


def lesson_out(lesson_id):
    """Like lesson(), but each dialogue line gets an `audio_url` ("/media/<lesson>/<file>" or None)."""
    ls = lesson(lesson_id)
    if ls is None:
        return None
    out = dict(ls)
    out["dialogue"] = [
        {**t, "audio_url": f"/media/{lesson_id}/{t['audio']}" if t.get("audio") else None}
        for t in ls["dialogue"]
    ]
    return out


def report():
    """Status of every lesson listed in any levels.json (used by validate_content.py and /dev/content)."""
    rows = []
    for lang in languages.LANGUAGES:
        lid_lang = lang["id"]
        for number, spec in levels(lid_lang).items():
            for pos, (lid, title) in enumerate(spec["lessons"], start=1):
                base = {"lang": lid_lang, "id": lid, "level": number, "no": pos, "title": title}
                path = lessons_dir(lid_lang) / f"{lid}.json"
                if not path.is_file():
                    rows.append({**base, "status": "missing", "detail": f"no file content/{lid_lang}/lessons/{lid}.json yet"})
                    continue
                try:
                    ls = lesson(lid)
                    you = sum(1 for t in ls["dialogue"] if t["role"] == "you")
                    rows.append({**base, "status": "ok",
                                 "detail": f"{len(ls['vocab'])} words, {len(ls['dialogue'])} lines ({you} yours)"})
                except ContentError as e:
                    rows.append({**base, "status": "error", "detail": str(e)})
        listed = {r["id"] for r in rows if r["lang"] == lid_lang}
        for path in sorted(lessons_dir(lid_lang).glob("*.json")):
            if not path.name.startswith("_") and path.stem not in listed:
                rows.append({"lang": lid_lang, "id": path.stem, "level": None, "no": None, "title": "",
                             "status": "unlisted", "detail": "file exists but is not listed in levels.json"})
    return rows


def ready_count(lang):
    """How many lessons of a language have a content file."""
    return sum(1 for _, spec in levels(lang).items() for lid, _t in spec["lessons"]
               if (lessons_dir(lang) / f"{lid}.json").is_file())
