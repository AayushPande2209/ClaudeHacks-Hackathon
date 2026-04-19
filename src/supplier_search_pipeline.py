from __future__ import annotations

import traceback
from datetime import datetime, timezone

from agents.supplier_search import SupplierSearchAgent, maybe_tavily_context
from db.supabase_store import store


async def run_supplier_search(scenario_id: str, rec_id: str) -> None:
    """Background job: LLM (+ optional Tavily) supplier candidates → scenarios.supplier_results."""
    try:
        scenario = store.get_scenario(scenario_id)
        if not scenario or scenario.get("recommendation_id") != rec_id:
            return
        rec = store.get_recommendation(rec_id)
        if not rec:
            return
        bom_id = rec.get("bom_id")
        enriched = rec.get("enriched_event") or {}
        bom_analysis = rec.get("bom_analysis") or {}
        if not bom_id:
            store.update_scenario_supplier_results(scenario_id, [])
            return

        bom_rows = store.get_bom_rows(bom_id)
        affected = bom_analysis.get("affected_skus") or []
        scenario_type = scenario.get("scenario_type") or ""

        tavily_snippets = await maybe_tavily_context(scenario_type, enriched, affected)

        agent = SupplierSearchAgent()
        results = await agent.run(
            scenario_type=scenario_type,
            enriched_event=enriched,
            affected_skus=affected if isinstance(affected, list) else [],
            bom_rows=bom_rows,
            tavily_snippets=tavily_snippets,
        )
        store.update_scenario_supplier_results(scenario_id, results)
        store.log_agent_run({
            "rec_id": rec_id,
            "agent_name": "supplier_search",
            "model": agent.last_model_used,
            "input_payload": {"scenario_id": scenario_id, "scenario_type": scenario_type},
            "output_payload": {"count": len(results)},
            "started_at": datetime.now(timezone.utc).isoformat(),
            "ended_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        tb = traceback.format_exc()
        store.log_agent_run({
            "rec_id": rec_id,
            "agent_name": "supplier_search",
            "model": "",
            "output_payload": {"error": str(exc), "traceback": tb},
            "ended_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            store.update_scenario_supplier_results(scenario_id, [])
        except Exception:
            pass
