from __future__ import annotations
"""API-mode pipeline: runs agents, streams progress, returns ranked scenarios."""

import json
import asyncio
import time
import traceback
from datetime import datetime, timezone

from pydantic import ValidationError
from agents.signal_monitor import SignalMonitorAgent, EnrichedEvent
from agents.bom_mapper import BOMMapperAgent, BOMAnalysis
from agents.scenario_modeler import run_parallel_scenarios
from db.supabase_store import store
from groq_client import chat_with_fallback, create_groq_client, get_fallback_model, get_primary_model

MODEL_PLANNER = get_primary_model()
MODEL_BUILDER = get_primary_model()
MODEL_FALLBACK = get_fallback_model()

SYNTHESIZE_SYSTEM = """<instructions>
You are a supply chain strategy synthesizer. Rank 3 parallel scenario analyses.
Consider: cost impact (lower is better), lead time (lower is better), risk (lower is better),
supplier_coverage_pct (higher is better). Weight cost and risk equally.
</instructions>
<task>
Rank the 3 scenarios from best (rank=1) to worst (rank=3).
Add "rank" (int) and "recommendation_rationale" (str, 1-2 sentences) to each.
Return all 3 with rank added.
</task>
<output_format>
Return ONLY valid JSON array. No markdown.
</output_format>"""


def _progress(rec_id: str, stage: str, status: str, detail: str = ""):
    store.push_progress(rec_id, {
        "stage": stage,
        "status": status,
        "detail": detail,
        "ts": datetime.now(timezone.utc).isoformat(),
    })


async def _synthesize(scenarios: list[dict]) -> tuple[list[dict], str]:
    client = create_groq_client()
    # Filter out failed scenario stubs before synthesis
    valid_scenarios = [s for s in scenarios if not s.get("parse_error") and not s.get("failed_stub")]
    if not valid_scenarios:
        for i, s in enumerate(scenarios):
            s["rank"] = i + 1
            s["recommendation_rationale"] = "Synthesis skipped — all scenarios failed."
        return scenarios, "none"

    try:
        response, model_used = await chat_with_fallback(
            client,
            primary_model=MODEL_PLANNER,
            fallback_model=MODEL_FALLBACK,
            request_name="pipeline.synthesize",
            max_tokens=4096,
            messages=[
                {"role": "system", "content": SYNTHESIZE_SYSTEM},
                {"role": "user", "content": json.dumps(valid_scenarios, indent=2)}
            ],
        )
    except Exception as exc:
        print(f"[Groq] pipeline.synthesize: both models failed ({exc}), using cost-based ranking")
        sorted_s = sorted(valid_scenarios, key=lambda x: x.get("annual_cost_delta_usd", float("inf")))
        for i, s in enumerate(sorted_s):
            s["rank"] = i + 1
            s["recommendation_rationale"] = "Auto-ranked by cost impact (LLM synthesis unavailable)."
        return sorted_s, "none"
    text = response.choices[0].message.content or "[]"
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        ranked = json.loads(text)
        if isinstance(ranked, list):
            ranked.sort(key=lambda x: x.get("rank", 99))
            return ranked, model_used
    except Exception:
        start, end = text.find("["), text.rfind("]") + 1
        if start >= 0 and end > start:
            try:
                ranked = json.loads(text[start:end])
                ranked.sort(key=lambda x: x.get("rank", 99))
                return ranked, model_used
            except Exception:
                pass
    for i, s in enumerate(scenarios):
        s["rank"] = i + 1
        s["recommendation_rationale"] = "Ranking unavailable."
    return scenarios, model_used


