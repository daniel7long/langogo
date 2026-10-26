"""Who is calling? Checks the login token the app sends with every request.

Sign-in itself (Google, email + password, password reset) is done by Supabase Auth. After signing in, the
app holds a signed token (JWT). Here we only CHECK that token and read the learner's id from it, so the
backend never sees a password.

Set SUPABASE_URL in backend/.env to turn accounts on (see docs/AUTH_SETUP.md). Without it the backend
runs with one local "dev" learner, exactly as before.
"""
import json
import urllib.error
import urllib.request

import config

try:  # PyJWT: pip install "pyjwt[crypto]"
    import jwt
    from jwt import PyJWKClient
except ImportError:  # the backend still starts without it while accounts are off
    jwt = None
    PyJWKClient = None

AUDIENCE = "authenticated"
_jwks = None


class AuthError(Exception):
    pass


def enabled():
    return config.auth_enabled()


def _jwks_client():
    global _jwks
    if _jwks is None:
        _jwks = PyJWKClient(f"{config.supabase_url()}/auth/v1/.well-known/jwks.json", cache_keys=True, lifespan=3600)
    return _jwks


def _signing_key(token, alg):
    """The key that must have signed this token (separate function so tests can replace it)."""
    return _jwks_client().get_signing_key_from_jwt(token).key


def verify(token):
    """Returns the token's claims, or raises AuthError."""
    if jwt is None:
        raise AuthError('The server is missing PyJWT. Run: pip install "pyjwt[crypto]"')
    try:
        alg = jwt.get_unverified_header(token).get("alg", "")
        options = {"require": ["exp", "sub"]}
        if alg == "HS256":
            secret = config.supabase_jwt_secret()
            if not secret:
                raise AuthError("This token needs SUPABASE_JWT_SECRET on the server.")
            return jwt.decode(token, secret, algorithms=["HS256"], audience=AUDIENCE, options=options)
        if alg not in ("ES256", "RS256"):
            raise AuthError("Unsupported token type.")
        issuer = f"{config.supabase_url()}/auth/v1" if config.supabase_url() else None
        return jwt.decode(token, _signing_key(token, alg), algorithms=[alg], audience=AUDIENCE, issuer=issuer, options=options)
    except AuthError:
        raise
    except Exception as e:  # expired, wrong signature, wrong audience, key fetch failed ...
        raise AuthError(f"Please sign in again. ({type(e).__name__})")


def display_name(claims):
    """A friendly first name for a new learner: from Google's profile, else from the email."""
    meta = claims.get("user_metadata") or {}
    name = (meta.get("full_name") or meta.get("name") or "").strip()
    if name:
        return name.split()[0][:30]
    email = (claims.get("email") or "").split("@")[0]
    cleaned = "".join(ch if ch.isalnum() else " " for ch in email).split()
    return (cleaned[0].capitalize() if cleaned else "Learner")[:30]


def delete_remote_user(uid):
    """Removes the login itself from Supabase (needs SUPABASE_SERVICE_KEY). Returns True when done."""
    key, url = config.supabase_service_key(), config.supabase_url()
    if not key or not url:
        return False
    req = urllib.request.Request(f"{url}/auth/v1/admin/users/{uid}", method="DELETE",
                                 headers={"apikey": key, "Authorization": f"Bearer {key}"})
    try:
        with urllib.request.urlopen(req, timeout=10):
            return True
    except (urllib.error.URLError, OSError):
        return False


def list_remote_users():
    """Every login in Supabase (needs SUPABASE_SERVICE_KEY): [{id, email, provider, created, last_sign_in}].
    Returns None when the key is not set or Supabase can't be reached."""
    key, url = config.supabase_service_key(), config.supabase_url()
    if not key or not url:
        return None
    users, page = [], 1
    while page <= 50:  # 50 pages of 1000 is plenty
        req = urllib.request.Request(f"{url}/auth/v1/admin/users?page={page}&per_page=1000",
                                     headers={"apikey": key, "Authorization": f"Bearer {key}"})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                batch = json.loads(r.read().decode("utf-8")).get("users", [])
        except (urllib.error.URLError, OSError, ValueError):
            return None if page == 1 else users
        for u in batch:
            users.append({
                "id": u.get("id"), "email": u.get("email") or "",
                "provider": ((u.get("app_metadata") or {}).get("provider")) or "",
                "created": (u.get("created_at") or "")[:10], "last_sign_in": (u.get("last_sign_in_at") or "")[:16].replace("T", " "),
            })
        if len(batch) < 1000:
            break
        page += 1
    return users
