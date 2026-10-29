import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import auth
import content
import db
import store
from paths import STATIC_DIR
from routers import admin, courses, notes, profile, records, share, tests, topics

app = FastAPI(title="Langogo API")

# Pages anyone may open without signing in: the share preview page, pictures and lesson audio.
def _is_public(path):
    if path in ("/health", "/openapi.json", "/docs", "/redoc") or path.startswith(("/static", "/media")):
        return True
    if path.startswith("/admin/"):  # protected by its own key (LANGOGO_ADMIN_KEY), not by a learner login
        return True
    return path.startswith("/share/") and not path.endswith("/payload")


@app.middleware("http")
async def accounts_and_saving(request: Request, call_next):
    """Finds out who is calling (from the login token), then saves their data after every change."""
    if request.method == "OPTIONS" or _is_public(request.url.path):
        return await call_next(request)
    if auth.enabled():
        header = request.headers.get("authorization", "")
        if not header.lower().startswith("bearer "):
            return JSONResponse({"detail": "Please sign in."}, status_code=401)
        try:
            claims = auth.verify(header[7:].strip())
        except auth.AuthError as e:
            return JSONResponse({"detail": str(e)}, status_code=401)
        who = (claims["sub"], claims.get("email"), auth.display_name(claims))
    else:
        who = ("dev",)
    try:
        store.activate(*who)
    except Exception as e:  # noqa: BLE001 - the database is unreachable: say so, never show an empty account
        print(f"WARNING: could not load the learner: {e}", flush=True)
        return JSONResponse({"detail": "Your data is temporarily unavailable. Please try again in a moment."},
                            status_code=503)
    response = await call_next(request)
    if request.method not in ("GET", "HEAD"):
        store.save_current()
    return response


# Added last so it is the outermost layer: even error replies (like 401) carry the CORS headers.
# Bearer tokens are not cookies, so allowing every origin is safe; set LANGOGO_CORS_ORIGINS to narrow it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("LANGOGO_CORS_ORIGINS", "*").split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(admin.router)
app.include_router(tests.router)
app.include_router(profile.router)
app.include_router(topics.router)
app.include_router(courses.router)
app.include_router(records.router)
app.include_router(notes.router)
app.include_router(share.router)

# Recorded voices for dialogue lines: backend/content/audio/<lesson_id>/<file>  ->  /media/<lesson_id>/<file>
content.AUDIO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=content.AUDIO_DIR), name="media")

# Pictures served by the backend, e.g. the preview picture for shared results: backend/static/share-card.png
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
def check_storage():
    if os.getenv("RENDER") and not db.is_postgres():
        print("WARNING: DATABASE_URL is not set. Learner data is kept on Render's temporary disk and WILL be "
              "erased on every restart. Set DATABASE_URL (see docs/DATA_STORAGE.md).", flush=True)


@app.on_event("shutdown")
def save_everything():
    store.flush_all()


@app.get("/health")
def health():
    """Also shows where learner data is kept: "postgres" is permanent, "sqlite" is a file that Render erases."""
    return {"status": "ok", "storage": db.storage_name(), "storage_ok": db.ping()}


@app.get("/dev/content")
def content_status():
    """Development helper: shows which lessons are ready, still to write, or broken."""
    if auth.enabled():
        raise HTTPException(status_code=404)
    return content.report()
