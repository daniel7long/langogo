import json
import re
import time
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

import content
import scoring
import store
from routers.courses import MAX_AUDIO_BYTES, MIN_AUDIO_BYTES, _extension

router = APIRouter(prefix="/tests", tags=["tests"])

# --- Question bank (move to the database later) -----------------------------
# `points` sum to 100, so the score is a plain 0-100 number.
# `correct` is never sent to the client.
QUESTIONS = [
    {"id": "q1", "points": 10, "correct": "a",
     "prompt": "Complète la phrase : Je ___ un chat.",
     "options": {"a": "ai", "b": "est", "c": "suis"}},
    {"id": "q2", "points": 10, "correct": "b",
     "prompt": "Nous ___ au cinéma hier soir.",
     "options": {"a": "avons allé", "b": "sommes allés", "c": "allons"}},
    {"id": "q3", "points": 12, "correct": "c",
     "prompt": "Elle ___ du pain à la boulangerie.",
     "options": {"a": "achètes", "b": "achetons", "c": "achète"}},
    {"id": "q4", "points": 14, "correct": "a",
     "prompt": "Si j'avais plus de temps, je ___ plus souvent.",
     "options": {"a": "voyagerais", "b": "voyagerai", "c": "voyageais"}},
    # The last three are meant to be hard (B2-C1): subjunctive after a negated opinion, past conditional,
    # and the subjunctive "quel que soit". Every wrong option is a plausible mistake.
    {"id": "q5", "points": 16, "correct": "c",
     "prompt": "Je ne pense pas qu'elle ___ la vérité sur cet accident.",
     "options": {"a": "sait", "b": "saura", "c": "sache"}},
    {"id": "q6", "points": 18, "correct": "b",
     "prompt": "Si tu m'avais prévenu hier, je ___ te chercher à la gare.",
     "options": {"a": "viendrais", "b": "serais venu", "c": "suis venu"}},
    {"id": "q7", "points": 20, "correct": "a",
     "prompt": "Quelle que ___ la raison de son absence, nous devons respecter sa décision.",
     "options": {"a": "soit", "b": "est", "c": "sera"}},
]
BY_ID = {q["id"]: q for q in QUESTIONS}

# (upper bound exclusive, CEFR level). The French course has 36 lessons (9 levels): Levels 1-2 are A1,
# 3-4 A2, 5-6 B1, 7-8 B2 and 9 is C1, so the labels switch at 23, 45, 67 and 89.
LEVELS = [(23, "A1"), (45, "A2"), (67, "B1"), (89, "B2"), (101, "C1")]

# The speaking step: read this sentence aloud (11 words). It is scored like a dialogue line.
# The sentence lives in content/fr/level_test.json so generate_tts.py also makes its voice recording.
SPEAKING_SENTENCE = json.loads((content.CONTENT_DIR / "fr" / "level_test.json").read_text(encoding="utf-8"))["speaking_sentence"]
SPEAKING_INSTRUCTIONS = "Tap Listen to hear the sentence, then read it aloud, clearly and at your own pace. You have one try."
# The final score counts the questions 70% and the speaking 30%.
WEIGHT_QUESTIONS, WEIGHT_SPEAKING = 0.7, 0.3

# Suggested daily practice time shown on the result screen (placeholder values).
MINUTES_PER_DAY = {"A1": 20, "A2": 15, "B1": 15, "B2": 10, "C1": 10}


# --- Schemas -----------------------------------------------------------------
class Option(BaseModel):
    id: str
    text: str


class QuestionOut(BaseModel):
    id: str
    prompt: str
    options: list[Option]


class SpeakingOut(BaseModel):
    instructions: str
    sentence: str


class TestOut(BaseModel):
    title: str
    time_limit_minutes: int
    questions: list[QuestionOut]
    speaking: SpeakingOut


class AnswerIn(BaseModel):
    question_id: str
    option_id: str


class SubmitIn(BaseModel):
    answers: list[AnswerIn] = Field(..., min_length=1)


class SubmitOut(BaseModel):
    """After the sentence-completion questions: the speaking step comes next."""
    id: str
    completion_score: int
    correct_count: int
    total_questions: int
    next: str = "speaking"


class ResultOut(BaseModel):
    id: str
    score: int                      # 70% the sentence-completion score + 30% the speaking score
    max_score: int
    level: str                      # CEFR label shown on the gauge
    correct_count: int
    total_questions: int
    recommended_minutes_per_day: int
    completion_score: int
    speech_score: int
    start_level: int                # where the learner starts in the course
    start_lesson_no: int
    start_lesson_id: str
    start_lesson_title: str


# --- Test records ------------------------------------------------------------
# Kept in the learner's saved state (so they survive a server restart): state["level_tests"][id].
def _tests():
    return store.STATE.setdefault("level_tests", {})


def _remember(record):
    tests = _tests()
    tests[record["id"]] = record
    for old in list(tests)[:-5]:  # keep the latest 5
        del tests[old]


def level_for(score: int) -> str:
    return next(level for limit, level in LEVELS if score < limit)


