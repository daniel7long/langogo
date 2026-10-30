"""Speech scoring.

Real scoring uses Azure AI Speech "Pronunciation Assessment" (REST, short audio). For every spoken
line it returns an accuracy score, a fluency score and a completeness score (how much of the line
you actually said) plus a score for every word and every sound. Set AZURE_SPEECH_KEY and
AZURE_SPEECH_REGION in backend/.env to switch it on (see config.py).

Without a key the app falls back to the "demo" engine: made-up but stable numbers, so the screens
still work. Every result says which engine produced it ("azure" or "demo"); the app shows a notice
on the result screen for demo scores.
"""
import base64
import json
import re
import urllib.error
import urllib.parse
import urllib.request
import zlib

import audio_convert
import config
import languages

WEAK_WORD = 85  # a word below this score is worth practising


class ScoringError(Exception):
    """Something the learner or the setup can fix. `status` is the HTTP status to answer with."""

    def __init__(self, message, status=422):
        super().__init__(message)
        self.status = status


# ---- Counting what was said -----------------------------------------------------------------
def tokens(text):
    """The words of a line as written (apostrophes and hyphens stay inside a word)."""
    return re.findall(r"[\w'’\-]+", text, flags=re.UNICODE)


def count_units(text, unit):
    """Words for most languages, characters for Chinese / Japanese / Korean."""
    if unit == "characters":
        return sum(1 for ch in text if ch.isalnum())
    return len(tokens(text))


def speech_metrics(text, unit, recorded_seconds, speech_seconds):
    """Speech-rate numbers for one spoken line.
    speech_seconds = time from the first to the last word (pauses at the ends removed),
    recorded_seconds = how long the recording button was on."""
    units = count_units(text, unit)
    basis = speech_seconds or recorded_seconds
    rate = round(units / basis * 60, 1) if basis and basis > 0.2 else None
    rec_rate = round(units / recorded_seconds * 60, 1) if recorded_seconds and recorded_seconds > 0.2 else None
    return {
        "units": units, "unit": unit,
        "recorded_seconds": round(recorded_seconds, 2) if recorded_seconds else None,
        "speech_seconds": round(speech_seconds, 2) if speech_seconds else None,
        "rate_per_min": rate, "recorded_rate_per_min": rec_rate,
    }


# ---- Azure ------------------------------------------------------------------------------------
def _post(url, headers, body):
    """Sends the request. A separate function so tests can replace it. Returns (status, bytes)."""
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise ScoringError("Can't reach the scoring service. Check your internet connection.", 502) from e


def _azure_call(wav, expected_text, locale):
    assessment = {
        "ReferenceText": expected_text, "GradingSystem": "HundredMark", "Granularity": "Phoneme",
        "Dimension": "Comprehensive", "EnableMiscue": "True", "PhonemeAlphabet": "IPA",
    }
    url = (f"https://{config.azure_region()}.stt.speech.microsoft.com/speech/recognition/conversation/"
           f"cognitiveservices/v1?{urllib.parse.urlencode({'language': locale, 'format': 'detailed'})}")
    headers = {
        "Ocp-Apim-Subscription-Key": config.azure_key(),
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Accept": "application/json",
        "Pronunciation-Assessment": base64.b64encode(json.dumps(assessment).encode("utf-8")).decode("ascii"),
    }
    status, data = _post(url, headers, wav)
    if status in (401, 403):
        raise ScoringError("Azure rejected the key. Check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in backend/.env.", 503)
    if status == 429:
        raise ScoringError("The scoring service is busy. Try again in a moment.", 503)
    if status != 200:
        raise ScoringError(f"The scoring service answered with an error ({status}).", 502)
    try:
        return json.loads(data.decode("utf-8"))
    except ValueError as e:
        raise ScoringError("The scoring service sent an unreadable answer.", 502) from e


def _pa(obj):
    """Azure puts the scores either directly on the object or inside "PronunciationAssessment"."""
    inner = obj.get("PronunciationAssessment")
    return inner if isinstance(inner, dict) else obj


