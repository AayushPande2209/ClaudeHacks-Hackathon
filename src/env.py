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
        raise RuntimeError("APP_DEFAULT_USER_ID must be set to a real Supabase auth.users UUID")
    return "demo"
