import shutil
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import auth
import content
import db
import languages
import speech_log
import store

router = APIRouter(tags=["profile"])


class FavoritesIn(BaseModel):
    topic_ids: list[str] = Field(..., min_length=1)


class NameIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=30)


class LanguageIn(BaseModel):
    language: str


class SettingsIn(BaseModel):
    speech_speed: Literal["slow", "normal"] | None = None
    show_translation: bool | None = None
    effects: bool | None = None


class SubscribeIn(BaseModel):
    plan: Literal["monthly", "yearly"]


@router.get("/me")
def get_me():
    user = store.STATE["user"]
    lang = languages.get(user.get("language"))
    return {**user, "settings": {**store.DEFAULT_SETTINGS, **user.get("settings", {})},
            "native": lang["native"], "language": user.get("language"), "language_name": lang["name"], "locale": lang["locale"],
            "favorites": store.STATE["favorites"], "unlimited": user["plan"] is not None,
            "email": user.get("email"), "research_consent": bool(user.get("research_consent")),
            "accounts": auth.enabled()}


@router.get("/languages")
def list_languages():
    """The languages on the first screen. `ready` is how many lessons have real content."""
    chosen = store.STATE["user"].get("language")
    return [{**l, "ready": content.ready_count(l["id"]), "selected": l["id"] == chosen}
            for l in languages.LANGUAGES]


@router.put("/me/language")
def choose_language(body: LanguageIn):
    if body.language not in languages.BY_ID:
        raise HTTPException(status_code=422, detail="Unknown language.")
    store.set_language(body.language)
    return get_me()


@router.put("/me/settings")
def save_settings(body: SettingsIn):
    settings = {**store.DEFAULT_SETTINGS, **store.STATE["user"].get("settings", {})}
    settings.update({k: getattr(body, k) for k in store.DEFAULT_SETTINGS if getattr(body, k) is not None})
    store.STATE["user"]["settings"] = settings
    return settings


@router.post("/me/reset-language")
def reset_language():
    """Starts the current language over: back to Level 1, its finished lessons and records are cleared.
    Flowers, Vocab Notes and the speech log are kept."""
    state = store.STATE
    lang = store.current_lang()
    state["completed"] = [lid for lid in state["completed"] if (languages.of_lesson(lid) or {}).get("id") != lang]
    state["records"] = [r for r in state["records"] if r.get("lang") != lang]
    store.set_level(lang, 1)
    store.ATTEMPTS.clear()
    return get_me()


@router.put("/me/topics")
def save_favorites(body: FavoritesIn):
    bad = [t for t in body.topic_ids if t not in store.FAVORITE_CHOICES]
    if bad:
        raise HTTPException(status_code=422, detail=f"Unknown favorite topics: {', '.join(bad)}")
    store.STATE["favorites"] = list(dict.fromkeys(body.topic_ids))
    return {"favorites": store.STATE["favorites"]}


@router.put("/me/name")
def save_name(body: NameIn):
    name = " ".join(body.name.split())
    if not name:
        raise HTTPException(status_code=422, detail="Please enter a name.")
    store.STATE["user"]["name"] = name
    return {"name": name}


def _wipe_recordings():
    """Deletes this learner's voice takes (backend/recordings/<anonymous id>/). Returns how many files."""
    folder = store.user_recordings_dir()
    deleted = 0
    if folder.is_dir():
        for path in folder.rglob("*"):
            if path.is_file():
                try:
                    path.unlink()
                    deleted += 1
                except OSError:
                    pass
        shutil.rmtree(folder, ignore_errors=True)
    return deleted


@router.delete("/me/recordings")
def delete_recordings():
    """Deletes every voice recording this learner made."""
    return {"deleted": _wipe_recordings()}


class ConsentIn(BaseModel):
    research: bool


@router.put("/me/consent")
def save_consent(body: ConsentIn):
    """Research opt-in: may the anonymous speech data of this learner be used for research?"""
    store.STATE["user"]["research_consent"] = body.research
    if not body.research:  # withdrawing consent also removes what was already logged
        store.STATE["speech_log"] = []
        speech_log.forget(store.current().participant)
    return {"research_consent": body.research}


@router.delete("/me/account")
def delete_account():
    """Deletes the account: progress, recordings, research rows and (when configured) the login itself."""
    session = store.current()
    deleted = _wipe_recordings()
    speech_log.forget(session.participant)
    db.delete(session.uid)
    store.forget(session.uid)
    login_removed = auth.delete_remote_user(session.uid) if auth.enabled() else False
    return {"deleted": True, "recordings": deleted, "login_removed": login_removed}


@router.get("/subscription/plans")
def get_plans():
    return store.PLANS


@router.post("/subscription")
def subscribe(body: SubscribeIn):
    # DEMO ONLY: no payment happens. Connect Stripe / RevenueCat here before launch.
    store.STATE["user"]["plan"] = body.plan
    return {"unlimited": True, "plan": body.plan}


@router.delete("/subscription")
def cancel_subscription():
    # DEMO ONLY: nothing is billed, so cancelling just switches the plan off.
    store.STATE["user"]["plan"] = None
    return {"unlimited": False, "plan": None}


@router.get("/leaderboard")
def get_leaderboard():
    return store.leaderboard_out()


@router.post("/dev/reset")
def reset_demo():
    """Development helper: restore the demo user and all progress to the starting state."""
    if auth.enabled():
        raise HTTPException(status_code=404)
    store.reset_state()
    return {"ok": True}
