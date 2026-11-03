"""Free Talk: an open conversation with an AI partner about the learner's favorite topics.

    POST /freetalk/start   picks a topic, returns the partner's opening line, three hints and the level used
    POST /freetalk/turn    receives the learner's recording, returns what they said, the partner's answer and
                           three hints for the next turn

The server keeps no conversation: the app sends the last turns with every request, so a restart of the server
never breaks a chat. The learner's CEFR level comes from their course (see learner_cefr) and the partner adapts to
how they are doing (very short answers, or hints used, make the next message easier).
Without OPENAI_API_KEY it runs in a small demo mode so the screen can still be tried.
"""
import json
import random
import re
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

import config
import content
import languages
import llm
import store

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
    recent = [r for r in store.STATE["records"] if r.get("lang") == lang][:3]
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
            "level": cefr, "demo": not llm.enabled()}
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
               turn_no: int = Form(1), hint_used: bool = Form(False)):
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

    if not llm.enabled():
        you = {"id": f"u{n - 1}", "speaker": "You", "role": "you", "text": "(Demo mode: your speech is not transcribed.)"}
        return {"you": you, "turn": _demo_turn(lang, topic, n, False), "hints": DEMO_HINTS, "level": cefr, "demo": True}

    suffix = "." + ((audio.filename or "").rsplit(".", 1)[-1].lower() if "." in (audio.filename or "") else "webm")
    if not re.fullmatch(r"\.[a-z0-9]{2,4}", suffix):
        suffix = ".webm"
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / f"talk{suffix}"
        path.write_bytes(data)
        try:
            heard = llm.transcribe(path, lang["id"])
        except llm.LLMError as e:
            raise HTTPException(status_code=e.status, detail=str(e))
    if not heard:
        raise HTTPException(status_code=422, detail="I couldn't hear anything. Tap the mic and try again.")

    words = _count_words(heard, lang["unit"])
    try:
        out = llm.chat_json(_system_prompt(lang, topic, cefr, words, hint_used, False),
                            _messages(past) + [{"role": "user", "content": heard[:600]}])
        npc = _npc_turn(lang, n, out)
    except llm.LLMError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    you = {"id": f"u{n - 1}", "speaker": "You", "role": "you", "text": heard}
    return {"you": you, "turn": npc, "hints": _clean_hints(out.get("hints")), "level": cefr, "demo": False}
