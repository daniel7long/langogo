from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

import vocab_notes as notes

router = APIRouter(prefix="/notes", tags=["notes"])


class ReviewIn(BaseModel):
    correct: bool


@router.get("")
def get_notes():
    """All saved words grouped by lesson, with totals."""
    return notes.overview()


@router.get("/review")
def review_session(
    mode: Literal["cards", "quiz"] = Query("cards"),
    scope: Literal["due", "all"] = Query("due"),
    group: str | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
):
    """Words to practice now (flashcards or a multiple-choice quiz)."""
    try:
        return notes.session(mode=mode, scope=scope, group=group, limit=limit)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/lesson/{lesson_id}")
def lesson_notes(lesson_id: str):
    """Which words of one lesson are saved (the flashcards use this for the Added state)."""
    return {"vocab_ids": notes.vocab_ids(lesson_id)}


@router.put("/{lesson_id}/{vocab_id}")
def add_note(lesson_id: str, vocab_id: str):
    try:
        return notes.add(lesson_id, vocab_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{lesson_id}/{vocab_id}")
def remove_note(lesson_id: str, vocab_id: str):
    return {"removed": notes.remove(lesson_id, vocab_id)}


@router.post("/{lesson_id}/{vocab_id}/review")
def review_note(lesson_id: str, vocab_id: str, body: ReviewIn):
    """Record one review answer and move the word on the schedule."""
    try:
        return notes.record_review(lesson_id, vocab_id, body.correct)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