def _norm(text):
    """Lower-case, no punctuation, and Arabic spelling variants folded together, for comparing words."""
    text = re.sub(r"[\u064B-\u0652\u0640]", "", text or "")  # Arabic vowel marks and tatweel
    text = text.translate(str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي", "ة": "ه"}))
    return [t.lower() for t in tokens(text)]


def _from_recognition(best, expected_text):
    """Used only when Azure recognised the speech but sent no pronunciation scores (a language its pronunciation
    assessment does not cover). The marks then come from how closely what was recognised matches the sentence:
    each word is compared with the recognised words, and long pauses lower fluency."""
    import difflib
    expected = tokens(expected_text)
    heard = _norm(best.get("Lexical") or best.get("Display") or "")
    words, hit = [], 0
    for tok, norm in zip(expected, _norm(expected_text)):
        ratio = max((difflib.SequenceMatcher(None, norm, h).ratio() for h in heard), default=0.0)
        if ratio < 0.6:
            words.append({"text": tok, "score": 0, "error": "Omission", "phonemes": []})
        else:
            hit += 1
            words.append({"text": tok, "score": round(min(100, 30 + ratio * 70)), "error": "None", "phonemes": []})
    n = max(1, len(expected))
    completeness = hit / n * 100
    spoken = [w for w in best.get("Words", []) if w.get("Offset") is not None and w.get("Duration")]
    pauses = sum(1 for a, b in zip(spoken, spoken[1:]) if (b["Offset"] - a["Offset"] - a["Duration"]) / 1e7 > 0.7)
    accuracy = sum(w["score"] for w in words) / n
    fluency = max(0.0, accuracy - 12 * pauses)
    speech_seconds = ((spoken[-1]["Offset"] + spoken[-1]["Duration"] - spoken[0]["Offset"]) / 1e7) if spoken else None
    return accuracy, fluency, completeness, words, speech_seconds


def _parse_azure(reply, expected_text):
    status = reply.get("RecognitionStatus")
    if status != "Success" or not reply.get("NBest"):
        if status in ("NoMatch", "InitialSilenceTimeout", "BabbleTimeout"):
            raise ScoringError("We couldn't hear you say anything. Move a little closer to the microphone and try again.")
        raise ScoringError("The scoring service couldn't process this recording. Please try again.", 502)
    best = reply["NBest"][0]
    top = _pa(best)
    if "AccuracyScore" not in top and "PronScore" not in top:
        return _from_recognition(best, expected_text)  # no pronunciation scores came back for this language
    accuracy = float(top.get("AccuracyScore", 0))
    fluency = float(top.get("FluencyScore", 0))
    completeness = float(top.get("CompletenessScore", 0))

    raw_words = best.get("Words", [])
    spoken = [w for w in raw_words if w.get("ErrorType") != "Insertion"]
    surface = tokens(expected_text)
    use_surface = len(surface) == len(spoken)
    words, first, last = [], None, None
    for i, w in enumerate(spoken):
        wpa = _pa(w)
        error = w.get("ErrorType") or wpa.get("ErrorType") or "None"
        score = 0.0 if error == "Omission" else float(wpa.get("AccuracyScore", 0))
        phonemes = [{"p": p.get("Phoneme", ""), "score": round(float(_pa(p).get("AccuracyScore", 0)))}
                    for p in w.get("Phonemes", [])]
        words.append({"text": surface[i] if use_surface else w.get("Word", ""), "score": round(score),
                      "error": error, "phonemes": phonemes})
        offset, duration = w.get("Offset"), w.get("Duration")
        if error != "Omission" and offset is not None and duration:
            first = offset if first is None else min(first, offset)
            end = offset + duration
            last = end if last is None else max(last, end)
    speech_seconds = (last - first) / 1e7 if first is not None and last is not None else None
    return accuracy, fluency, completeness, words, speech_seconds


# ---- Demo engine ------------------------------------------------------------------------------
def _demo(audio_path, expected_text):
    size = audio_path.stat().st_size
    h = zlib.crc32(f"{expected_text}:{size}".encode())
    words = []
    for i, tok in enumerate(tokens(expected_text) or [expected_text]):
        s = 74 + zlib.crc32(f"{tok}:{h}:{i}".encode()) % 25
        words.append({"text": tok, "score": s, "error": "None", "phonemes": []})
    return 80 + (h >> 8) % 19, 82 + h % 17, 100.0, words, None


# ---- Public API -------------------------------------------------------------------------------
def score_speech(audio_path, expected_text, lang_id=languages.DEFAULT):
    """Scores one recording of `expected_text`. Returns a dict:
        engine, fluency, pronunciation (both 0-100), accuracy, completeness,
        words [{text, score, error, phonemes[{p, score}]}], audio_seconds, speech_seconds
    Raises ScoringError (with a message for the learner) when scoring is impossible."""
    lang = languages.get(lang_id)
    engine = config.scoring_engine()
    audio_seconds = None
    if engine == "azure":
        try:
            wav, audio_seconds = audio_convert.to_wav16k(audio_path)
        except audio_convert.ConvertError as e:
            raise ScoringError(str(e), 500 if e.setup else 422) from e
        if audio_seconds < 0.4:
            raise ScoringError("The recording is too short. Tap the mic and say the whole line.")
        reply = _azure_call(wav, expected_text, lang["locale"])
        accuracy, fluency, completeness, words, speech_seconds = _parse_azure(reply, expected_text)
    else:
        accuracy, fluency, completeness, words, speech_seconds = _demo(audio_path, expected_text)

    # Leaving words out lowers both marks: you can't score well on a line you didn't say.
    factor = max(0.0, min(completeness, 100.0)) / 100.0
    return {
        "engine": engine,
        "pronunciation": round(accuracy * factor),
        "fluency": round(fluency * factor),
        "accuracy": round(accuracy), "completeness": round(completeness),
        "words": words,
        "audio_seconds": audio_seconds, "speech_seconds": speech_seconds,
    }


# ---- Feedback text ----------------------------------------------------------------------------
PHONEME_TIPS = {
    "ɑ̃": "Nasal vowel: let the air flow through your nose and don't pronounce the n.",
    "ɔ̃": "Nasal vowel: let the air flow through your nose and don't pronounce the n.",
    "ɛ̃": "Nasal vowel: let the air flow through your nose and don't pronounce the n.",
    "œ̃": "Nasal vowel: let the air flow through your nose and don't pronounce the n.",
    "ʁ": "Make the r at the back of your throat, like a soft gargle.",
    "y": "Round your lips as for 'oo' but keep your tongue as for 'ee'.",
    "ø": "Round your lips and say 'e' as in 'her' without the r.",
    "œ": "Round your lips and say 'e' as in 'her' without the r.",
    "ʒ": "A soft 'zh', as in 'measure'.",
    "ɥ": "A quick, tight 'w' with rounded lips.",
    "ɲ": "Like 'ny' in 'canyon'.",
    "x": "Rub the back of your tongue against your soft palate, like a rough 'h'.",
    "ç": "A soft hissing 'h', as in the English 'huge'.",
    "ʏ": "Round your lips as for 'oo' but keep your tongue as for 'ee'.",
    "ʔ": "Start the vowel with a tiny stop, don't link it to the word before.",
    "ɾ": "A single quick tap of the tongue, like the 'tt' in 'butter'.",
    "r": "Roll the tip of your tongue: tr-r-r.",
}


def word_tip(word):
    """One short, practical hint for a word, based on its weakest sound."""
    if word["error"] == "Omission":
        return "You skipped this word. Say it clearly."
    weakest = min(word["phonemes"], key=lambda p: p["score"], default=None)
    if weakest and weakest["score"] < 80:
        hint = PHONEME_TIPS.get(weakest["p"])
        if hint:
            return hint
        return f"Work on the sound /{weakest['p']}/. Listen once, then say it slowly."
    if word["score"] < WEAK_WORD:
        return "Say it slowly, one syllable at a time, then speed up."
    return "Sounds good. Say it once more to lock it in."


def feedback_items(turns, limit_words=2):
    """The things to practise after a lesson, taken from what the learner really said.
    `turns` is a list of (sentence, result of score_speech). Returns up to `limit_words` weakest
    words plus the weakest sentence, each {id, kind, text, score, tip}."""
    candidates = []
    for sentence, result in turns:
        for w in result["words"]:
            if w["text"] and any(ch.isalnum() for ch in w["text"]):
                candidates.append(w)
    candidates.sort(key=lambda w: w["score"])
    items, seen = [], set()
    for w in candidates:
        key = w["text"].lower()
        if key in seen:
            continue
        seen.add(key)
        items.append({"kind": "word", "text": w["text"], "score": w["score"], "tip": word_tip(w)})
        if len(items) == limit_words:
            break
    if turns:
        sentence, result = min(turns, key=lambda t: t[1]["pronunciation"])
        worst = min((w for w in result["words"] if w["text"]), key=lambda w: w["score"], default=None)
        if worst and worst["score"] < WEAK_WORD:
            tip = f"Watch “{worst['text']}”. {word_tip(worst)}"
        else:
            tip = "Say the whole phrase smoothly, linking the words together."
        if len(tokens(sentence)) > 1 or len(sentence) > 4:
            items.append({"kind": "phrase", "text": sentence, "score": result["pronunciation"], "tip": tip})
    for i, item in enumerate(items, start=1):
        item["id"] = f"w{i}"
    return items
