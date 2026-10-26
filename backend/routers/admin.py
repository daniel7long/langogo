"""A private page that lists every learner: http://localhost:8000/admin/users?key=<LANGOGO_ADMIN_KEY>

Off unless LANGOGO_ADMIN_KEY is set in backend/.env (then every other address answers "Not Found").
Add `&format=csv` (or the Download button) for a spreadsheet. With SUPABASE_SERVICE_KEY set it also lists
people who signed up but never opened the app. It never shows passwords, tokens or lesson content.
"""
import csv
import hmac
import io
from html import escape

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, Response

import auth
import config
import db

router = APIRouter(prefix="/admin", tags=["admin"])

COLUMNS = [("name", "Name"), ("email", "Email"), ("provider", "Sign-in"), ("language", "Language"), ("level", "Level"),
           ("flowers", "Flowers"), ("lessons_done", "Lessons"), ("research_opt_in", "Research"),
           ("joined", "Joined"), ("last_active", "Last active"), ("status", "Status")]


def _check(key):
    expected = config.admin_key()
    if not expected:
        raise HTTPException(status_code=404, detail="Not Found")
    if not key or not hmac.compare_digest(key.encode(), expected.encode()):
        raise HTTPException(status_code=403, detail="Wrong key.")


def combined_users():
    """Learners from the database merged with the logins from Supabase (when available)."""
    rows = {u["id"]: {**u, "provider": "", "status": "active"} for u in db.list_users()}
    remote = auth.list_remote_users()
    if remote is not None:
        for r in remote:
            row = rows.get(r["id"])
            if row is None:  # signed up, never opened the app
                row = rows[r["id"]] = {"id": r["id"], "name": "", "email": r["email"], "language": "", "level": "",
                                       "flowers": "", "lessons_done": "", "research_opt_in": "", "joined": r["created"],
                                       "last_active": "", "status": "never opened the app"}
            row["provider"] = r["provider"]
            row["email"] = row["email"] or r["email"]
            row["joined"] = row["joined"] or r["created"]
            if r["last_sign_in"]:
                row["last_active"] = max(row["last_active"] or "", r["last_sign_in"])
    return sorted(rows.values(), key=lambda r: r["joined"] or "")


@router.get("/users")
def users_page(key: str = "", format: str = "html"):
    _check(key)
    rows = combined_users()
    if format == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow([label for _, label in COLUMNS])
        for r in rows:
            w.writerow([r.get(k, "") for k, _ in COLUMNS])
        return Response("﻿" + buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": "attachment; filename=langogo-users.csv"})
    head = "".join(f"<th>{escape(label)}</th>" for _, label in COLUMNS)
    body = "".join("<tr>" + "".join(f"<td>{escape(str(r.get(k, '')))}</td>" for k, _ in COLUMNS) + "</tr>" for r in rows)
    note = "" if auth.list_remote_users() is not None or not config.supabase_url() else \
        "<p class=n>Only learners who opened the app are listed. Set SUPABASE_SERVICE_KEY in backend/.env to include every sign-up.</p>"
    return HTMLResponse(f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Langogo users</title>
<style>body{{font-family:system-ui,sans-serif;background:#FFFCF8;color:#1F1B16;margin:24px}}h1{{margin:0 0 4px}}
.n{{color:#6B6259}}table{{border-collapse:collapse;width:100%;background:#fff;border-radius:12px;overflow:hidden;
box-shadow:0 2px 12px rgba(120,70,20,.08)}}th,td{{padding:10px 12px;text-align:left;border-bottom:1px solid #EADFD3;font-size:14px;white-space:nowrap}}
th{{background:#FFF1E4;color:#B84A08}}a.b{{display:inline-block;margin:12px 0;padding:8px 16px;border-radius:99px;background:#D95F0E;color:#fff;text-decoration:none}}
.w{{overflow-x:auto}}</style></head><body><h1>Langogo users</h1>
<p class=n>{len(rows)} in total. Private: contains personal data.</p>{note}
<a class=b href="?key={escape(key, quote=True)}&amp;format=csv">Download CSV</a>
<div class=w><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div></body></html>""")
