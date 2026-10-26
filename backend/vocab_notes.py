"""Vocab Notes: the words a learner saved from the flashcards, plus the review schedule.

Review uses a simple spaced-repetition ladder (Leitner boxes):
    box 0  new, or answered wrongly  -> due again right away
    box 1  answered right once       -> due after 1 day
    box 2  twice in a row            -> due after 3 days
    box 3  three times in a row      -> due after 7 days
    box 4  four times in a row       -> due after 14 days, counts as "mastered"
A wrong answer sends the word back to box 0.
"""
import random
import time

import content
import languages
import store

CEFR_ORDER = content.CEFR_LEVELS
BOX_DAYS = [0, 1, 3, 7, 14]
MASTERED_BOX = 4
DAY = 86400


def now():
    return time.time()


def _key(lesson_id, vocab_id):
    return f"{lesson_id}:{vocab_id}"


def _find(lesson_id, vocab_id):
    """(lesson, vocab) from the lesson files, or None if the word no longer exists."""
    try:
        lesson = content.lesson(lesson_id)
    except content.ContentError:
        return None
    if lesson is None:
        return None
    vocab = next((v for v in lesson["vocab"] if v["id"] == vocab_id), None)
    return (lesson, vocab) if vocab else None


def cefr_of(lesson, vocab):
    return vocab.get("cefr") or lesson.get("cefr") or content.DEFAULT_CEFR


def status_of(note):
    if note["reviews"] == 0:
        return "new"
    return "mastered" if note["box"] >= MASTERED_BOX else "learning"


def is_due(note, t=None):
    return note["due_at"] <= (now() if t is None else t)


def note_out(note, lesson, vocab, t=None):
    return {
        "id": _key(note["lesson_id"], note["vocab_id"]),
        "lesson_id": note["lesson_id"], "vocab_id": note["vocab_id"],
        "word": vocab["word"], "ipa": vocab["ipa"], "pos": vocab["pos"], "meaning": vocab["meaning"],
        "examples": vocab["examples"], "cefr": cefr_of(lesson, vocab),
        "status": status_of(note), "box": note["box"], "due": is_due(note, t),
        "due_at": note["due_at"], "added_at": note["added_at"],
        "reviews": note["reviews"], "correct": note["correct"],
    }


def _live_notes():
    """[(note, lesson, vocab)] for every saved word that still exists in the lesson files."""
    out = []
    for note in store.STATE["notes"].values():
        found = _find(note["lesson_id"], note["vocab_id"])
        if found:
            out.append((note, *found))
    return out


def add(lesson_id, vocab_id):
    """Saves a word. Saving it twice changes nothing. Raises LookupError for an unknown word."""
    found = _find(lesson_id, vocab_id)
    if not found:
        raise LookupError("Unknown word.")
    notes = store.STATE["notes"]
    key = _key(lesson_id, vocab_id)
    if key not in notes:
        t = now()
        notes[key] = {"lesson_id": lesson_id, "vocab_id": vocab_id, "added_at": t,
                      "box": 0, "due_at": t, "reviews": 0, "correct": 0}
    return note_out(notes[key], *found)


def remove(lesson_id, vocab_id):
    return store.STATE["notes"].pop(_key(lesson_id, vocab_id), None) is not None


def vocab_ids(lesson_id):
    return sorted(n["vocab_id"] for n, _, _ in _live_notes() if n["lesson_id"] == lesson_id)


def record_review(lesson_id, vocab_id, correct):
    note = store.STATE["notes"].get(_key(lesson_id, vocab_id))
    found = _find(lesson_id, vocab_id)
    if note is None or not found:
        raise LookupError("This word isn't in your notes.")
    note["reviews"] += 1
    if correct:
        note["correct"] += 1
        note["box"] = min(note["box"] + 1, MASTERED_BOX)
    else:
        note["box"] = 0
    t = now()
    note["due_at"] = t + BOX_DAYS[note["box"]] * DAY
    return note_out(note, *found, t)


def _sort_word(word):
    for article in ("le ", "la ", "les ", "l'", "un ", "une ", "des "):
        if word.lower().startswith(article):
            return word[len(article):].lower()
    return word.lower()


