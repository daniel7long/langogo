# How to add lesson content

All lesson content lives in this folder. You never need to touch Python code.

```
backend/content/
  _TEMPLATE.json           copy this to start a new lesson
  fr/                      one folder per language: fr, es, zh, ko, ja, de (codes from backend/languages.py)
    levels.json            which levels exist and which lessons they list, in order
    lessons/
      fr-1-1.json          one file per lesson, named <language>-<level>-<lesson>
  es/ zh/ ko/ ja/ de/      same layout (each has 3 levels × 4 lessons written)
  audio/
    fr-1-1/t1.mp3          optional recorded voice for a dialogue line
```

## Add a lesson (4 steps)

1. **Make sure the lesson is listed in `<language>/levels.json`.** Lessons are shown in the order listed.
   Example: `{ "id": "es-1-2", "title": "Introducing yourself" }`.
2. **Copy `_TEMPLATE.json` to `<language>/lessons/<id>.json`**, e.g. `es/lessons/es-1-2.json`.
3. **Fill it in** (fields below).
4. **Check it:** open a terminal in `backend` and run `python validate_content.py`
   (or open http://localhost:8000/dev/content). Errors say which file and line to fix.
   No server restart is needed: the app reads the file again whenever it changes.

## Add a language

1. Add an entry to `backend/languages.py` (code, name, native name, locale, `words` or `characters`).
2. Create `content/<code>/levels.json` and `content/<code>/lessons/`.
3. Add its flag to `frontend/components/Flag.js`, and its button labels to `BUTTONS` in
   `frontend/screens/LessonPrepScreen.js`.

## Lesson fields

| Field | Meaning |
|-------|---------|
| `emoji`, `max_flowers` | Icon in the records list; the "To Get N" reward shown at the top |
| `cefr` | Default CEFR level of the lesson's words: A1, A2, B1, B2, C1 or C2 (A2 if left out). Used to sort the Vocab Notes |
| `vocab[]` | Words for the preparation screen: `id`, `word`, `ipa` (for Chinese, Japanese and Korean put pinyin, romaji or romanization here), `pos`, `meaning`, `examples[]` of `{target, en}` (`fr` is accepted instead of `target`), and an optional `cefr` for this word (overrides the lesson's) |
| `dialogue[]` | The conversation, top to bottom (see below) |
| `practice_words[]` | Fallback words to retry. The result screen normally practises the words and phrase you really scored lowest on; these are used only if there is no scoring data |

Each `dialogue` line:

| Field | Meaning |
|-------|---------|
| `id` | `t1`, `t2`, ... unique inside the lesson |
| `speaker` | Name shown under the avatar (`Jenny`, `You`) |
| `role` | `"npc"` = the other person (plays automatically); `"you"` = the learner speaks this line |
| `text` | The sentence in the language being learned |
| `en` | The English translation, shown under the line when the learner turns on "Show translation". Optional, but recommended |
| `glosses` | Optional. Words that get a dashed underline and a tap-for-meaning chip: `{text, pos, meaning}`. `text` must be copied exactly from the sentence |
| `audio` | Optional. File name in `audio/<lesson id>/`, e.g. `"t1.mp3"`. Without it the phone's built-in French voice reads the line |

A lesson needs at least one `"you"` line. Normal dialogues alternate npc / you.

## Voice recordings (optional)

Put the file at `audio/<lesson id>/<file>` (mp3, m4a, wav, ogg or webm) and add `"audio": "<file>"` to the line.
The app plays it at `http://localhost:8000/media/<lesson id>/<file>`.

## Notes

- A lesson listed in `levels.json` with no file yet shows "content isn't available yet" in the app.
- Lessons are unlocked in order inside a level; finishing the last lesson of a level unlocks the next level.
- Learners' own recordings are saved in `backend/recordings/` (not here). Keep that folder out of Git.
- Topic lessons (Favorite topics) are still placeholders in `store.py`.
