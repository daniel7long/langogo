"""Makes the voice recordings for every word and sentence in the lessons, with Azure neural voices.

Why: the app used to read words with the phone's own voice. Many phones have no voice for French, Korean and
so on (or use the wrong one), so the pronunciation came out wrong. Recorded files sound the same on every
phone. The app plays a file when there is one and only falls back to the phone's voice when there is not.

Run it once on your own computer (your Azure key stays in backend/.env, it never goes to GitHub):

    cd backend
    python generate_tts.py --dry-run          # how many clips and characters, nothing is sent
    python generate_tts.py                    # all languages (can be stopped with Ctrl+C and run again)
    python generate_tts.py --lang fr es       # only some languages

What it does, per language:
  * collects every word, example sentence, dialogue line and practice phrase in content/<lang>/lessons
  * asks Azure for two files per text: normal speed and slow ("<id>.mp3" and "<id>-s.mp3")
  * writes them to content/audio/tts/<lang>/ together with manifest.json (text -> id), which the app reads
  * skips files that already exist, so running it again only makes the new or changed texts

Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in backend/.env (the same ones used for scoring). No extra
packages. Change a voice with LANGOGO_TTS_VOICE_FR=fr-FR-HenriNeural (and ES, DE, ZH, KO, JA, IT, AR).
"""
import argparse
import hashlib
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from xml.sax.saxutils import escape

import config
import languages

HERE = Path(__file__).parent
CONTENT_DIR = HERE / "content"
OUT_DIR = CONTENT_DIR / "audio" / "tts"

NORMAL_RATE = "-5%"  # a touch slower than natural speech, clearer for learners
SLOW_RATE = "-35%"   # the "Slow" buttons
OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3"

DEFAULT_VOICES = {
    "fr": "fr-FR-DeniseNeural",
    "es": "es-ES-ElviraNeural",
    "de": "de-DE-KatjaNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "ko": "ko-KR-SunHiNeural",
    "ja": "ja-JP-NanamiNeural",
    "it": "it-IT-ElsaNeural",
    "ar": "ar-SA-ZariyahNeural",
}


def voice_for(lang_id):
    return os.getenv(f"LANGOGO_TTS_VOICE_{lang_id.upper()}", "").strip() or DEFAULT_VOICES[lang_id]


def collect_texts(lang_id):
    """Every distinct text the app can read aloud for this language, in a stable order."""
    seen = {}
    for path in sorted((CONTENT_DIR / lang_id / "lessons").glob("*.json")):
        raw = json.loads(path.read_text(encoding="utf-8"))

        def add(text):
            text = (text or "").strip()
            if text:
                seen.setdefault(text, None)

        for v in raw.get("vocab", []):
            add(v.get("word"))
            for e in v.get("examples", []):
                add(e.get("target") or e.get("fr"))
        for t in raw.get("dialogue", []):
            add(t.get("text"))
        for w in raw.get("practice_words", []):
            add(w.get("text"))
    extra = CONTENT_DIR / lang_id / "level_test.json"  # the level test's speaking sentence (French)
    if extra.is_file():
        sentence = (json.loads(extra.read_text(encoding="utf-8")).get("speaking_sentence") or "").strip()
        if sentence:
            seen.setdefault(sentence, None)
    return list(seen)


def clip_id(lang_id, text):
    key = f"{voice_for(lang_id)}|{NORMAL_RATE}|{SLOW_RATE}|{text}"
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]


def ssml(text, locale, voice, rate):
    return (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="%s">'
        '<voice name="%s"><prosody rate="%s">%s</prosody></voice></speak>' % (locale, voice, rate, escape(text))
    )


class FatalError(Exception):
    """Nothing more can work (wrong key): stop everything."""


class ClipError(Exception):
    """This one text failed: note it and carry on with the others."""


def synthesize(endpoint, key, body):
    """One request to Azure. Retries when Azure asks us to slow down. Returns the mp3 bytes."""
    request = urllib.request.Request(
        endpoint,
        data=body.encode("utf-8"),
        headers={
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
            "User-Agent": "langogo-tts",
        },
        method="POST",
    )
    last = None
    for attempt in range(7):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                data = response.read()
            if len(data) < 200:
                raise urllib.error.URLError("answer too short to be audio")
            return data
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}"
            if e.code in (401, 403):
                raise FatalError(
                    f"Azure refused the key (HTTP {e.code}). Check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in backend/.env."
                )
            if e.code == 400:
                raise ClipError("Azure rejected this text or the voice name (HTTP 400)")
            wait = e.headers.get("Retry-After") if e.headers else None
            delay = float(wait) if wait and wait.replace(".", "", 1).isdigit() else min(60, 2 ** attempt)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last = str(e)
            delay = min(30, 2 ** attempt)
        time.sleep(delay)
    raise ClipError(f"Azure did not answer after several tries ({last})")


