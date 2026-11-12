"""Free Talk: an open conversation with an AI partner about the learner's favorite topics.

    POST /freetalk/start   picks a topic, returns the partner's opening line, three hints and the level used
    POST /freetalk/turn    receives the learner's recording, returns what they said, how they pronounced it, the
                           partner's answer and three hints for the next turn
    POST /freetalk/finish  ends the dialogue: with enough turns it makes a record (grade, scores, words to
                           practise) and pays 10 flowers when it lasted 5+ minutes; a dialogue left early only goes into the Free Talk log

The server keeps no conversation: the app sends the last turns with every request, so a restart of the server
never breaks a chat. The learner's CEFR level comes from their course (see learner_cefr) and the partner adapts to
how they are doing (very short answers, or hints used, make the next message easier).
Without OPENAI_API_KEY it runs in a small demo mode so the screen can still be tried.
"""
import json
import random
import re
import secrets
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

import config
import content
import languages
import llm
import rewards
import scoring
import store
import analytics

router = APIRouter(prefix="/freetalk", tags=["freetalk"])

MAX_AUDIO_BYTES = 10 * 1024 * 1024
MIN_AUDIO_BYTES = 1000
HISTORY_TURNS = 12
CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
CEFR_BY_LEVEL = {1: "A1", 2: "A2", 3: "B1", 4: "B1", 5: "B2", 6: "B2", 7: "C1", 8: "C1", 9: "C2"}
LEVEL_GUIDE = {
    "A1": "Very short sentences (3 to 7 words), present tense, the most common words, yes/no or either/or questions.",
    "A2": "Short simple sentences, present tense and simple past or near future, everyday words, one idea at a time.",
    "B1": "Connected sentences, the common tenses, opinions with simple reasons, everyday and travel vocabulary.",
    "B2": "Natural fluent sentences, some idioms, ask for opinions, reasons and comparisons.",
    "C1": "Rich natural language with nuance, abstract and cultural topics, some idiomatic expressions.",
    "C2": "Fully natural native-like language, humor and subtle expressions are welcome.",
}
EVERYDAY = {"id": "everyday", "name": "Everyday life"}

# The partner's first name in each language (shown above its bubbles).
PERSONA = {"fr": "Léa", "en": "Emma", "es": "Sofía", "zh": "Lin", "ko": "Min", "ja": "Yuki", "de": "Lena",
           "it": "Giulia", "ar": "Layla", "pt": "Ana", "ru": "Anya", "ro": "Maria", "yue": "Mei",
           "hi": "Anjali", "bn": "Riya", "id": "Sari"}


def learner_cefr(lang):
    """The CEFR level to talk at: the hardest lesson level of the learner's current course level, one step lower when their
    last few lessons were graded D or C."""
    level = store.level_of(lang)
    cefr = None
    try:
        spec = content.levels(lang).get(level)
        found = []
        for lid, _title in (spec["lessons"] if spec else []):
            ls = content.lesson(lid)
            if ls:
                found.append(ls["cefr"])
        cefr = max(found, key=CEFR_ORDER.index) if found else None  # the hardest lesson of the level
    except content.ContentError:
        cefr = None
    cefr = cefr or CEFR_BY_LEVEL.get(level, "B1")
    recent = [r for r in store.STATE["records"] if r.get("lang") == lang and r.get("kind") != "freetalk"][:3]
    grades = [store.GRADE_ORDER.index(r["grade"]) for r in recent if r.get("grade") in store.GRADE_ORDER]
    if len(grades) >= 2 and sum(grades) / len(grades) <= 1.0 and CEFR_ORDER.index(cefr) > 0:
        cefr = CEFR_ORDER[CEFR_ORDER.index(cefr) - 1]
    return cefr


def favorite_topics():
    """The learner's favorite topics from the My Favorite Topics screen, as [{id, name}]."""
    out = [{"id": t, "name": store.TOPIC_BY_ID[t]["name"]} for t in store.STATE["favorites"] if t in store.TOPIC_BY_ID]
    return out or [EVERYDAY]


def _topic(topic_id):
    topics = favorite_topics()
    return next((t for t in topics if t["id"] == topic_id), None) or random.choice(topics), topics


