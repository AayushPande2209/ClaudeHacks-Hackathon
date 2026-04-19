from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parents[1]
_ENV_PATH = _ROOT / ".env"


def load_app_env() -> None:
    """Load the repo-root .env regardless of current working directory."""
    load_dotenv(_ENV_PATH)


def require_env(name: str) -> str:
    load_app_env()
    value = os.getenv(name, "")
    if not value:
        raise RuntimeError(f"{name} is not set")
    return value


def default_user_id(*, using_supabase: bool = False) -> str:
    """Return the configured app user id.

    In local JSON-store mode we keep the lightweight `demo` fallback.
    In Supabase mode, callers must provide a real auth.users UUID via env.
    """
    load_app_env()
    user_id = os.getenv("APP_DEFAULT_USER_ID", "").strip()
    if user_id:
        return user_id
    if using_supabase:
        # Don't crash on boot, just return a dummy that will fail at the DB level if used.
        # This allows the API to at least start up so the user can see error logs.
        if not user_id:
            print("[env] Warning: APP_DEFAULT_USER_ID not set. Supabase operations will fail.")
            return "00000000-0000-0000-0000-000000000000"
    return user_id or "demo"