def write_atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".part")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def run_language(lang, args, key, endpoint):
    lang_id = lang["id"]
    texts = collect_texts(lang_id)
    chars = sum(len(t) for t in texts)
    out = OUT_DIR / lang_id
    voice = voice_for(lang_id)

    jobs = []  # (path, text, rate)
    for text in texts:
        cid = clip_id(lang_id, text)
        for suffix, rate in (("", NORMAL_RATE), ("-s", SLOW_RATE)):
            path = out / f"{cid}{suffix}.mp3"
            if not path.is_file() or path.stat().st_size < 200:
                jobs.append((path, text, rate))

    print(f"{lang['name']:9} {len(texts):4} texts, {chars:6} characters (x2 with slow), voice {voice}, {len(jobs)} files to make")
    if args.dry_run:
        return len(texts), chars * 2, 0

    done = 0
    lock = threading.Lock()
    failed = []

    def work(job):
        path, text, rate = job
        data = synthesize(endpoint, key, ssml(text, lang["locale"], voice, rate))
        write_atomic(path, data)
        return len(data)

    if jobs:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(work, j): j for j in jobs}
            try:
                for f in as_completed(futures):
                    try:
                        f.result()
                    except ClipError as e:
                        failed.append((futures[f][1], str(e)))
                    except FatalError:
                        for other in futures:
                            other.cancel()
                        raise
                    with lock:
                        done += 1
                        if done % 25 == 0 or done == len(jobs):
                            print(f"   {lang_id}: {done}/{len(jobs)}", flush=True)
            except KeyboardInterrupt:
                for other in futures:
                    other.cancel()
                print("Stopped. Run the same command again to carry on where it stopped.")
                raise SystemExit(130)

    # The manifest lists only texts whose two files exist.
    clips = {}
    for text in texts:
        cid = clip_id(lang_id, text)
        if (out / f"{cid}.mp3").is_file() and (out / f"{cid}-s.mp3").is_file():
            clips[text] = cid
    manifest = {"version": 1, "locale": lang["locale"], "voice": voice, "clips": clips}
    write_atomic(out / "manifest.json", json.dumps(manifest, ensure_ascii=False, indent=0).encode("utf-8"))

    if args.prune:
        keep = {f"{cid}{s}.mp3" for cid in clips.values() for s in ("", "-s")} | {"manifest.json"}
        for f in out.iterdir():
            if f.name not in keep and f.is_file():
                f.unlink()

    if failed:
        print(f"   {len(failed)} texts failed, run again to retry them:")
        for text, why in failed[:10]:
            print(f"     {text[:50]!r}: {why}")
    return len(clips), chars * 2, len(failed)


def main():
    parser = argparse.ArgumentParser(description="Make the voice files for the lessons with Azure neural voices.")
    parser.add_argument("--lang", nargs="*", help="language ids, e.g. fr es (default: all)")
    parser.add_argument("--dry-run", action="store_true", help="only count, send nothing")
    parser.add_argument("--workers", type=int, default=2, help="requests at the same time (default 2)")
    parser.add_argument("--prune", action="store_true", help="delete files of texts that are no longer in the lessons")
    parser.add_argument("--endpoint", help="for tests: use another address instead of Azure")
    args = parser.parse_args()

    chosen = [l for l in languages.LANGUAGES if not args.lang or l["id"] in args.lang]
    if not chosen:
        sys.exit("No such language. Choose from: " + ", ".join(l["id"] for l in languages.LANGUAGES))

    key = config.azure_key()
    region = config.azure_region()
    endpoint = args.endpoint or f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
    if not args.dry_run and not args.endpoint and not (key and region):
        sys.exit("Put AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in backend/.env first (same ones as for scoring).")

    total_chars = 0
    problems = 0
    try:
        for lang in chosen:
            _, chars, bad = run_language(lang, args, key or "test", endpoint)
            total_chars += chars
            problems += bad
    except FatalError as e:
        sys.exit(f"\nStopped: {e}")

    print(f"\n{'Counted' if args.dry_run else 'Done'}: about {total_chars:,} characters in total (normal + slow).")
    if not args.dry_run:
        size = sum(f.stat().st_size for f in OUT_DIR.rglob("*.mp3")) / 1e6 if OUT_DIR.exists() else 0
        print(f"Audio size on disk: {size:.1f} MB in {OUT_DIR}")
        print("Next: commit backend/content/audio/tts and push, then redeploy the backend.")
    if problems:
        sys.exit(1)


if __name__ == "__main__":
    main()