def _system_prompt(lang, topic, cefr, last_words, hint_used, opening):
    persona = PERSONA.get(lang["id"], "Alex")
    english = lang["id"] == "en"
    signals = ""
    if not opening:
        if hint_used or last_words <= 3:
            signals = ("The learner is struggling: make your next message one step easier (shorter, simpler words) "
                       "and ask a yes/no or either/or question they can answer with a few words.")
        elif last_words >= 12:
            signals = (f"The learner is doing well: you may stretch a little (one new word, or a 'why' question), "
                       f"but stay within CEFR {cefr}, at most one level up.")
    gloss = ("the same message in simpler English" if english else "the English translation of \"reply\"")
    hint_gloss = ("a few words explaining what it means in simple English" if english else "its English translation")
    return f"""You are {persona}, a warm, patient {lang['name']} conversation partner inside a speaking-practice app for learners.
The conversation is spoken aloud, so keep it natural and short.

Rules:
- Write "reply" ONLY in {lang['name']} ({lang['native']}). Never use another language in "reply".
- Learner level: CEFR {cefr}. {LEVEL_GUIDE[cefr]} Use only vocabulary and grammar a learner at this level knows.
- Topic: {topic['name']}. Stay on it and ask about the learner's own life and opinions.
- {"Open the conversation: greet the learner briefly, then ask one easy question about the topic." if opening else "Answer the learner's last message in one short sentence, then ask ONE easy follow-up question."}
- At most 2 short sentences in total. Never lecture and never list things.
- The learner's words come from speech recognition and may contain small errors. Never mention this. If a message is unclear, ask a simple question to clarify.
- Do not correct mistakes explicitly. If the learner makes a mistake, naturally use the correct form in your next sentence.
{('- ' + signals) if signals else ''}

Answer with a JSON object with exactly these keys:
"reply": your message in {lang['name']}
"reply_en": {gloss}
"hints": an array of exactly 3 objects {{"text": ..., "en": ...}}: three different things the learner could say next to answer your question, in {lang['name']}, 3 to 12 words each, at CEFR {cefr} or easier. "en" is {hint_gloss}."""


def _clean_hints(raw):
    out = []
    for h in raw if isinstance(raw, list) else []:
        if isinstance(h, dict) and isinstance(h.get("text"), str) and h["text"].strip():
            out.append({"text": h["text"].strip(), "en": str(h.get("en") or "").strip()})
    return out[:3]


def _npc_turn(lang, n, data):
    reply = str(data.get("reply") or "").strip()
    if not reply:
        raise llm.LLMError("The AI partner did not answer. Please try again.")
    return {"id": f"n{n}", "speaker": PERSONA.get(lang["id"], "Alex"), "role": "npc", "text": reply,
            "en": str(data.get("reply_en") or "").strip(), "audio_url": llm.speak(reply, lang["id"])}


def _messages(history):
    out = []
    for h in history[-HISTORY_TURNS:]:
        if isinstance(h, dict) and isinstance(h.get("text"), str) and h["text"].strip():
            out.append({"role": "assistant" if h.get("role") == "npc" else "user", "content": h["text"].strip()[:600]})
    return out


def _score_take(data, suffix, text, lang_id):
    """Pronunciation of what the learner said (the recognised text is the reference). None when scoring is not possible,
    so a scoring hiccup never stops the conversation."""
    if not text or not any(ch.isalnum() for ch in text):
        return None
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / f"score{suffix}"
        path.write_bytes(data)
        try:
            return scoring.score_speech(path, text, lang_id)
        except scoring.ScoringError:
            return None


def _scores_out(result):
    if not result:
        return None
    return {"pronunciation": result["pronunciation"], "fluency": result["fluency"], "completeness": result["completeness"],
            "words": [{"text": w["text"], "score": w["score"]} for w in result["words"]]}


def _count_words(text, unit):
    if unit == "characters":
        return len(re.findall(r"\w", text))
    return len(re.findall(r"[\w'’\-]+", text, flags=re.UNICODE))


# ---- Demo mode (no OPENAI_API_KEY) --------------------------------------------------------------------
def _demo_turn(lang, topic, n, first):
    text = (f"Hello! (Demo mode) Let's talk about {topic['name'].lower()}. What do you like about it?" if first
            else f"(Demo mode) Interesting! Tell me more about {topic['name'].lower()}.")
    return {"id": f"n{n}", "speaker": PERSONA.get(lang["id"], "Alex"), "role": "npc", "text": text,
            "en": "Demo mode: add OPENAI_API_KEY on the server to talk with the real AI partner.", "audio_url": None}


DEMO_HINTS = [{"text": "I like it a lot.", "en": ""}, {"text": "It is fun.", "en": ""}, {"text": "I do it with friends.", "en": ""}]


class StartIn(BaseModel):
    topic_id: str | None = None


