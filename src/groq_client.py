from __future__ import annotations

import asyncio
import os
import time
from collections import deque

from groq import AsyncGroq

from env import load_app_env, require_env

load_app_env()

# ── Rate limiter: max 50 req/min, max 8 concurrent ──────────────────────────
_MAX_PER_MINUTE = 50
_CONCURRENCY = 8
_groq_semaphore: asyncio.Semaphore | None = None
_request_times: deque[float] = deque()

# Exponential backoff delays (seconds) on 429 or timeout before trying fallback
_BACKOFF_SEQUENCE = [5.0, 10.0, 20.0, 40.0, 60.0]
# Hard per-request timeout — prevents hung calls from stalling the pipeline
_REQUEST_TIMEOUT = 30.0

DEFAULT_PRIMARY_MODEL = "llama-3.3-70b-versatile"
DEFAULT_FALLBACK_MODEL = "openai/gpt-oss-20b"


def _get_semaphore() -> asyncio.Semaphore:
    global _groq_semaphore
    if _groq_semaphore is None:
        try:
            _groq_semaphore = asyncio.Semaphore(_CONCURRENCY)
        except RuntimeError:
            return asyncio.Semaphore(_CONCURRENCY)
    return _groq_semaphore


async def _acquire_slot() -> None:
    """Enforce req/min cap. Must be called while holding the semaphore."""
    now = time.monotonic()
    while _request_times and now - _request_times[0] > 60:
        _request_times.popleft()
    if len(_request_times) >= _MAX_PER_MINUTE:
        wait = 60 - (now - _request_times[0]) + 0.1
        print(f"[Groq] Rate cap reached, waiting {wait:.1f}s")
        await asyncio.sleep(wait)
    _request_times.append(time.monotonic())


def _get_retry_after(exc: Exception) -> float | None:
    """Extract Retry-After header value (seconds) from a 429 exception."""
    try:
        headers = getattr(getattr(exc, "response", None), "headers", None) or {}
        val = headers.get("retry-after") or headers.get("Retry-After")
        if val:
            return max(1.0, float(val))
    except Exception:
        pass
    return None


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
        if body.get("error", {}).get("code") == "rate_limit_exceeded":
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
) -> tuple:
    """Send a chat completion with exponential backoff on 429/timeout.

    Retries primary_model up to len(_BACKOFF_SEQUENCE) times.
    On 429: reads Retry-After header; falls back to exponential sequence otherwise.
    On timeout: uses the same backoff sequence.
    After all retries exhausted, tries fallback_model once.
    """
    last_exc: Exception | None = None

    for attempt in range(len(_BACKOFF_SEQUENCE) + 1):
        if attempt > 0:
            backoff = _BACKOFF_SEQUENCE[attempt - 1]
            print(f"[Groq] {request_name}: retry {attempt}/{len(_BACKOFF_SEQUENCE)} "
                  f"on {primary_model} after {backoff:.0f}s")
            await asyncio.sleep(backoff)

        try:
            async with _get_semaphore():
                await _acquire_slot()
                response = await asyncio.wait_for(
                    client.chat.completions.create(model=primary_model, **kwargs),
                    timeout=_REQUEST_TIMEOUT,
                )
            return response, primary_model

        except asyncio.TimeoutError as exc:
            last_exc = exc
            print(f"[Groq] {request_name}: 30s timeout on {primary_model} (attempt {attempt + 1})")
            # next iteration will sleep the next backoff step

        except Exception as exc:
            if not is_rate_limit_error(exc):
                raise
            last_exc = exc
            retry_after = _get_retry_after(exc)
            if retry_after and retry_after > 60:
                # Retry-After is too long to wait — skip straight to fallback
                print(f"[Groq] {request_name}: 429 — Retry-After={retry_after:.0f}s, skipping to fallback")
                break
            if retry_after and attempt < len(_BACKOFF_SEQUENCE):
                print(f"[Groq] {request_name}: 429 — Retry-After={retry_after:.0f}s")
                await asyncio.sleep(retry_after)
            # else: outer loop applies backoff on next iteration

    # ── Primary exhausted — try fallback once ───────────────────────────────
    if fallback_model and fallback_model != primary_model:
        print(f"[Groq] {request_name}: primary exhausted, trying fallback {fallback_model}")
        try:
            async with _get_semaphore():
                await _acquire_slot()
                response = await asyncio.wait_for(
                    client.chat.completions.create(model=fallback_model, **kwargs),
                    timeout=_REQUEST_TIMEOUT,
                )
            return response, fallback_model
        except Exception as exc:
            raise RuntimeError(
                f"[Groq] {request_name}: fallback {fallback_model} also failed: {exc}"
            ) from exc

    raise last_exc or RuntimeError(
        f"[Groq] {request_name}: {primary_model} exhausted all retries"
    )
