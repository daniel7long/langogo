"""Settings read from environment variables or from backend/.env (copy env.example to .env).

    AZURE_SPEECH_KEY      key of your Azure AI Speech resource (Azure portal > Keys and Endpoint)
    AZURE_SPEECH_REGION   its region, e.g. eastus, westeurope, southeastasia
    LANGOGO_SCORING       "azure" (default when a key is set), or "demo" to force the made-up scores

Real environment variables win over the .env file. No extra packages are needed.
"""
import os
from pathlib import Path

ENV_FILE = Path(__file__).parent / ".env"


def _load_env_file():
    try:
        lines = ENV_FILE.read_text(encoding="utf-8").splitlines()
    except OSError:
        return
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file()


def azure_key():
    return os.getenv("AZURE_SPEECH_KEY", "").strip()


def azure_region():
    return os.getenv("AZURE_SPEECH_REGION", "").strip()


def scoring_engine():
    """"azure" when a key and region are set (unless LANGOGO_SCORING=demo), otherwise "demo"."""
    forced = os.getenv("LANGOGO_SCORING", "").strip().lower()
    if forced == "demo":
        return "demo"
    return "azure" if azure_key() and azure_region() else "demo"


# ---- Accounts (Supabase Auth). Leave SUPABASE_URL empty to run without accounts (one local dev user). ----
def supabase_url():
    return os.getenv("SUPABASE_URL", "").strip().rstrip("/")


def supabase_jwt_secret():
    """Only for projects that still use the legacy HS256 "JWT secret". Newer projects need no secret."""
    return os.getenv("SUPABASE_JWT_SECRET", "").strip()


def supabase_service_key():
    """Optional. Lets "Delete my account" also remove the login itself. Keep it private, server only."""
    return os.getenv("SUPABASE_SERVICE_KEY", "").strip()


def auth_enabled():
    return bool(supabase_url() or supabase_jwt_secret())


def pseudonym_salt():
    """Secret text mixed into the anonymous participant ID used in the research speech log."""
    return os.getenv("LANGOGO_PSEUDONYM_SALT", "langogo-dev-salt")


def demo_leaderboard():
    """Pad the leaderboard with made-up learners until enough real ones exist (set to 0 at launch)."""
    return os.getenv("LANGOGO_DEMO_LEADERBOARD", "1").strip() != "0"


def admin_key():
    """Secret for the /admin/users page. Empty = the page does not exist."""
    return os.getenv("LANGOGO_ADMIN_KEY", "").strip()
