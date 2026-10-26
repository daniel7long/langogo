"""Sharing a lesson result.

GET /share/{record_id}/payload   the text and link the app hands to Facebook, Instagram, LinkedIn and X
GET /share/{record_id}           a small public page with Open Graph tags. Facebook and LinkedIn read
                                 these tags to build the link preview (title, description, picture).

Set these before deploying (see the share steps in the update notes):
    LANGOGO_PUBLIC_URL   where THIS backend can be reached from the internet, e.g. https://api.langogo.app
    LANGOGO_APP_URL      where the web app lives, e.g. https://langogo.app
"""
import os
from html import escape

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

import db
import store

router = APIRouter(prefix="/share", tags=["share"])

PUBLIC_URL = os.getenv("LANGOGO_PUBLIC_URL", "http://localhost:8000").rstrip("/")
APP_URL = os.getenv("LANGOGO_APP_URL", "http://localhost:8081").rstrip("/")


def _share_token(record_id):
    """Public share links look like <owner key>.<record id>, so the public page can find the right learner."""
    return f"{store.current().share_key}.{record_id}"


def _record_or_404(token, public=False):
    """The record behind a share link. `public` pages look the owner up by the key inside the link."""
    key, _, record_id = token.rpartition(".")
    if public and key:
        state = db.state_by_share_key(key) or {"records": []}
    else:
        state, record_id = store.STATE, record_id or token
    record = next((r for r in state["records"] if r["id"] == record_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


def _texts(record):
    title = f"I got {record['grade']} on Langogo!"
    flowers = f" +{record['flowers_earned']} flowers." if record["flowers_earned"] else ""
    language = record.get("language", "French")
    description = (f"Lv{record['level']} - Lesson {record['lesson_no']}: {record['title']}."
                   f"{flowers} Practice speaking {language} with no pressure.")
    return title, description


@router.get("/{record_id}/payload")
def share_payload(record_id: str):
    record = _record_or_404(record_id)
    title, description = _texts(record)
    return {
        "title": title,
        "text": f"{title} {description}",
        "url": f"{PUBLIC_URL}/share/{_share_token(record['id'])}",
        "hashtags": ["Langogo", f"Learn{record.get('language', 'French')}"],
    }


@router.get("/{record_id}", response_class=HTMLResponse)
def share_page(record_id: str):
    record = _record_or_404(record_id, public=True)
    title, description = _texts(record)
    url = f"{PUBLIC_URL}/share/{record_id}"
    image = f"{PUBLIC_URL}/static/share-card.png"
    t, d, u, i, app = (escape(x, quote=True) for x in (title, description, url, image, APP_URL))
    return f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="Langogo">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{u}">
<meta property="og:image" content="{i}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:description" content="{d}">
<meta name="twitter:image" content="{i}">
<style>body{{font-family:system-ui,sans-serif;background:#FFF0E3;color:#1A1A1A;display:flex;min-height:100vh;
align-items:center;justify-content:center;margin:0}}main{{text-align:center;padding:24px;max-width:420px}}
a{{display:inline-block;margin-top:16px;background:#F47A20;color:#fff;padding:12px 24px;border-radius:999px;
text-decoration:none;font-weight:600}}</style>
</head><body><main>
<h1>{t}</h1><p>{d}</p>
<a href="{app}">Try Langogo</a>
</main></body></html>"""
