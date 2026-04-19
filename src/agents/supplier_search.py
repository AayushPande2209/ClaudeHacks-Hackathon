from __future__ import annotations

import json
import os

from groq_client import chat_with_fallback, create_groq_client, get_fallback_model, get_primary_model
from tools.tavily_client import TavilyClient

SYSTEM_BY_TYPE = {
    "reshore": """You name real or plausibly real US-based manufacturers and distributors for the given parts.
Prefer specific company names; use website_or_notes for company site URL or one-line sourcing note.
Output ONLY a JSON array of 3-5 objects with keys: company_name, country (ISO-2, US), website_or_notes, estimated_lead_time_weeks (int), rationale (one sentence).""",
    "nearshore": """You name suppliers in Mexico or Canada suitable for USMCA-advantaged sourcing for the given parts.
Output ONLY a JSON array of 3-5 objects with keys: company_name, country (ISO-2, MX or CA), website_or_notes, estimated_lead_time_weeks (int), rationale (one sentence).""",
    "dual_source": """You name alternative foreign suppliers in countries NOT listed as high-tariff jurisdictions for this event.
Avoid supplier countries that match the tariff event's affected jurisdictions when possible.
Output ONLY a JSON array of 3-5 objects with keys: company_name, country (ISO-2), website_or_notes, estimated_lead_time_weeks (int), rationale (one sentence).""",
}


def _strip_json_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return text.strip()


class SupplierSearchAgent:
    def __init__(self):
        self.client = create_groq_client()
        self.primary_model = get_primary_model()
        self.fallback_model = get_fallback_model()
        self.last_model_used = self.primary_model

    async def run(
        self,
        *,
        scenario_type: str,
        enriched_event: dict,
        affected_skus: list[dict],
        bom_rows: list[dict],
        tavily_snippets: list[dict] | None = None,
    ) -> list[dict]:
        st = (scenario_type or "").strip().lower()
        system = SYSTEM_BY_TYPE.get(
            st,
            SYSTEM_BY_TYPE["dual_source"],
        )
        user_payload = {
            "scenario_type": st,
            "tariff_event": {
                "title": enriched_event.get("title"),
                "hs_codes": enriched_event.get("hs_codes") or enriched_event.get("hs_codes_hint"),
                "jurisdictions": enriched_event.get("jurisdictions") or enriched_event.get("affected_countries_hint"),
                "affected_countries": enriched_event.get("affected_countries"),
            },
            "affected_skus": affected_skus[:40],
            "bom_context": [
                {
                    "sku_code": r.get("sku_code"),
                    "description": r.get("description"),
                    "hs_code": r.get("hs_code"),
                    "supplier_country": r.get("supplier_country"),
                }
                for r in (bom_rows or [])[:40]
            ],
            "web_search_snippets": tavily_snippets or [],
        }
        user_text = json.dumps(user_payload, indent=2)[:24000]

        response, model_used = await chat_with_fallback(
            self.client,
            primary_model=self.primary_model,
            fallback_model=self.fallback_model,
            request_name="supplier_search",
            max_tokens=4096,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_text},
            ],
        )
        self.last_model_used = model_used
        text = response.choices[0].message.content or "[]"
        text = _strip_json_fence(text)
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            start, end = text.find("["), text.rfind("]") + 1
            if start >= 0 and end > start:
                data = json.loads(text[start:end])
            else:
                data = []

        if not isinstance(data, list):
            data = []

        normalized = []
        for item in data[:8]:
            if not isinstance(item, dict):
                continue
            normalized.append({
                "company_name": str(item.get("company_name", "")).strip() or "Unknown",
                "country": str(item.get("country", "")).strip() or "—",
                "website_or_notes": str(item.get("website_or_notes", "")).strip() or "—",
                "estimated_lead_time_weeks": int(item.get("estimated_lead_time_weeks") or 0) or 8,
                "rationale": str(item.get("rationale", "")).strip() or "—",
            })

        while len(normalized) < 3:
            normalized.append({
                "company_name": "Additional sourcing needed",
                "country": "—",
                "website_or_notes": "Run search again with more BOM detail",
                "estimated_lead_time_weeks": 12,
                "rationale": "Model returned fewer than 3 candidates; placeholder.",
            })
        return normalized[:5]


async def maybe_tavily_context(scenario_type: str, enriched_event: dict, affected_skus: list[dict]) -> list[dict]:
    """One Tavily query when API key is set; otherwise empty list (agent still runs)."""
    if not os.getenv("TAVILY_API_KEY"):
        return []
    hs = enriched_event.get("hs_codes") or enriched_event.get("hs_codes_hint") or []
    hs_part = " ".join(str(h) for h in hs[:4])
    descs = " ".join(
        str(s.get("description") or s.get("sku") or "") for s in (affected_skus or [])[:5]
    )
    query = f"{scenario_type} supplier manufacturers {hs_part} {descs}"[:400]
    client = TavilyClient()
    return await client.search(query, count=5)
