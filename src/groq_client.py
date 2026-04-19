from __future__ import annotations

import asyncio
import os
import time

from groq import AsyncGroq

from env import load_app_env, require_env

load_app_env()

# ── Rate limiter: max 28 req/min, max 4 concurrent ──────────────────────────
_MAX_PER_MINUTE = 28
_CONCURRENCY = 4
_groq_semaphore = asyncio.Semaphore(_CONCURRENCY)
_request_times: list[float] = []

async def _rate_limited_call(coro):
    """Enforce req/min cap + concurrency limit before executing a Groq call."""
    async with _groq_semaphore:
        now = time.monotonic()
        # Drop timestamps older than 60 s
        while _request_times and now - _request_times[0] > 60:
            _request_times.pop(0)
        if len(_request_times) >= _MAX_PER_MINUTE:
            wait = 60 - (now - _request_times[0]) + 0.1
            print(f"[Groq] Rate cap reached, waiting {wait:.1f}s")
            await asyncio.sleep(wait)
        _request_times.append(time.monotonic())
        return await coro

DEFAULT_PRIMARY_MODEL = "llama-3.3-70b-versatile"
DEFAULT_FALLBACK_MODEL = "openai/gpt-oss-20b"


def create_groq_client() -> AsyncGroq:
    return AsyncGroq(api_key=require_env("GROQ_API_KEY"))


def get_primary_model() -> str:
    return os.getenv("GROQ_MODEL_PRIMARY", DEFAULT_PRIMARY_MODEL).strip() or DEFAULT_PRIMARY_MODEL


def get_fallback_model() -> str:
    return os.getenv("GROQ_MODEL_FALLBACK", DEFAULT_FALLBACK_MODEL).strip() or DEFAULT_FALLBACK_MODEL


def is_rate_limit_error(exc: Exception) -> bool:
    status_code = getattr(exc, "status_code", None)
    if status_code == 429:
        return True

    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        error = body.get("error", {})
        if error.get("code") == "rate_limit_exceeded":
            return True

    text = str(exc).lower()
    return "rate limit" in text or "rate_limit_exceeded" in text or "error code: 429" in text


async def chat_with_fallback(
    client: AsyncGroq,
    *,
    primary_model: str,
    fallback_model: str | None = None,
    request_name: str = "Groq request",
    **kwargs,
):
    try:
        response = await _rate_limited_call(
            client.chat.completions.create(model=primary_model, **kwargs)
        )
        return response, primary_model
    except Exception as exc:
        if not fallback_model or fallback_model == primary_model or not is_rate_limit_error(exc):
            raise

        print(f"[Groq] {request_name} hit rate limit on {primary_model}; retrying with {fallback_model}")
        response = await _rate_limited_call(
            client.chat.completions.create(model=fallback_model, **kwargs)
        )
        return response, fallback_model