def overview():
    """Everything the Vocab Notes screen shows: totals and the words grouped by lesson (scenario),
    each group sorted from A1 to C2 (then alphabetically)."""
    t = now()
    lang = store.current_lang()
    live = [x for x in _live_notes() if x[1]["lang"] == lang]  # Vocab Notes show the language being learned
    groups = {}
    for note, lesson, vocab in live:
        g = groups.setdefault(lesson["id"], {
            "id": lesson["id"], "title": lesson["title"], "emoji": lesson["emoji"],
            "level": lesson["level"], "no": lesson["no"],
            "level_title": content.levels(lesson["lang"]).get(lesson["level"], {}).get("title", ""),
            "words": [],
        })
        g["words"].append(note_out(note, lesson, vocab, t))
    for g in groups.values():
        g["words"].sort(key=lambda w: (CEFR_ORDER.index(w["cefr"]), _sort_word(w["word"])))
        g["due"] = sum(1 for w in g["words"] if w["due"])
        g["mastered"] = sum(1 for w in g["words"] if w["status"] == "mastered")
    ordered = sorted(groups.values(), key=lambda g: (g["level"], g["no"]))
    words = [w for g in ordered for w in g["words"]]
    return {
        "locale": languages.get(lang)["locale"],
        "summary": {
            "total": len(words),
            "due": sum(1 for w in words if w["due"]),
            "new": sum(1 for w in words if w["status"] == "new"),
            "learning": sum(1 for w in words if w["status"] == "learning"),
            "mastered": sum(1 for w in words if w["status"] == "mastered"),
        },
        "groups": ordered,
    }


# ---- Review sessions -------------------------------------------------------------------
def _pool(lang):
    """Every word in the lesson files of one language. Wrong answers for the quiz are taken from here."""
    pool = []
    for _, spec in content.levels(lang).items():
        for lid, _title in spec["lessons"]:
            try:
                lesson = content.lesson(lid)
            except content.ContentError:
                continue
            if lesson:
                pool.extend(lesson["vocab"])
    return pool


def _card(note, lesson, vocab):
    ex = vocab["examples"][0] if vocab["examples"] else None
    return {
        "id": _key(note["lesson_id"], note["vocab_id"]),
        "lesson_id": note["lesson_id"], "vocab_id": note["vocab_id"],
        "word": vocab["word"], "ipa": vocab["ipa"], "pos": vocab["pos"], "meaning": vocab["meaning"],
        "cefr": cefr_of(lesson, vocab), "lesson_title": lesson["title"], "locale": lesson["locale"],
        "example": {"fr": ex["fr"], "en": ex["en"]} if ex else None,
    }


def _question(card, pool, rng):
    kind = rng.choice(["meaning", "listen"])
    field = "meaning" if kind == "meaning" else "word"
    seen = {card[field].lower()}
    wrong = []
    candidates = pool[:]
    rng.shuffle(candidates)
    for v in candidates:
        if v[field].lower() in seen or v["word"].lower() == card["word"].lower():
            continue
        seen.add(v[field].lower())
        wrong.append(v[field])
        if len(wrong) == 3:
            break
    if not wrong:
        raise ValueError("There aren't enough words yet to build a quiz.")
    texts = wrong + [card[field]]
    rng.shuffle(texts)
    options = [{"id": "abcd"[i], "text": t} for i, t in enumerate(texts)]
    answer_id = next(o["id"] for o in options if o["text"] == card[field])
    return {**card, "kind": kind, "options": options, "answer_id": answer_id}


def session(mode="cards", scope="due", group=None, limit=10, rng=None):
    """The words to practice now. scope "due" = only words that are due, "all" = every saved word.
    mode "cards" gives flashcards; "quiz" gives multiple-choice questions.
    Raises ValueError when a quiz can't be built."""
    rng = rng or random.Random()
    t = now()
    lang = store.current_lang()
    picked = [(n, l, v) for n, l, v in _live_notes()
              if l["lang"] == lang and (group is None or n["lesson_id"] == group) and (scope == "all" or is_due(n, t))]
    picked.sort(key=lambda x: x[0]["due_at"])
    picked = picked[:limit]
    rng.shuffle(picked)
    cards = [_card(*p) for p in picked]
    if mode == "quiz" and cards:
        pool = _pool(store.current_lang())
        return [_question(c, pool, rng) for c in cards]
    return cards
