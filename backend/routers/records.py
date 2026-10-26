import re
import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

import scoring
import store
from paths import RECORDINGS_DIR
from routers.courses import MAX_AUDIO_BYTES, MIN_AUDIO_BYTES, _extension

router = APIRouter(prefix="/records", tags=["records"])


def _record_or_404(record_id: str):
    record = next((r for r in store.STATE["records"] if r["id"] == record_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@router.get("")
def list_records(limit: int | None = None):
    lang = store.current_lang()
    rows = [r for r in store.STATE["records"] if r.get("lang", "fr") == lang]  # records of the language being learned
    return rows[:limit] if limit else rows


@router.get("/{record_id}")
def get_record(record_id: str):
    return _record_or_404(record_id)


@router.post("/{record_id}/retry")
async def retry_word(record_id: str, word_id: str = Form(...), audio: UploadFile = File(...)):
    """Receive a new recording of one word, save it, score it and give the retry reward."""
    record = _record_or_404(record_id)
    word = next((w for w in record["words"] if w["id"] == word_id), None)
    if word is None:
        raise HTTPException(status_code=404, detail="Word not found in this record")

    data = await audio.read(MAX_AUDIO_BYTES + 1)
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="The recording is too long.")
    if len(data) < MIN_AUDIO_BYTES:
        raise HTTPException(status_code=422, detail="The recording is empty. Please try again.")

    safe = lambda text: re.sub(r"[^A-Za-z0-9_-]", "_", text)
    folder = store.user_recordings_dir() / "retries"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{safe(record_id)}-{safe(word_id)}-{int(time.time() * 1000)}.{_extension(audio)}"
    path.write_bytes(data)

    try:
        result = scoring.score_speech(path, word["text"], record.get("lang", "fr"))
    except scoring.ScoringError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    pronunciation = result["pronunciation"]
    weakest = min((w for w in result["words"] if w["text"]), key=lambda w: w["score"], default=None)
    tip = scoring.word_tip(weakest) if weakest else word.get("tip", "")
    previous = word.get("score")
    word["score"] = pronunciation  # the record now shows your latest take
    key = f"{record_id}:{word_id}"
    store.STATE["retries"][key] = store.STATE["retries"].get(key, 0) + 1

    user = store.STATE["user"]
    user["flowers"] += store.RETRY_REWARD
    user["weekly_flowers"] += store.RETRY_REWARD
    return {"word_id": word_id, "pronunciation": pronunciation, "previous": previous, "tip": tip,
            "engine": result["engine"], "flowers_earned": store.RETRY_REWARD, "flowers": user["flowers"]}