# ---- Endpoints ----------------------------------------------------------------------------------------
@router.post("/start")
def start(body: StartIn | None = None):
    topic_id = body.topic_id if body else None
    lang = languages.get(store.current_lang())
    topic, topics = _topic(topic_id)
    cefr = learner_cefr(lang["id"])
    base = {"language": lang["name"], "lang": lang["id"], "locale": lang["locale"], "topic": topic, "topics": topics,
            "level": cefr, "demo": not llm.enabled(), "session_id": secrets.token_hex(8),
            "min_turns": store.FREETALK_MIN_TURNS, "reward": rewards.RULES["freetalk"]["flowers"],
            "reward_seconds": rewards.FREETALK_SECONDS}
    if not llm.enabled():
        return {**base, "turn": _demo_turn(lang, topic, 1, True), "hints": DEMO_HINTS}
    try:
        data = llm.chat_json(_system_prompt(lang, topic, cefr, 0, False, True),
                             [{"role": "user", "content": "(The learner has just joined. Start the conversation.)"}])
        return {**base, "turn": _npc_turn(lang, 1, data), "hints": _clean_hints(data.get("hints"))}
    except llm.LLMError as e:
        raise HTTPException(status_code=e.status, detail=str(e))


@router.post("/turn")
async def turn(audio: UploadFile = File(...), topic_id: str = Form(...), history: str = Form("[]"),
               turn_no: int = Form(1), hint_used: bool = Form(False), session_id: str = Form("")):
    """One learner turn: transcribe the recording, then let the partner answer."""
    lang = languages.get(store.current_lang())
    topic, _ = _topic(topic_id)
    cefr = learner_cefr(lang["id"])
    try:
        past = json.loads(history)
        if not isinstance(past, list):
            raise ValueError
    except ValueError:
        raise HTTPException(status_code=422, detail="The conversation could not be read.")

    data = await audio.read(MAX_AUDIO_BYTES + 1)
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="The recording is too long.")
    if len(data) < MIN_AUDIO_BYTES:
        raise HTTPException(status_code=422, detail="The recording is empty. Please try again.")
    n = max(1, min(turn_no, 500)) + 1
    store.touch_streak(store.STATE["user"])

    suffix = "." + ((audio.filename or "").rsplit(".", 1)[-1].lower() if "." in (audio.filename or "") else "webm")
    if not re.fullmatch(r"\.[a-z0-9]{2,4}", suffix):
        suffix = ".webm"
    sid = re.sub(r"[^A-Za-z0-9]", "", session_id)[:32]

    if not llm.enabled():
        text = "(Demo mode: your speech is not transcribed.)"
        you = {"id": f"u{n - 1}", "speaker": "You", "role": "you", "text": text}
        result = _score_take(data, suffix, "demo", lang["id"]) if config.scoring_engine() == "demo" else None
        if result and sid:
            store.ATTEMPTS.setdefault(f"ft:{sid}", {})[you["id"]] = {"text": text, "result": result}
        return {"you": you, "scores": _scores_out(result), "turn": _demo_turn(lang, topic, n, False),
                "hints": DEMO_HINTS, "level": cefr, "demo": True}

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / f"talk{suffix}"
        path.write_bytes(data)
        try:
            heard = llm.transcribe(path, lang["id"])
        except llm.LLMError as e:
            raise HTTPException(status_code=e.status, detail=str(e))
    if not heard:
        raise HTTPException(status_code=422, detail="I couldn't hear anything. Tap the mic and try again.")

    result = _score_take(data, suffix, heard, lang["id"])
    words = _count_words(heard, lang["unit"])
    try:
        out = llm.chat_json(_system_prompt(lang, topic, cefr, words, hint_used, False),
                            _messages(past) + [{"role": "user", "content": heard[:600]}])
        npc = _npc_turn(lang, n, out)
    except llm.LLMError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    you = {"id": f"u{n - 1}", "speaker": "You", "role": "you", "text": heard}
    if result and sid:  # kept in memory until the dialogue ends (/freetalk/finish)
        store.ATTEMPTS.setdefault(f"ft:{sid}", {})[you["id"]] = {"text": heard, "result": result}
    return {"you": you, "scores": _scores_out(result), "turn": npc, "hints": _clean_hints(out.get("hints")),
            "level": cefr, "demo": False}


# ---- Ending a dialogue ----------------------------------------------------------------------------------
class FinishIn(BaseModel):
    session_id: str
    topic_id: str | None = None
    seconds: int = 0           # how long the dialogue lasted (the app measures it)
    hints_used: int = 0        # turns in which the learner opened the example answers
    finished: bool = True      # False = the learner left before the end (no rating, no flowers)
    turns: list[dict] = []     # the scored turns as the app has them: used only if the server forgot them (restart)


