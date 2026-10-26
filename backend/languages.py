"""The languages a learner can choose on the first screen.

To add a language: add one entry here, then create backend/content/<id>/levels.json and
backend/content/<id>/lessons/<id>-<level>-<lesson>.json (see content/README.md), and add a flag in
frontend/components/Flag.js.

  id       short code, also the prefix of every lesson id ("fr-1-1" = French, level 1, lesson 1)
  locale   used for the built-in voice and for Azure pronunciation assessment (BCP-47)
  unit     what the speech rate counts: "words" or "characters" (Chinese, Japanese and Korean
           are counted in characters because they are not written with spaces)
"""

LANGUAGES = [
    {"id": "fr", "name": "French", "native": "Français", "locale": "fr-FR", "unit": "words"},
    {"id": "es", "name": "Spanish", "native": "Español", "locale": "es-ES", "unit": "words"},
    {"id": "zh", "name": "Mandarin", "native": "中文", "locale": "zh-CN", "unit": "characters"},
    {"id": "ko", "name": "Korean", "native": "한국어", "locale": "ko-KR", "unit": "characters"},
    {"id": "ja", "name": "Japanese", "native": "日本語", "locale": "ja-JP", "unit": "characters"},
    {"id": "de", "name": "German", "native": "Deutsch", "locale": "de-DE", "unit": "words"},
]
BY_ID = {l["id"]: l for l in LANGUAGES}
DEFAULT = "fr"


def get(lang_id):
    """The language entry, or the default language when the id is unknown."""
    return BY_ID.get(lang_id) or BY_ID[DEFAULT]


def of_lesson(lesson_id):
    """The language a lesson id belongs to ("es-1-1" -> Spanish), or None."""
    prefix = (lesson_id or "").split("-", 1)[0]
    return BY_ID.get(prefix)
