import re
import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

import content
import scoring
import speech_log
import store
from paths import RECORDINGS_DIR

router = APIRouter(tags=["courses"])

MAX_AUDIO_BYTES = 10 * 1024 * 1024
MIN_AUDIO_BYTES = 1000  # smaller than this is an empty / failed recording
AUDIO_TYPES = {"webm", "m4a", "mp4", "wav", "ogg", "mp3", "aac", "caf", "3gp"}


def _lesson_or_404(lesson_id: str):
    try:
        lesson = content.lesson_out(lesson_id)
    except content.ContentError as e:
        raise HTTPException(status_code=500, detail=f"Lesson content problem: {e}")
    if lesson is None:
        raise HTTPException(status_code=404, detail="This lesson's content isn't available yet.")
    if lesson["level"] > store.level_of(lesson["lang"]):
        raise HTTPException(status_code=403, detail="This lesson is still locked.")
    return lesson


def _extension(upload: UploadFile) -> str:
    name = (upload.filename or "").rsplit(".", 1)
    ext = name[-1].lower() if len(name) == 2 else ""
    if ext in AUDIO_TYPES:
        return ext
    ctype = (upload.content_type or "").lower()
    for key, value in (("webm", "webm"), ("mp4", "m4a"), ("m4a", "m4a"), ("wav", "wav"),
                       ("ogg", "ogg"), ("mpeg", "mp3"), ("aac", "aac")):
        if key in ctype:
            return value
    return "webm"


@router.get("/courses/current")
def current_course():
    return store.course_out()


@router.get("/lessons/{lesson_id}")
def get_lesson(lesson_id: str):
    return _lesson_or_404(lesson_id)


@router.post("/lessons/{lesson_id}/speak")
async def score_turn(lesson_id: str, turn_id: str = Form(...), duration_ms: int | None = Form(None),
                     audio: UploadFile = File(...)):
    """Receive the recording of one spoken line, save it, score it, log how long it took to say,
    and remember the result for the Complete screen."""
    lesson = _lesson_or_404(lesson_id)
    turn = next((t for t in lesson["dialogue"] if t["id"] == turn_id), None)
    if turn is None or turn["role"] != "you":
        raise HTTPException(status_code=422, detail="Unknown speaking turn.")

    data = await audio.read(MAX_AUDIO_BYTES + 1)
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="The recording is too long.")
    if len(data) < MIN_AUDIO_BYTES:
        raise HTTPException(status_code=422, detail="The recording is empty. Please try again.")

    folder = store.user_recordings_dir() / re.sub(r"[^A-Za-z0-9_-]", "_", lesson_id)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{re.sub(r'[^A-Za-z0-9_-]', '_', turn_id)}-{int(time.time() * 1000)}.{_extension(audio)}"
    path.write_bytes(data)

    try:
        result = scoring.score_speech(path, turn["text"], lesson["lang"])
    except scoring.ScoringError as e:
        raise HTTPException(status_code=e.status, detail=str(e))

    client_ms = duration_ms if duration_ms and duration_ms > 0 else None
    recorded = result["audio_seconds"] or (client_ms / 1000 if client_ms else None)
    metrics = scoring.speech_metrics(turn["text"], lesson["unit"], recorded, result["speech_seconds"])
    speech_log.record(lesson["lang"], lesson_id, turn_id, turn["text"], client_ms, result, metrics)

    store.ATTEMPTS.setdefault(lesson_id, {})[turn_id] = {"text": turn["text"], "result": result, "metrics": metrics}
    # Speech timing and rate are research data: they are saved in the speech log on the server
    # (see speech_log.py) and are never sent back to the app.
    return {"turn_id": turn_id, "engine": result["engine"], "fluency": result["fluency"],
            "pronunciation": result["pronunciation"], "completeness": result["completeness"],
            "words": [{"text": w["text"], "score": w["score"]} for w in result["words"]]}


@router.post("/lessons/{lesson_id}/complete")
def complete_lesson(lesson_id: str):
    lesson = _lesson_or_404(lesson_id)
    state = store.STATE
    user = state["user"]

    attempts = store.ATTEMPTS.get(lesson_id, {})
    user_turns = [t["id"] for t in lesson["dialogue"] if t["role"] == "you"]
    missing = [t for t in user_turns if t not in attempts]
    if missing:
        raise HTTPException(status_code=422, detail="Some of your lines haven't been recorded yet.")
    results = [attempts[t]["result"] for t in user_turns]

    fluency = round(sum(r["fluency"] for r in results) / len(results))
    pronunciation = round(sum(r["pronunciation"] for r in results) / len(results))
    completeness = round(sum(r["completeness"] for r in results) / len(results))
    grade = store.grade_for((fluency + pronunciation) / 2)
    engine = "demo" if any(r["engine"] == "demo" for r in results) else "azure"

    # Flowers and level-ups are only given the first time a lesson is completed.
    lang = lesson["lang"]
    first_time = lesson_id not in state["completed"]
    earned = min(store.GRADE_FLOWERS[grade], lesson["max_flowers"]) if first_time else 0
    unlocked_level = None
    if first_time:
        state["completed"].append(lesson_id)
        levels = content.levels(lang)
        current = store.level_of(lang)
        level_lessons = [lid for lid, _ in levels.get(current, {}).get("lessons", [])]
        if (lesson_id in level_lessons
                and all(l in state["completed"] for l in level_lessons)
                and (current + 1) in levels):
            store.set_level(lang, current + 1)
            unlocked_level = current + 1

    user["flowers"] += earned
    user["weekly_flowers"] += earned
    store.touch_streak(user)
    # What to practise comes from what the learner really said: the weakest words and phrase.
    feedback = scoring.feedback_items([(attempts[t]["text"], attempts[t]["result"]) for t in user_turns])
    store.ATTEMPTS.pop(lesson_id, None)

    record = {
        "id": f"r{state['next_record']}",
        "lang": lang,
        "language": lesson["language"],
        "lesson_id": lesson_id,
        "level": lesson["level"],
        "lesson_no": lesson["no"],
        "title": lesson["title"],
        "emoji": lesson.get("emoji", "📘"),
        "grade": grade,
        "fluency": fluency,
        "pronunciation": pronunciation,
        "completeness": completeness,
        "engine": engine,
        "flowers_earned": earned,
        "unlocked_level": unlocked_level,
        "words": feedback or [dict(w) for w in lesson["practice_words"]],
    }
    state["next_record"] += 1
    state["records"].insert(0, record)
    return record