def _result_from_client(t):
    """A scored turn sent back by the app, in the shape score_speech returns (only used after a server restart)."""
    def num(v):
        try:
            return max(0, min(100, round(float(v))))
        except (TypeError, ValueError):
            return 0
    words = [{"text": str(w.get("text", ""))[:60], "score": num(w.get("score")), "error": "None", "phonemes": []}
             for w in (t.get("words") or [])[:80] if isinstance(w, dict)]
    return {"engine": "azure", "pronunciation": num(t.get("pronunciation")), "fluency": num(t.get("fluency")),
            "completeness": num(t.get("completeness")), "words": words}


@router.post("/finish")
def finish(body: FinishIn):
    """End of a dialogue. With enough turns it becomes a record (shown on the same result screen as a lesson, with
    words to retry) and pays store.FREETALK_FLOWERS. Called twice for the same dialogue it returns the same record."""
    state = store.STATE
    sid = re.sub(r"[^A-Za-z0-9]", "", body.session_id)[:32]
    if not sid:
        raise HTTPException(status_code=422, detail="Unknown dialogue.")
    log = state.setdefault("freetalk_log", [])
    done = next((e for e in log if e.get("id") == sid), None)
    if done:
        rec = next((r for r in state["records"] if r["id"] == done.get("record_id")), None)
        return {"completed": bool(done.get("completed")), "record": rec, "turns": done.get("turns", 0),
                "min_turns": store.FREETALK_MIN_TURNS, "flowers_earned": done.get("flowers", 0)}

    lang_id = store.current_lang()
    lang = languages.get(lang_id)
    topic, _ = _topic(body.topic_id)
    attempts = dict(store.ATTEMPTS.get(f"ft:{sid}", {}))
    if not attempts and body.turns:
        attempts = {f"c{i}": {"text": str(t.get("text", ""))[:600], "result": _result_from_client(t)}
                    for i, t in enumerate(body.turns[:100]) if isinstance(t, dict)}
    store.ATTEMPTS.pop(f"ft:{sid}", None)
    n_turns = len(attempts)
    seconds = max(0, min(int(body.seconds or 0), 3 * 3600))
    counts = body.finished and n_turns >= store.FREETALK_MIN_TURNS
    entry = {"id": sid, "at": analytics.now_iso(), "lang": lang_id, "topic": topic["name"], "cefr": learner_cefr(lang_id),
             "seconds": seconds, "turns": n_turns, "hints_used": max(0, min(int(body.hints_used or 0), 500)),
             "completed": bool(counts), "grade": "", "fluency": None, "pronunciation": None, "completeness": None,
             "flowers": 0, "record_id": None}
    out = {"completed": False, "record": None, "turns": n_turns, "min_turns": store.FREETALK_MIN_TURNS, "flowers_earned": 0}
    if counts:
        results = [a["result"] for a in attempts.values()]
        fluency = round(sum(r["fluency"] for r in results) / len(results))
        pronunciation = round(sum(r["pronunciation"] for r in results) / len(results))
        completeness = round(sum(r["completeness"] for r in results) / len(results))
        grade = store.grade_for((fluency + pronunciation) / 2)
        user = state["user"]
        # 10 flowers for a session of 5+ minutes (2 a day, inside the daily cap); a shorter one is rated but pays nothing.
        earned = rewards.award(state, "freetalk") if seconds >= rewards.FREETALK_SECONDS else 0
        earned += rewards.practiced(state)
        store.touch_streak(user)
        feedback = scoring.feedback_items([(a["text"], a["result"]) for a in attempts.values()])
        record = {
            "id": f"r{state['next_record']}", "at": entry["at"], "lang": lang_id, "language": lang["name"],
            "kind": "freetalk", "lesson_id": "freetalk", "level": store.level_of(lang_id), "lesson_no": 0,
            "title": f"Free Talk · {topic['name']}", "topic": topic["name"], "emoji": "💬",
            "turns": n_turns, "seconds": seconds,
            "grade": grade, "fluency": fluency, "pronunciation": pronunciation, "completeness": completeness,
            "engine": "demo" if any(r.get("engine") == "demo" for r in results) else "azure",
            "flowers_earned": earned, "unlocked_level": None,
            "words": [{**w, "first_score": w.get("score")} for w in feedback],
        }
        state["next_record"] += 1
        state["records"].insert(0, record)
        entry.update(grade=grade, fluency=fluency, pronunciation=pronunciation, completeness=completeness,
                     flowers=earned, record_id=record["id"])
        out.update(completed=True, record=record, flowers_earned=earned)
    analytics.log_freetalk(state, entry)
    return out
