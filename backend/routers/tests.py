from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/tests", tags=["tests"])

# --- Question bank (move to the database later) -----------------------------
# `points` sum to 100, so the score is a plain 0-100 number.
# `correct` is never sent to the client.
QUESTIONS = [
    {"id": "q1", "points": 10, "correct": "a",
     "prompt": "Complète la phrase : Je ___ un chat.",
     "options": {"a": "ai", "b": "est", "c": "suis"}},
    {"id": "q2", "points": 10, "correct": "a",
     "prompt": "Nous ___ au cinéma hier soir.",
     "options": {"a": "sommes allés", "b": "avons allé", "c": "allons"}},
    {"id": "q3", "points": 12, "correct": "a",
     "prompt": "Elle ___ du pain à la boulangerie.",
     "options": {"a": "achète", "b": "achètes", "c": "achetons"}},
    {"id": "q4", "points": 14, "correct": "a",
     "prompt": "Si j'avais plus de temps, je ___ plus souvent.",
     "options": {"a": "voyagerais", "b": "voyagerai", "c": "voyageais"}},
    {"id": "q5", "points": 16, "correct": "a",
     "prompt": "Les fleurs que tu m'___ sont magnifiques.",
     "options": {"a": "as offertes", "b": "as offert", "c": "avez offertes"}},
    {"id": "q6", "points": 18, "correct": "a",
     "prompt": "Il faut que tu ___ ton devoir avant de sortir.",
     "options": {"a": "finisses", "b": "finis", "c": "finiras"}},
    {"id": "q7", "points": 20, "correct": "b",
     "prompt": "Désolée pour le retard, mes amis et moi ___ ce matin à la gare.",
     "options": {"a": "avons trompé", "b": "nous sommes trompés", "c": "nous sommes trompées"}},
]
BY_ID = {q["id"]: q for q in QUESTIONS}

# (upper bound exclusive, CEFR level). Placeholder cutoffs, set so the Figma
# example (score 45) lands on A2. Tune them once you have real test data.
LEVELS = [(25, "A1"), (50, "A2"), (70, "B1"), (90, "B2"), (101, "C1")]

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


class TestOut(BaseModel):
    title: str
    time_limit_minutes: int
    questions: list[QuestionOut]


class AnswerIn(BaseModel):
    question_id: str
    option_id: str


class SubmitIn(BaseModel):
    answers: list[AnswerIn] = Field(..., min_length=1)


class ResultOut(BaseModel):
    id: str
    score: int
    max_score: int
    level: str
    correct_count: int
    total_questions: int
    recommended_minutes_per_day: int


# --- Result store ------------------------------------------------------------
# In memory for now: results are lost when the server restarts (including every
# --reload). Replace with a database table once users and auth exist.
RESULTS: dict[str, ResultOut] = {}


def level_for(score: int) -> str:
    return next(level for limit, level in LEVELS if score < limit)


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
    )


@router.post("/french/submit", response_model=ResultOut)
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
    level = level_for(score)
    result = ResultOut(
        id=uuid4().hex,
        score=score,
        max_score=100,
        level=level,
        correct_count=correct_count,
        total_questions=len(QUESTIONS),
        recommended_minutes_per_day=MINUTES_PER_DAY[level],
    )
    RESULTS[result.id] = result
    return result


@router.get("/french/results/{result_id}", response_model=ResultOut)
def get_french_result(result_id: str):
    result = RESULTS.get(result_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Result not found")
    return result
