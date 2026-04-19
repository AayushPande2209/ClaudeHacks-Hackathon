from __future__ import annotations
"""TariffShield — FastAPI backend. All endpoints per SPEC.md §5."""

from env import load_app_env
load_app_env()

import asyncio
import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from db.supabase_store import store
from db.supabase_client import db as _db
from data.bom_loader import extract_pdf_text, parse_bom_csv
from env import default_user_id
from pipeline import run_pipeline
from supplier_search_pipeline import run_supplier_search
from agents.bom_mapper import BOMMapperAgent
from groq_client import chat_with_fallback, create_groq_client, get_fallback_model, get_primary_model

_INTERNAL_TOKEN = os.getenv("INTERNAL_TOKEN", "")
_DEFAULT_USER_ID = default_user_id(using_supabase=bool(_db))

app = FastAPI(title="TariffShield API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ────────────────────────────────────────────────────────────────────────────
# Request / response models
# ────────────────────────────────────────────────────────────────────────────

class UserPatch(BaseModel):
    company_name: str | None = None
    signature: str | None = None
    tone_preference: str | None = None



class RawEventIn(BaseModel):
    """Manual tariff event submission for triggering pipeline."""
    event_id: str | None = None
    title: str
    description: str
    hs_codes_hint: list[str] = []
    affected_countries_hint: list[str] = []
    rate_change_hint: str = ""
    effective_date_hint: str = ""
    source: str = "manual"
    url: str = ""


class AnalyzeRequest(BaseModel):
    bom_id: str
    user_id: str | None = None


# ────────────────────────────────────────────────────────────────────────────
# Health
# ────────────────────────────────────────────────────────────────────────────

@app.get("/api/v1/health")
def health():
    return {"status": "ok", "ts": datetime.now(timezone.utc).isoformat()}


# ────────────────────────────────────────────────────────────────────────────
# Auth & Profile (simplified — single demo user)
# ────────────────────────────────────────────────────────────────────────────

_profile = {
    "id": _DEFAULT_USER_ID,
    "company_name": "Acme Imports LLC",
    "signature": "Supply Chain Team\nAcme Imports LLC",
    "tone_preference": "formal",
}


@app.get("/api/v1/me")
def get_me():
    return _profile


@app.patch("/api/v1/me")
def patch_me(body: UserPatch):
    if body.company_name is not None:
        _profile["company_name"] = body.company_name
    if body.signature is not None:
        _profile["signature"] = body.signature
    if body.tone_preference is not None:
        _profile["tone_preference"] = body.tone_preference
    return _profile


# ────────────────────────────────────────────────────────────────────────────
# Onboarding
# ────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/onboarding")
async def onboarding(
    user_id: str = Form(_DEFAULT_USER_ID),
    company_name: str = Form(""),
    industry: str = Form(""),
    products: str = Form(""),
    supplier_countries: str = Form(""),   # JSON array string e.g. '["CN","MX"]'
    monthly_import_usd: float = Form(0.0),
    supplier_relationships: str = Form(""),
    tariff_concern: str = Form(""),
    tone_preference: str = Form("formal"),
    bom_csv: UploadFile = File(None),
    pdfs: list[UploadFile] = File(default=[]),
):
    """Submit onboarding survey + materials + optional PDFs.
    Writes/upserts business_profiles row and creates a BOM if CSV/TSV provided.
    Returns { business_profile_id, bom_id }.
    """
    # Parse supplier_countries from JSON array string
    try:
        countries = json.loads(supplier_countries) if supplier_countries else []
    except Exception:
        countries = [c.strip() for c in supplier_countries.split(",") if c.strip()]

    # Extract PDF text
    pdf_text_parts = []
    for pdf_file in (pdfs or []):
        if pdf_file and pdf_file.filename:
            raw = await pdf_file.read()
            try:
                pdf_text_parts.append(extract_pdf_text(raw))
            except Exception as e:
                pdf_text_parts.append(f"[PDF extraction failed: {e}]")
    pdf_text = "\n\n".join(pdf_text_parts) or None

    # Upsert business_profiles
    profile_row = {
        "id": user_id,
        "company_name": company_name or None,
        "industry": industry or None,
        "products": products or None,
        "supplier_countries": countries,
        "monthly_import_usd": monthly_import_usd or None,
        "supplier_relationships": supplier_relationships or None,
        "tariff_concern": tariff_concern or None,
        "tone_preference": tone_preference,
        "pdf_text": pdf_text,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    # Upsert business_profiles via store abstraction (handles local/supabase)
    store.upsert_business_profile(profile_row)

    # Parse + store uploaded materials if provided
    bom_id = None
    if bom_csv and bom_csv.filename:
        content = await bom_csv.read()
        parsed = parse_bom_csv(content, filename=bom_csv.filename or "materials.csv")
        rows = parsed["rows"]
        if rows:
            bom_name = (bom_csv.filename or "bom").rsplit(".", 1)[0]
            bom = store.create_bom(bom_name, user_id=user_id)
            store.add_bom_rows(bom["id"], rows)
            bom_id = bom["id"]

    return {"business_profile_id": user_id, "bom_id": bom_id}


# ────────────────────────────────────────────────────────────────────────────
# BOM Management
# ────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/boms")
async def upload_bom(file: UploadFile = File(...)):
    """Accept a CSV/TSV or JSON materials upload. Returns parsed rows + validation report."""
    content = await file.read()
    filename = file.filename or "bom"
    name = filename.rsplit(".", 1)[0]

    rows, errors = [], []

    if filename.endswith(".json"):
        try:
            data = json.loads(content)
            if isinstance(data, list):
                raw_rows = data
            else:
                raw_rows = data.get("rows", data.get("bom", []))
        except Exception as e:
            raise HTTPException(400, f"Invalid JSON: {e}")
        for i, r in enumerate(raw_rows):
            rows.append(_normalize_row(r, i, errors))
    else:
        parsed = parse_bom_csv(content, filename=filename)
        rows = parsed["rows"]
        errors = parsed["errors"]

    if not rows:
        raise HTTPException(400, "No rows found in upload")

    bom = store.create_bom(name, user_id=_DEFAULT_USER_ID)
    stored_rows = store.add_bom_rows(bom["id"], rows)

    return {
        "bom": {**bom, "rows": stored_rows},
        "row_count": len(stored_rows),
        "validation_errors": errors,
    }


def _normalize_row(r: dict, i: int, errors: list) -> dict:
    # flexible field name mapping
    out = {}
    out["sku_code"] = (r.get("sku_code") or r.get("sku") or r.get("SKU", f"SKU-{i:04d}")).strip()
    out["description"] = (r.get("description") or r.get("Description", "")).strip()
    out["supplier_name"] = (r.get("supplier_name") or r.get("supplier") or r.get("Supplier", "")).strip()
    out["supplier_country"] = (r.get("supplier_country") or r.get("country") or r.get("Country", "")).strip()
    out["tier"] = int(r.get("tier") or r.get("Tier") or 1)
    try:
        out["annual_quantity"] = int(float(r.get("annual_quantity") or r.get("annual_volume_units") or r.get("qty") or 0))
    except Exception:
        out["annual_quantity"] = 0
        errors.append(f"Row {i}: invalid annual_quantity")
    try:
        out["unit_cost_usd"] = float(r.get("unit_cost_usd") or r.get("unit_cost") or 0)
    except Exception:
        out["unit_cost_usd"] = 0.0
    out["hs_code"] = (r.get("hs_code") or r.get("HS") or r.get("hts_code") or "").strip() or None
    out["annual_spend_usd"] = float(r.get("annual_spend_usd") or r.get("annual_spend") or
                                     out["annual_quantity"] * out["unit_cost_usd"])
    out["has_domestic_alt"] = str(r.get("has_domestic_alt", "false")).lower() in ("true", "1", "yes")
    out["alt_supplier"] = r.get("alt_supplier") or r.get("alternative_supplier") or None
    out["lead_time_weeks"] = r.get("lead_time_weeks") or r.get("lead_time") or None
    out["critical_path"] = str(r.get("critical_path", "false")).lower() in ("true", "1", "yes")
    return out


@app.get("/api/v1/boms")
def list_boms(user_id: str | None = None):
    boms = store.list_boms(user_id=user_id or _DEFAULT_USER_ID)
    return [store.get_bom(b["id"]) or b for b in boms]


@app.get("/api/v1/boms/{bom_id}")
def get_bom(bom_id: str):
    bom = store.get_bom(bom_id)
    if not bom:
        raise HTTPException(404, "BOM not found")
    return bom


@app.delete("/api/v1/boms/{bom_id}")
def delete_bom(bom_id: str):
    store.soft_delete_bom(bom_id)
    return {"status": "deleted"}


async def _generate_bom_tariff_event(bom_id: str, bom_name: str, rows: list[dict]) -> str | None:
    """One LLM call: identify existing US tariffs on the uploaded BOM rows, create + store an event."""
    rows_with_hs = [r for r in rows if r.get("hs_code") or r.get("supplier_country")]
    if not rows_with_hs:
        return None
    summary = "\n".join(
        f"- {r.get('sku_code','?')} | {r.get('description','')} | country: {r.get('supplier_country','unknown')} | hs: {r.get('hs_code','unknown')}"
        for r in rows_with_hs
    )
    client = create_groq_client()
    response, _ = await chat_with_fallback(
        client,
        primary_model=get_primary_model(),
        fallback_model=get_fallback_model(),
        request_name="upload.tariff_event_gen",
        messages=[
            {"role": "system", "content": (
                "You are a US trade compliance expert. Given a list of BOM parts with supplier countries and HS codes, "
                "identify which parts face EXISTING US import tariffs (Section 301 China tariffs, Section 232 steel/aluminum, "
                "antidumping duties, or other active tariffs as of 2025-2026). "
                "Return ONLY valid JSON with this exact structure, no markdown:\n"
                '{"title": "string", "description": "string (2-3 sentences)", '
                '"hs_codes": ["list of affected hs codes"], "affected_countries": ["list"], '
                '"rate_change_hint": "e.g. 0% → 25% Section 301", "threat_level": "HIGH|MEDIUM|LOW"}'
            )},
            {"role": "user", "content": f"BOM: {bom_name}\n\nParts:\n{summary}"},
        ],
    )
    text = (response.choices[0].message.content or "").strip()
    if text.startswith("```"):
        text = "\n".join(text.split("\n")[1:]).rstrip("`").strip()
    try:
        data = json.loads(text)
        # Parse "X% → Y%" into rate_change_bps so it persists in DB
        rate_hint = data.get("rate_change_hint", "")
        rate_change_bps = None
        try:
            import re as _re
            nums = _re.findall(r"[\d.]+", rate_hint)
            if len(nums) >= 2:
                rate_change_bps = int((float(nums[1]) - float(nums[0])) * 100)
            elif len(nums) == 1:
                rate_change_bps = int(float(nums[0]) * 100)
        except Exception:
            pass
        event = {
            "id": str(uuid.uuid4()),
            "source": "bom-upload",
            "title": data.get("title", f"Existing Tariffs: {bom_name}"),
            "description": data.get("description", ""),
            "url": f"internal:bom:{bom_id}",
            "hs_codes": data.get("hs_codes", []),
            "jurisdictions": data.get("affected_countries", []),
            "rate_change_bps": rate_change_bps,
            "threat_level": data.get("threat_level", "MEDIUM"),
            "hs_codes_hint": data.get("hs_codes", []),
            "affected_countries_hint": data.get("affected_countries", []),
            "published_at": datetime.now(timezone.utc).isoformat(),
            "raw_excerpt": data.get("description", f"Tariff event for {bom_name}"),
            "content_hash": f"bom-upload-{bom_id}",
        }
        stored = store.upsert_event(event)
        return stored.get("id") or event["id"]
    except Exception as exc:
        print(f"[upload] Tariff event generation failed: {exc}")
        return None


@app.post("/api/v1/materials/upload")
async def upload_materials(
    bom_csv: UploadFile = File(None),
    pdfs: list[UploadFile] = File(default=[]),
    user_id: str = Form(_DEFAULT_USER_ID),
):
    """Upload a materials spreadsheet (CSV/TSV) and optional PDFs.
    Returns bom_id, row preview, and extracted PDF text length.
    """
    if not bom_csv and not pdfs:
        raise HTTPException(400, "At least one file is required")

    bom_id = None
    row_count = 0
    preview_rows: list[dict] = []
    validation_errors: list[str] = []
    pdf_chars = 0

    if bom_csv and bom_csv.filename:
        content = await bom_csv.read()
        name = (bom_csv.filename or "materials").rsplit(".", 1)[0]
        parsed = parse_bom_csv(content, filename=bom_csv.filename)
        rows = parsed["rows"]
        validation_errors = parsed["errors"]
        if not rows:
            raise HTTPException(400, "No rows found in spreadsheet")
        # Enrich missing HS codes before storing
        try:
            mapper = BOMMapperAgent()
            rows = await mapper._enrich_missing_hs_codes(rows)
        except Exception as e:
            validation_errors.append(f"HS enrichment skipped: {e}")
        bom = store.create_bom(name, user_id=user_id)
        store.add_bom_rows(bom["id"], rows)
        bom_id = bom["id"]
        row_count = len(rows)
        preview_rows = [
            {k: r[k] for k in ("sku_code", "description", "supplier_country", "unit_cost_usd", "hs_code") if k in r}
            for r in rows[:5]
        ]
        tariff_event_id = await _generate_bom_tariff_event(bom_id, name, rows)

    pdf_parts: list[str] = []
    for pdf in (pdfs or []):
        if pdf and pdf.filename:
            raw = await pdf.read()
            try:
                pdf_parts.append(extract_pdf_text(raw))
            except Exception as e:
                validation_errors.append(f"PDF {pdf.filename}: {e}")
    if pdf_parts:
        pdf_chars = sum(len(t) for t in pdf_parts)
        if bom_id:
            store.update_bom_pdf_notes(bom_id, "\n\n".join(pdf_parts))
        elif pdf_parts:
            bom = store.create_bom("pdf-materials", user_id=user_id)
            store.update_bom_pdf_notes(bom["id"], "\n\n".join(pdf_parts))
            bom_id = bom["id"]

    return {
        "bom_id": bom_id,
        "row_count": row_count,
        "preview_rows": preview_rows,
        "pdf_chars_extracted": pdf_chars,
        "validation_errors": validation_errors,
        "tariff_event_id": tariff_event_id if bom_id else None,
    }


# ────────────────────────────────────────────────────────────────────────────
# Tariff Events
# ────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/events")
def create_event(body: RawEventIn):
    """Manually submit a tariff event (for demo / testing)."""
    event_id = body.event_id or str(uuid.uuid4())
    event = {
        "id": event_id,
        "source": body.source,
        "title": body.title,
        "description": body.description,
        "url": body.url,
        "hs_codes": body.hs_codes_hint,
        "jurisdictions": body.affected_countries_hint,
        "rate_change_hint": body.rate_change_hint,
        "effective_date_hint": body.effective_date_hint,
        "published_at": datetime.now(timezone.utc).isoformat(),
        "raw_excerpt": body.description,
        "content_hash": hashlib.sha256((body.title + body.description).encode()).hexdigest(),
        # keep raw fields for orchestrator
        "event_id": event_id,
        "hs_codes_hint": body.hs_codes_hint,
        "affected_countries_hint": body.affected_countries_hint,
        "rate_change_hint": body.rate_change_hint,
        "effective_date_hint": body.effective_date_hint,
    }
    stored = store.upsert_event(event)
    return stored


def _enrich_event_display(ev: dict) -> dict:
    """Add derived display fields not stored in DB."""
    bps = ev.get("rate_change_bps")
    if bps is not None:
        old_pct = 0
        new_pct = round(bps / 100, 1)
        ev["rate_change_hint"] = f"{old_pct}% → {new_pct}%"
        ev["threat_level"] = "HIGH" if new_pct >= 25 else "MEDIUM" if new_pct >= 10 else "LOW"
    elif not ev.get("rate_change_hint"):
        ev["rate_change_hint"] = ev.get("raw_excerpt", "")[:60] or None
    return ev


@app.get("/api/v1/events")
def list_events(page: int = 1, per_page: int = 20):
    all_events = [_enrich_event_display(e) for e in store.list_events()]
    start = (page - 1) * per_page
    return {
        "events": all_events[start: start + per_page],
        "total": len(all_events),
        "page": page,
        "per_page": per_page,
    }


@app.get("/api/v1/events/{event_id}")
def get_event(event_id: str):
    ev = store.get_event(event_id)
    if not ev:
        raise HTTPException(404, "Event not found")
    # attach recommendations for this event
    recs = [r for r in store.list_recommendations(user_id=_DEFAULT_USER_ID)
            if r["event_id"] == event_id]
    return {**ev, "recommendations": recs}


# ────────────────────────────────────────────────────────────────────────────
# Scenarios & Recommendations
# ────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/events/{event_id}/analyze")
def analyze_event(event_id: str, body: AnalyzeRequest, background_tasks: BackgroundTasks):
    """Trigger BOM Mapper + Scenario Modeler. Returns recommendation_id immediately."""
    ev = store.get_event(event_id)
    if not ev:
        raise HTTPException(404, "Event not found")
    bom = store.get_bom(body.bom_id)
    if not bom:
        raise HTTPException(404, "BOM not found")

    user_id = body.user_id or _DEFAULT_USER_ID
    rec = store.create_recommendation(event_id, body.bom_id, user_id=user_id)
    background_tasks.add_task(_run_bg, rec["id"], event_id, body.bom_id, user_id)
    return {"recommendation_id": rec["id"], "status": "running"}


def _run_bg(rec_id: str, event_id: str, bom_id: str, user_id: str = ""):
    asyncio.run(run_pipeline(rec_id, event_id, bom_id, user_id=user_id))


def _merge_ranked_scenarios_with_db_rows(ranked: list | None, db_rows: list[dict]) -> list[dict]:
    """Attach scenario_id, chosen, supplier_results from scenarios table for per-scenario approve + polling."""
    if not ranked:
        return []
    pool = list(db_rows)
    out: list[dict] = []
    for s in ranked:
        sm = dict(s)
        st = (s.get("strategy") or s.get("scenario_type") or "").strip()
        rk = s.get("rank")
        idx = None
        for i, row in enumerate(pool):
            if row.get("rank") == rk and (row.get("scenario_type") or "").strip() == st:
                idx = i
                break
        if idx is None:
            for i, row in enumerate(pool):
                if (row.get("scenario_type") or "").strip() == st:
                    idx = i
                    break
        if idx is not None:
            row = pool.pop(idx)
            sm["scenario_id"] = row["id"]
            sm["chosen"] = bool(row.get("chosen"))
            sm["supplier_results"] = row.get("supplier_results")
        out.append(sm)
    return out


@app.get("/api/v1/recommendations/{rec_id}")
def get_recommendation(rec_id: str):
    rec = store.get_recommendation(rec_id)
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    ranked = rec.get("ranked_scenarios") or []
    db_rows = store.list_scenarios_for_recommendation(rec_id)
    rec = dict(rec)
    rec["ranked_scenarios"] = _merge_ranked_scenarios_with_db_rows(
        ranked if isinstance(ranked, list) else [],
        db_rows,
    )
    return rec


def _run_supplier_search_bg(scenario_id: str, rec_id: str):
    asyncio.run(run_supplier_search(scenario_id, rec_id))


@app.post("/api/v1/scenarios/{scenario_id}/approve")
def approve_scenario(scenario_id: str, background_tasks: BackgroundTasks):
    scenario = store.get_scenario(scenario_id)
    if not scenario:
        raise HTTPException(404, "Scenario not found")
    rec_id = scenario["recommendation_id"]
    rec = store.get_recommendation(rec_id)
    if not rec:
        raise HTTPException(404, "Recommendation not found")

    siblings = store.list_scenarios_for_recommendation(rec_id)
    other_chosen = [s for s in siblings if s.get("chosen") and s["id"] != scenario_id]
    if other_chosen:
        raise HTTPException(
            status_code=409,
            detail="Another scenario is already approved for this recommendation",
        )

    has_results = scenario.get("supplier_results")
    results_complete = isinstance(has_results, list) and len(has_results) > 0

    store.mark_chosen_scenario(scenario_id)

    if not results_complete:
        background_tasks.add_task(_run_supplier_search_bg, scenario_id, rec_id)

    return {"ok": True, "scenario_id": scenario_id}


@app.get("/api/v1/scenarios/{scenario_id}")
def get_scenario(scenario_id: str):
    row = store.get_scenario(scenario_id)
    if not row:
        raise HTTPException(404, "Scenario not found")
    return row


@app.get("/api/v1/recommendations")
def list_recommendations(user_id: str | None = None):
    return store.list_recommendations(user_id=user_id or _DEFAULT_USER_ID)




# ────────────────────────────────────────────────────────────────────────────
# SSE — pipeline progress streaming
# ────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/recommendations/{rec_id}/approve")
def approve_recommendation(rec_id: str):
    rec = store.get_recommendation(rec_id)
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    store.update_recommendation(rec_id, {"status": "approved"})
    return {"status": "approved"}


@app.post("/api/v1/recommendations/{rec_id}/reject")
def reject_recommendation(rec_id: str):
    rec = store.get_recommendation(rec_id)
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    store.update_recommendation(rec_id, {"status": "rejected"})
    return {"status": "rejected"}


@app.get("/api/v1/recommendations/{rec_id}/stream")
async def stream_progress(rec_id: str):
    """Server-Sent Events stream of pipeline stage updates."""

    async def event_generator() -> AsyncGenerator[str, None]:
        offset = 0
        while True:
            rec = store.get_recommendation(rec_id)
            events = store.get_progress_since(rec_id, offset)
            for ev in events:
                yield f"data: {json.dumps(ev)}\n\n"
                offset += 1

            if rec and rec.get("status") in ("awaiting_approval", "approved", "rejected", "error"):
                # pipeline finished — send final state and close
                yield f"data: {json.dumps({'stage': 'done', 'status': rec['status'], 'rec': rec})}\n\n"
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ────────────────────────────────────────────────────────────────────────────
# Internal / Admin
# ────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/internal/poll-signals")
async def poll_signals(request: Request):
    """Trigger Signal Monitor Federal Register poll. Requires Bearer INTERNAL_TOKEN."""
    auth = request.headers.get("Authorization", "")
    if not _INTERNAL_TOKEN or auth != f"Bearer {_INTERNAL_TOKEN}":
        raise HTTPException(401, "Unauthorized")
    from agents.signal_monitor import SignalMonitorAgent

    agent = SignalMonitorAgent()
    try:
        (fed_events, _), news_signals = await asyncio.gather(
            agent.poll_federal_register(),
            agent.poll_news_sources(),
        )
    except Exception as e:
        return {"status": "error", "message": str(e), "events_found": 0}

    stored = []
    for ev in fed_events:
        normalized = {
            "id": str(uuid.uuid4()),
            "source": "federal_register",
            "title": ev.get("title", ""),
            "description": ev.get("abstract", ev.get("raw_excerpt", "")),
            "url": ev.get("url", ""),
            "hs_codes": ev.get("hs_codes", []),
            "jurisdictions": ev.get("jurisdictions", []),
            "rate_change_bps": ev.get("rate_change_bps"),
            "published_at": ev.get("published_at", datetime.now(timezone.utc).isoformat()),
            "raw_excerpt": ev.get("raw_excerpt", ""),
            "content_hash": ev.get("content_hash") or hashlib.sha256(ev.get("title", "").encode()).hexdigest(),
            "event_id": ev.get("document_number", str(uuid.uuid4())),
            "hs_codes_hint": ev.get("hs_codes", []),
            "affected_countries_hint": ev.get("jurisdictions", []),
        }
        stored.append(store.upsert_event(normalized))

    for sig in news_signals:
        event_id = str(uuid.uuid4())
        normalized = {
            "id": event_id, "event_id": event_id,
            "source": "news",
            "title": sig.get("title", ""),
            "description": sig.get("raw_excerpt", ""),
            "url": sig.get("source_url", ""),
            "hs_codes": sig.get("hs_codes", []),
            "jurisdictions": sig.get("affected_countries", []),
            "rate_change_hint": sig.get("rate_change_hint", ""),
            "threat_level": sig.get("threat_level", "MEDIUM"),
            "published_at": datetime.now(timezone.utc).isoformat(),
            "raw_excerpt": sig.get("raw_excerpt", ""),
            "content_hash": hashlib.sha256(sig.get("title", "").encode()).hexdigest(),
            "hs_codes_hint": sig.get("hs_codes", []),
            "affected_countries_hint": sig.get("affected_countries", []),
        }
        stored.append(store.upsert_event(normalized))

    return {"status": "ok", "events_found": len(stored), "fed_reg": len(fed_events), "news": len(news_signals)}


@app.get("/api/v1/audit")
def get_audit():
    return store.get_agent_runs()


# ────────────────────────────────────────────────────────────────────────────
# Demo seed — load sample data so the UI has something to show immediately
# ────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/demo/seed")
def seed_demo():
    """Wipe and re-seed the coffee shop demo: 3 products + realistic tariff event."""
    # Always wipe existing demo data for a clean state
    for bom in store.list_boms(user_id=_DEFAULT_USER_ID):
        store.soft_delete_bom(bom["id"])

    # Tariff event: 25% on Brazilian coffee + Chinese grinder components
    demo_event = {
        "id": "00000000-0000-0000-0000-c0ffee000001",
        "event_id": "00000000-0000-0000-0000-c0ffee000001",
        "source": "manual",
        "title": "25% Tariff on Brazilian Coffee Imports + Chinese Grinder Components",
        "description": "New 25% Section 301 tariff on green coffee beans from Brazil and burr grinder components from China, effective June 1 2026.",
        "url": "https://ustr.gov/tariff-actions/2026/coffee-grinder",
        "hs_codes": ["0901.11", "8509.40", "8509.90"],
        "jurisdictions": ["BR", "CN"],
        "rate_change_hint": "0% → 25%",
        "effective_date_hint": "2026-06-01",
        "hs_codes_hint": ["0901.11", "8509.40", "8509.90"],
        "affected_countries_hint": ["BR", "CN"],
        "published_at": datetime.now(timezone.utc).isoformat(),
        "raw_excerpt": "USTR announces 25% tariff on Brazilian coffee and Chinese grinder parts effective June 2026",
        "content_hash": "demo-coffee-seed-v1",
        "threat_level": "HIGH",
    }
    store.upsert_event(demo_event)

    # Product 1: Precision Grinder
    bom1 = store.create_bom("Precision Grinder", user_id=_DEFAULT_USER_ID)
    store.add_bom_rows(bom1["id"], [
        {"sku_code": "GRD-001", "description": "Burr grind motor 600W", "supplier_country": "China",
         "unit_cost_usd": 42.00, "annual_quantity": 500, "annual_spend_usd": 21000, "hs_code": "8509.40"},
        {"sku_code": "GRD-002", "description": "Die-cast grind housing", "supplier_country": "Taiwan",
         "unit_cost_usd": 18.00, "annual_quantity": 500, "annual_spend_usd": 9000, "hs_code": "7616.99"},
        {"sku_code": "GRD-003", "description": "Digital control PCB", "supplier_country": "China",
         "unit_cost_usd": 12.50, "annual_quantity": 500, "annual_spend_usd": 6250, "hs_code": "8537.10"},
    ])

    # Product 2: Barista Shirts
    bom2 = store.create_bom("Barista Shirts", user_id=_DEFAULT_USER_ID)
    store.add_bom_rows(bom2["id"], [
        {"sku_code": "SHT-001", "description": "Cotton blend barista shirt", "supplier_country": "Vietnam",
         "unit_cost_usd": 9.00, "annual_quantity": 2000, "annual_spend_usd": 18000, "hs_code": "6205.20"},
    ])

    # Product 3: House Blend
    bom3 = store.create_bom("House Blend Coffee", user_id=_DEFAULT_USER_ID)
    store.add_bom_rows(bom3["id"], [
        {"sku_code": "COF-001", "description": "Green coffee beans Santos grade", "supplier_country": "Brazil",
         "unit_cost_usd": 6.00, "annual_quantity": 5000, "annual_spend_usd": 30000, "hs_code": "0901.11"},
        {"sku_code": "COF-002", "description": "Packaging bags kraft paper", "supplier_country": "United States",
         "unit_cost_usd": 0.40, "annual_quantity": 5000, "annual_spend_usd": 2000, "hs_code": "4819.20"},
    ])

    return {
        "seeded": True,
        "event_id": demo_event["id"],
        "bom_ids": [bom1["id"], bom2["id"], bom3["id"]],
    }
