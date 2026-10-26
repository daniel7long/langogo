"""Turns a recording (webm from the browser, m4a/mp4 from a phone, wav, ogg, mp3 ...) into
16 kHz mono 16-bit WAV, the format Azure pronunciation assessment accepts.

It tries, in this order:
  1. the `av` package (pip install av) which carries its own ffmpeg, so nothing else to install
  2. an `ffmpeg` program on the PATH (Windows: winget install Gyan.FFmpeg)
"""
import io
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

RATE = 16000


class ConvertError(Exception):
    """`setup` is True when the server is missing a tool (our problem), False for a bad recording."""

    def __init__(self, message, setup=False):
        super().__init__(message)
        self.setup = setup


def _with_av(path):
    import av  # noqa: WPS433 (optional dependency)

    pcm = bytearray()
    container = av.open(str(path))
    try:
        stream = next((s for s in container.streams if s.type == "audio"), None)
        if stream is None:
            raise ConvertError("The recording has no audio.")
        resampler = av.AudioResampler(format="s16", layout="mono", rate=RATE)

        def take(frames):
            for f in frames if isinstance(frames, list) else [frames]:
                if f is not None:
                    pcm.extend(bytes(f.planes[0])[: f.samples * 2])

        for frame in container.decode(stream):
            take(resampler.resample(frame))
        take(resampler.resample(None))
    finally:
        container.close()
    return bytes(pcm)


def _with_ffmpeg(path):
    exe = shutil.which("ffmpeg")
    if not exe:
        raise FileNotFoundError("ffmpeg")
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "out.wav"
        r = subprocess.run([exe, "-loglevel", "error", "-y", "-i", str(path), "-ac", "1", "-ar", str(RATE),
                            "-sample_fmt", "s16", str(out)], capture_output=True, timeout=60)
        if r.returncode != 0 or not out.is_file():
            raise ConvertError("The recording could not be read: " + r.stderr.decode("utf-8", "ignore")[:200])
        with wave.open(str(out), "rb") as w:
            return w.readframes(w.getnframes())


def to_wav16k(path):
    """Returns (wav_bytes, seconds). Raises ConvertError with a message that says what to install."""
    pcm = None
    problems = []
    try:
        pcm = _with_av(path)
    except ImportError:
        problems.append("av")
    except ConvertError:
        raise
    except Exception as e:  # a damaged or unsupported file
        problems.append(f"av failed: {e}")
    if pcm is None:
        try:
            pcm = _with_ffmpeg(path)
        except FileNotFoundError:
            problems.append("ffmpeg")
        except ConvertError:
            raise
        except subprocess.TimeoutExpired:
            raise ConvertError("Reading the recording took too long.")
    if pcm is None:
        raise ConvertError(
            "Scoring needs an audio converter. Run:  pip install av   (or install ffmpeg). "
            f"[{'; '.join(problems)}]", setup=True)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm)
    return buf.getvalue(), len(pcm) / (2 * RATE)