# --- Placement: which lesson does a score start at? ---------------------------
# The course is a ladder of lessons (French: 9 levels x 4 lessons = 36). The score (0-100) is spread evenly
# over that ladder, so each lesson owns about 2.8 points: 0-2 starts at Level 1 Lesson 1, 50 at Level 5 Lesson 3,
# 70 at Level 7 Lesson 2 and 98-100 at Level 9 Lesson 4. It never moves a learner backwards.
def _ladder(lang):
    out = []
    for lv, spec in sorted(content.levels(lang).items()):
        for no, (lid, title) in enumerate(spec["lessons"], start=1):
            out.append({"level": lv, "no": no, "id": lid, "title": title})
    return out


def placement_index(score, size):
    return max(0, min(size - 1, int(score * size / 100)))


def place_learner(lang, score):
    """Moves the learner to the lesson their score earns and returns that lesson. Lessons before it in the same
    level are marked as done; earlier levels count as done automatically."""
    ladder = _ladder(lang)
    target = ladder[placement_index(score, len(ladder))]
    state = store.STATE
    done = set(state["completed"])
    level = store.level_of(lang)
    here = next((i for i, l in enumerate(ladder) if l["level"] == level and l["id"] not in done), len(ladder) - 1)
    if ladder.index(target) <= here and (done or level > 1):
        return ladder[here]  # a learner who already got further keeps their place
    store.set_level(lang, target["level"])
    for l in ladder:
        if l["level"] == target["level"] and l["no"] < target["no"] and l["id"] not in state["completed"]:
            state["completed"].append(l["id"])
    return target


# --- Endpoints ---------------------------------------------------------------
@router.get("/french", response_model=TestOut)
def get_french_test():
    return TestOut(
        title="French Level Test",
        time_limit_minutes=1,
        questions=[
            QuestionOut(
                id=q["id"],
                prompt=q["prompt"],
                options=[Option(id=k, text=v) for k, v in q["options"].items()],
            )
            for q in QUESTIONS
        ],
        speaking=SpeakingOut(instructions=SPEAKING_INSTRUCTIONS, sentence=SPEAKING_SENTENCE),
    )


@router.post("/french/submit", response_model=SubmitOut)
def submit_french_test(body: SubmitIn):
    seen = set()
    score = correct_count = 0

    for ans in body.answers:
        q = BY_ID.get(ans.question_id)
        if q is None:
            raise HTTPException(status_code=422, detail=f"Unknown question: {ans.question_id}")
        if ans.question_id in seen:
            raise HTTPException(status_code=422, detail=f"Duplicate answer: {ans.question_id}")
        if ans.option_id not in q["options"]:
            raise HTTPException(status_code=422, detail=f"Unknown option for {ans.question_id}")
        seen.add(ans.question_id)

        if ans.option_id == q["correct"]:
            score += q["points"]
            correct_count += 1

    # Unanswered questions simply score 0.
    record = {"id": uuid4().hex, "stage": "speaking", "completion_score": score,
              "correct_count": correct_count, "total_questions": len(QUESTIONS)}
    _remember(record)
    return SubmitOut(id=record["id"], completion_score=score, correct_count=correct_count,
                     total_questions=len(QUESTIONS))


def _result_out(record):
    return ResultOut(**{k: record[k] for k in ResultOut.model_fields})


@router.post("/french/{test_id}/speak", response_model=ResultOut)
async def speak_french_test(test_id: str, duration_ms: int | None = Form(None), audio: UploadFile = File(...)):
    """The speaking step: scores one recording like a dialogue line, then works out the final score
    (the mean of the two parts) and the lesson the learner starts at. There is only one try: once a result
    exists, the same result is returned."""
    record = _tests().get(test_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Test not found. Please start the test again.")
    if record["stage"] == "done":
        return _result_out(record)

    data = await audio.read(MAX_AUDIO_BYTES + 1)
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="The recording is too long.")
    if len(data) < MIN_AUDIO_BYTES:
        raise HTTPException(status_code=422, detail="The recording is empty. Please try again.")

    folder = store.user_recordings_dir() / "level-test"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{re.sub(r'[^A-Za-z0-9_-]', '_', test_id)}-{int(time.time() * 1000)}.{_extension(audio)}"
    path.write_bytes(data)
    try:
        result = scoring.score_speech(path, SPEAKING_SENTENCE, "fr")
    except scoring.ScoringError as e:
        raise HTTPException(status_code=e.status, detail=str(e))

    # The same rating as a dialogue line: the mean of fluency and pronunciation.
    speech_score = round((result["fluency"] + result["pronunciation"]) / 2)
    final = round(WEIGHT_QUESTIONS * record["completion_score"] + WEIGHT_SPEAKING * speech_score)
    level = level_for(final)
    lesson = place_learner("fr", final)
    record.update({
        "stage": "done", "speech_score": speech_score, "score": final, "max_score": 100, "level": level,
        "recommended_minutes_per_day": MINUTES_PER_DAY[level],
        "start_level": lesson["level"], "start_lesson_no": lesson["no"],
        "start_lesson_id": lesson["id"], "start_lesson_title": lesson["title"],
    })
    _remember(record)
    return _result_out(record)


@router.get("/french/results/{result_id}", response_model=ResultOut)
def get_french_result(result_id: str):
    record = _tests().get(result_id)
    if record is None or record.get("stage") != "done":
        raise HTTPException(status_code=404, detail="Result not found")
    return _result_out(record)
