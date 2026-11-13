"""Where this backend can be reached from the internet (for share links and share pictures).

Uses LANGOGO_PUBLIC_URL when it is set. If it is not, the address is taken from the request itself, so shared links and posters
work on Render even before that setting is added (only on a local run does it fall back to http://localhost:8000).
"""
import os


def public_url(request=None):
    env = os.getenv("LANGOGO_PUBLIC_URL", "").strip()
    if env:
        return env.rstrip("/")
    if request is not None:
        h = request.headers
        host = h.get("x-forwarded-host") or h.get("host")
        if host:
            proto = (h.get("x-forwarded-proto") or request.url.scheme or "https").split(",")[0].strip()
            return f"{proto}://{host}"
    return "http://localhost:8000"