async def run_pipeline(rec_id: str, event_id: str, bom_id: str, user_id: str = ""):
    """Full pipeline run for API mode. Stores result; no interactive prompts."""
    store.init_progress(rec_id)
    started_at = datetime.now(timezone.utc).isoformat()

    try:
        raw_event = store.get_event(event_id)
        if not raw_event:
            raise ValueError(f"Event {event_id} not found")

        # ── Stage 1: Signal Monitor + BOM row fetch (parallel) ───────────
        # Both are independent — run concurrently to save 1–3s
        _progress(rec_id, "signal_monitor", "running", "Enriching tariff signal…")
        _t0 = time.monotonic()
        _stage_started = datetime.now(timezone.utc).isoformat()
        signal_agent = SignalMonitorAgent()

        enriched_event, bom_rows = await asyncio.gather(
            signal_agent.run(raw_event, user_id=user_id, mode="enrich"),
            asyncio.to_thread(store.get_bom_rows, bom_id),
        )

        if not bom_rows:
            raise ValueError(f"BOM {bom_id} has no rows")
        try:
            enriched_event = EnrichedEvent(**enriched_event).model_dump()
        except ValidationError as exc:
            store.log_agent_run({
                "rec_id": rec_id, "agent_name": "signal_monitor_validation", "model": signal_agent.last_model_used,
                "output_payload": {"validation_error": str(exc)},
                "started_at": _stage_started, "ended_at": datetime.now(timezone.utc).isoformat(),
            })
            raise
        store.log_agent_run({
            "rec_id": rec_id, "agent_name": "signal_monitor", "model": signal_agent.last_model_used,
            "input_payload": raw_event, "output_payload": enriched_event,
            "started_at": _stage_started,
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "latency_ms": int((time.monotonic() - _t0) * 1000),
        })
        _progress(rec_id, "signal_monitor", "done",
                  f"Confidence {enriched_event.get('confidence_score', '?')} · {len(enriched_event.get('hs_codes', []))} HS codes")

        # ── Stage 2: BOM Mapper ─────────────────────────────────────────
        _progress(rec_id, "bom_mapper", "running", "Mapping SKUs to HS codes…")
        _t0 = time.monotonic()
        _stage_started = datetime.now(timezone.utc).isoformat()
        bom_agent = BOMMapperAgent()
        bom_analysis = await bom_agent.run(enriched_event, bom_rows, user_id=user_id)
        try:
            bom_analysis = BOMAnalysis(**bom_analysis).model_dump()
        except ValidationError as exc:
            store.log_agent_run({
                "rec_id": rec_id, "agent_name": "bom_mapper_validation", "model": bom_agent.last_model_used,
                "output_payload": {"validation_error": str(exc)},
                "started_at": _stage_started, "ended_at": datetime.now(timezone.utc).isoformat(),
            })
            raise
        affected = len(bom_analysis.get("affected_skus", []))
        exposure = bom_analysis.get("total_annual_tariff_impact_usd", 0)
        store.log_agent_run({
            "rec_id": rec_id, "agent_name": "bom_mapper", "model": bom_agent.last_model_used,
            "input_payload": {"event_id": event_id, "bom_id": bom_id},
            "output_payload": {"affected": affected, "exposure_usd": exposure},
            "started_at": _stage_started,
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "latency_ms": int((time.monotonic() - _t0) * 1000),
        })
        _progress(rec_id, "bom_mapper", "done",
                  f"{affected} SKUs affected · ${exposure:,.0f}/yr exposure")

        # ── Stage 3: Parallel Scenario Modeler ─────────────────────────
        if not bom_analysis.get("affected_skus"):
            _progress(rec_id, "scenario_modeler", "done", "No affected SKUs — no scenarios to model")
            store.update_recommendation(rec_id, {
                "status": "complete",
                "enriched_event": enriched_event,
                "bom_analysis": bom_analysis,
                "ranked_scenarios": [],
            })
            return

        _progress(rec_id, "scenario_modeler", "running", "Running 3 sub-agents in parallel…")
        scenarios = await run_parallel_scenarios(enriched_event, bom_analysis, user_id=user_id)
        _progress(rec_id, "scenario_modeler", "done", f"{len(scenarios)} scenarios ready")

        # ── Synthesize + Rank ───────────────────────────────────────────
        _progress(rec_id, "synthesizer", "running", "Ranking scenarios…")
        ranked, synth_model = await _synthesize(scenarios)
        _progress(rec_id, "synthesizer", "done",
                  f"Top pick: {ranked[0].get('strategy', ranked[0].get('scenario_type', '?'))} (rank 1)")
        store.log_agent_run({
            "rec_id": rec_id, "agent_name": "synthesizer", "model": synth_model,
            "input_payload": {"scenario_count": len(scenarios)},
            "output_payload": {"ranked_count": len(ranked)},
            "started_at": datetime.now(timezone.utc).isoformat(),
            "ended_at": datetime.now(timezone.utc).isoformat(),
        })

        store.save_scenarios(rec_id, ranked)
        store.update_recommendation(rec_id, {
            "status": "complete",
            "enriched_event": enriched_event,
            "bom_analysis": bom_analysis,
            "ranked_scenarios": ranked,
        })

    except Exception as exc:
        tb = traceback.format_exc()
        _progress(rec_id, "pipeline", "error", str(exc))
        store.update_recommendation(rec_id, {
            "status": "error",
            "error": str(exc),
        })
        store.log_agent_run({
            "rec_id": rec_id, "agent_name": "pipeline", "model": MODEL_BUILDER,
            "output_payload": {"error": str(exc)},
            "ended_at": datetime.now(timezone.utc).isoformat(),
        })
