"""The three OpenAI calls behind Free Talk, written with the standard library only (no extra packages):

    transcribe(path, lang_id)      what the learner said (speech to text)
    chat_json(system, messages)    the AI partner's answer as a Python dict
    speak(text, lang_id)           the partner's voice, saved as an mp3 under content/audio/freetalk/

Every function raises LLMError with a message that is safe to show to the learner.
"""
import hashlib
import json
import mimetypes
import urllib.error
import urllib.request
import uuid

import config
import content

API = "https://api.openai.com/v1"
VOICE_DIR = content.AUDIO_DIR / "freetalk"

# Whisper wants an ISO-639-1 code. Cantonese is not one of them: leave the language out and let it detect.
WHISPER_LANG = {"fr": "fr", "en": "en", "es": "es", "zh": "zh", "ko": "ko", "ja": "ja", "de": "de", "it": "it",
                "ar": "ar", "pt": "pt", "ru": "ru", "ro": "ro", "hi": "hi", "bn": "bn", "id": "id"}


class LLMError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


def enabled():
    return bool(config.openai_key())


def _open(req, timeout):
    """A separate function so tests can replace it. Returns (status, bytes)."""
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise LLMError("Can't reach the AI service. Check your internet connection.") from e


def _check(status, data):
    if status in (401, 403):
        raise LLMError("OpenAI rejected the key. Check OPENAI_API_KEY in backend/.env.", 503)
    if status == 429:
        raise LLMError("The AI service is busy. Try again in a moment.", 503)
    if status != 200:
        raise LLMError(f"The AI service answered with an error ({status}).")


def _auth():
    return {"Authorization": f"Bearer {config.openai_key()}"}


def transcribe(path, lang_id):
    """Speech to text for one recording file (webm, m4a, mp3, wav, ... are all accepted)."""
    model = config.openai_models()[1]
    boundary = uuid.uuid4().hex
    fields = {"model": model, "response_format": "json"}
    if lang_id in WHISPER_LANG:
        fields["language"] = WHISPER_LANG[lang_id]
    parts = []
    for k, v in fields.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    parts.append((f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
                  f'Content-Type: {ctype}\r\n\r\n').encode() + path.read_bytes() + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(f"{API}/audio/transcriptions", data=b"".join(parts), method="POST",
                                 headers={**_auth(), "Content-Type": f"multipart/form-data; boundary={boundary}"})
    status, data = _open(req, 60)
    _check(status, data)
    try:
        return (json.loads(data.decode("utf-8")).get("text") or "").strip()
    except ValueError as e:
        raise LLMError("The AI service sent an unreadable answer.") from e


def chat_json(system, messages, max_tokens=500):
    """One chat completion that must answer with a JSON object. Returns it as a dict."""
    body = {"model": config.openai_models()[0], "temperature": 0.7, "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}] + messages}
    req = urllib.request.Request(f"{API}/chat/completions", data=json.dumps(body).encode("utf-8"), method="POST",
                                 headers={**_auth(), "Content-Type": "application/json"})
    status, data = _open(req, 60)
    _check(status, data)
    try:
        text = json.loads(data.decode("utf-8"))["choices"][0]["message"]["content"]
        out = json.loads(text)
    except (ValueError, KeyError, IndexError, TypeError) as e:
        raise LLMError("The AI partner sent an answer the app could not read. Please try again.") from e
    if not isinstance(out, dict):
        raise LLMError("The AI partner sent an answer the app could not read. Please try again.")
    return out


def speak(text, lang_id):
    """The partner's voice for `text`. Returns "/media/freetalk/<file>.mp3", or None when it cannot be made
    (the app then reads the line with the phone's own voice)."""
    text = (text or "").strip()
    if not text or not enabled():
        return None
    _, _, tts_model, voice = config.openai_models()
    name = hashlib.sha1(f"{tts_model}|{voice}|{lang_id}|{text}".encode("utf-8")).hexdigest()[:16] + ".mp3"
    path = VOICE_DIR / name
    if not path.is_file() or path.stat().st_size < 200:
        body = {"model": tts_model, "voice": voice, "input": text[:600], "response_format": "mp3"}
        req = urllib.request.Request(f"{API}/audio/speech", data=json.dumps(body).encode("utf-8"), method="POST",
                                     headers={**_auth(), "Content-Type": "application/json"})
        try:
            status, data = _open(req, 60)
        except LLMError:
            return None
        if status != 200 or len(data) < 200:
            return None
        VOICE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".part")
        tmp.write_bytes(data)
        tmp.replace(path)
    return f"/media/freetalk/{name}"
