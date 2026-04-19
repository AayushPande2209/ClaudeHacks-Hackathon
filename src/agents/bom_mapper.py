from __future__ import annotations
"""BOM Mapper Agent — cross-references enriched tariff event against company BOM."""

import json
import asyncio
import os
import re
import httpx
from pydantic import BaseModel
from groq_client import chat_with_fallback, create_groq_client, get_fallback_model, get_primary_model
from utils.context_builder import compile_business_context
CHUNK_SIZE = 100

ISO2_TO_NAME: dict[str, str] = {
    "CN": "China", "US": "United States", "TW": "Taiwan", "VN": "Vietnam",
    "BR": "Brazil", "MX": "Mexico", "IN": "India", "KR": "South Korea",
    "DE": "Germany", "JP": "Japan", "CA": "Canada", "GB": "United Kingdom",
    "IT": "Italy", "FR": "France", "ES": "Spain", "NL": "Netherlands",
    "PL": "Poland", "TH": "Thailand", "MY": "Malaysia", "ID": "Indonesia",
    "PH": "Philippines", "SG": "Singapore", "AU": "Australia", "ET": "Ethiopia",
    "BD": "Bangladesh", "PK": "Pakistan", "TR": "Turkey", "CZ": "Czechia",
    "HU": "Hungary", "SE": "Sweden", "RU": "Russia", "UA": "Ukraine",
    "KH": "Cambodia", "MM": "Myanmar", "LK": "Sri Lanka", "CO": "Colombia",
    "ZA": "South Africa", "NG": "Nigeria", "EG": "Egypt", "MA": "Morocco",
    "KE": "Kenya", "GH": "Ghana", "TZ": "Tanzania", "UG": "Uganda",
    "PE": "Peru", "CL": "Chile", "AR": "Argentina", "EC": "Ecuador",
}
_NAME_TO_ISO2: dict[str, str] = {v.lower(): k for k, v in ISO2_TO_NAME.items()}


def _expand_countries(countries: list[str]) -> list[str]:
    """Return list with both ISO-2 codes and full English names so the LLM can match either."""
    expanded: set[str] = set()
    for c in countries:
        c = c.strip()
        if not c:
            continue
        expanded.add(c)
        upper = c.upper()
        lower = c.lower()
        if upper in ISO2_TO_NAME:
            expanded.add(ISO2_TO_NAME[upper])
        if lower in _NAME_TO_ISO2:
            expanded.add(_NAME_TO_ISO2[lower].upper())
    return sorted(expanded)


class BOMAnalysis(BaseModel):
    """Validated output of BOMMapperAgent.run() — SPEC §3.2."""
    affected_skus: list[dict] = []
    total_annual_tariff_impact_usd: float = 0.0
    affected_sku_count: int = 0
    total_sku_count: int = 0
    severity_breakdown: dict = {}

SYSTEM_PROMPT = """<instructions>
You are a supply chain cost analyst. Given a tariff event and a chunk of BOM SKUs,
identify which SKUs are affected and calculate the financial impact.
</instructions>

<context>
Match HS codes aggressively. Also match at 6-digit, 4-digit, and 2-digit parent levels (broad match).
Flag a SKU if EITHER:
- Its hs_code matches the tariff hs_codes at any parent level (e.g., if tariff is 85, and SKU is 8542), OR
- Its supplier_country is in the tariff's affected_countries list.
Be inclusive: if a part is from an affected country, assume it is likely affected unless the description is completely unrelated.
</context>

<task>
For each affected SKU, calculate:
  annual_tariff_impact_usd = annual_spend_usd * (rate_delta_pct / 100)
Assign severity:
  CRITICAL if annual_tariff_impact_usd > 500000
  HIGH     if annual_tariff_impact_usd > 100000
  MEDIUM   if annual_tariff_impact_usd > 10000
  LOW      otherwise
</task>

<output_format>
Return ONLY valid JSON array. Each element:
{
  "sku": "string",
  "description": "string",
  "hs_code": "string",
  "supplier": "string",
  "supplier_country": "string",
  "annual_spend_usd": 0.0,
  "annual_tariff_impact_usd": 0.0,
  "severity": "CRITICAL",
  "match_level": "8-digit",
  "has_domestic_alt": true,
  "alt_supplier": "string or null",
  "lead_time_weeks": 0,
  "critical_path": true
}
No markdown, no explanation. Return ONLY the JSON array (may be empty []).
</output_format>"""


class ScheduleBMatch(BaseModel):
    hs_code: str
    confidence: float


class HTSRates(BaseModel):
    general_rate: str
    special_rates: str
    column_2_rate: str


class BOMMapperAgent:
    def __init__(self):
        self.client = create_groq_client()
        self.primary_model = get_primary_model()
        self.fallback_model = get_fallback_model()
        self.last_model_used = self.primary_model

    async def run(self, enriched_event: dict, bom: list[dict], user_id: str = "") -> dict:
        print(f"\n[BOMMapper] Mapping {len(bom)} SKUs against tariff event")
        self._biz_context = compile_business_context(user_id) if user_id else ""

        # Normalize affected_countries to include both ISO-2 codes and full names
        raw_countries = enriched_event.get("affected_countries") or []
        enriched_event = {
            **enriched_event,
            "affected_countries": _expand_countries(raw_countries),
        }
        if raw_countries:
            print(f"[BOMMapper] affected_countries expanded: {enriched_event['affected_countries']}")

        # Enrich missing HS codes via Census/USITC if keys available
        if os.getenv("CENSUS_API_KEY"):
            bom = await self._enrich_missing_hs_codes(bom)

        bom = await self._infer_missing_supplier_countries(bom)

        chunks = [bom[i:i + CHUNK_SIZE] for i in range(0, len(bom), CHUNK_SIZE)]
        print(f"[BOMMapper] Processing {len(chunks)} chunk(s) of ≤{CHUNK_SIZE} SKUs each")

        chunk_results = await asyncio.gather(
            *[self._process_chunk(enriched_event, chunk, idx) for idx, chunk in enumerate(chunks)],
            return_exceptions=True,
        )

        # --- Emergency Fallback: If AI found nothing, do a manual keyword sweep ---
        if not affected:
            print("[BOMMapper] AI match returned zero; falling back to keyword sweep.")
            target_countries = [c.upper() for c in enriched_event.get("affected_countries", [])]
            target_hs_parents = [h[:2] for h in enriched_event.get("hs_codes", []) if len(h) >= 2]
            
            for r in bom:
                country = (r.get("supplier_country") or "").upper()
                hs = (r.get("hs_code") or "")
                
                # Broad match on country OR HS parent
                if country in target_countries or any(hs.startswith(p) for p in target_hs_parents):
                    affected.append({
                        "sku": r.get("sku_code") or r.get("sku") or "Unknown",
                        "description": r.get("description", "Manual Match"),
                        "hs_code": hs,
                        "supplier": r.get("supplier_name", "Unknown"),
                        "supplier_country": r.get("supplier_country", "Unknown"),
                        "annual_spend_usd": float(r.get("unit_cost_usd", 0)) * float(r.get("annual_quantity", 0)) if r.get("unit_cost_usd") and r.get("annual_quantity") else 0.0,
                        "annual_tariff_impact_usd": 0.0, # Will be estimated below
                        "severity": "MEDIUM",
                        "match_level": "Keyword Fallback",
                    })

        # Calculate impact for all affected (including fallbacks)
        rate_delta = enriched_event.get("rate_change_bps", 0) / 10000.0  # bps to decimal
        for s in affected:
            if s.get("annual_tariff_impact_usd") == 0:
                s["annual_tariff_impact_usd"] = s.get("annual_spend_usd", 0) * rate_delta
            if s.get("severity") == "MEDIUM" and s.get("annual_tariff_impact_usd", 0) > 50000:
                s["severity"] = "HIGH"

        affected.sort(key=lambda x: x.get("annual_tariff_impact_usd", 0), reverse=True)

        bom_by_sku = {}
        for r in bom:
            k = (r.get("sku_code") or r.get("sku") or "").strip()
            if k:
                bom_by_sku[k] = r
        for s in affected:
            key = (s.get("sku") or s.get("sku_code") or "").strip()
            br = bom_by_sku.get(key) or {}
            if br.get("supplier_country_inferred"):
                s["supplier_country_inferred"] = True

        total_impact = sum(s.get("annual_tariff_impact_usd", 0) for s in affected)
        critical_count = sum(1 for s in affected if s.get("severity") == "CRITICAL")
        high_count = sum(1 for s in affected if s.get("severity") == "HIGH")

        print(f"[BOMMapper] Found {len(affected)} affected SKUs, total impact: ${total_impact:,.0f}/yr")

        return BOMAnalysis(
            affected_skus=affected,
            total_annual_tariff_impact_usd=total_impact,
            affected_sku_count=len(affected),
            total_sku_count=len(bom),
            severity_breakdown={
                "CRITICAL": critical_count,
                "HIGH": high_count,
                "MEDIUM": sum(1 for s in affected if s.get("severity") == "MEDIUM"),
                "LOW": sum(1 for s in affected if s.get("severity") == "LOW"),
            },
        ).model_dump()

    async def _process_chunk(self, event: dict, chunk: list[dict], idx: int) -> list[dict]:
        prompt = (
            f"Tariff Event:\n{json.dumps(event, indent=2)}\n\n"
            f"BOM Chunk {idx + 1} ({len(chunk)} SKUs):\n{json.dumps(chunk, indent=2)}"
        )

        response, model_used = await chat_with_fallback(
            self.client,
            primary_model=self.primary_model,
            fallback_model=self.fallback_model,
            request_name=f"bom_mapper.chunk_{idx + 1}",
            max_tokens=4096,
            messages=[
                {"role": "system", "content": f"{self._biz_context}\n\n{SYSTEM_PROMPT}".strip() if getattr(self, '_biz_context', '') else SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        self.last_model_used = model_used

        text = response.choices[0].message.content or ""

        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

        try:
            result = json.loads(text)
            return result if isinstance(result, list) else []
        except Exception:
            start = text.find("[")
            end = text.rfind("]") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start:end])
                except Exception:
                    pass
        return []

    # ------------------------------------------------------------------
    # Census & USITC HTS Lookup Logic
    # ------------------------------------------------------------------

    async def _enrich_missing_hs_codes(self, bom: list[dict]) -> list[dict]:
        """Fill in missing HS codes — single batched LLM call to conserve rate limits."""
        rows_to_enrich = [r for r in bom if not r.get("hs_code")]
        if not rows_to_enrich:
            return bom

        print(f"[BOMMapper] Enriching {len(rows_to_enrich)} rows with missing HS codes (batched)...")
        items = "\n".join(
            f"{i+1}. {r.get('sku_code','?')} | {r.get('description','')}"
            for i, r in enumerate(rows_to_enrich)
        )
        response, model_used = await chat_with_fallback(
            self.client,
            primary_model=self.primary_model,
            fallback_model=self.fallback_model,
            request_name="bom_mapper.batch_hs_classify",
            messages=[
                {"role": "system", "content": (
                    "You are an HTS classification expert. Given a numbered list of products, "
                    "return ONLY a JSON array where each element is {\"index\": N, \"hs_code\": \"XXXX.XX\"}. "
                    "Use 6-digit HS codes. No markdown, no explanation."
                )},
                {"role": "user", "content": items},
            ],
        )
        self.last_model_used = model_used
        text = (response.choices[0].message.content or "").strip()
        if text.startswith("```"):
            text = "\n".join(text.split("\n")[1:])
            text = text.rstrip("`").strip()
        try:
            results = json.loads(text)
            lookup = {r["index"]: r["hs_code"] for r in results if "index" in r and "hs_code" in r}
            for i, row in enumerate(rows_to_enrich):
                code = lookup.get(i + 1)
                if code:
                    row["hs_code"] = code
                    print(f"[BOMMapper] {row.get('sku_code')}: resolved HS {code}")
        except Exception as exc:
            print(f"[BOMMapper] Batch HS classification failed: {exc}")
        return bom

    async def _infer_missing_supplier_countries(self, bom: list[dict]) -> list[dict]:
        """Best-effort ISO-3166 alpha-2 from supplier name when country column is empty."""
        needs = [
            r
            for r in bom
            if not str(r.get("supplier_country") or "").strip()
            and str(r.get("supplier_name") or r.get("supplier") or "").strip()
        ]
        if not needs:
            return bom

        print(f"[BOMMapper] Inferring supplier country for {len(needs)} row(s) from supplier name…")
        items = "\n".join(
            f"{i + 1}. supplier={json.dumps(r.get('supplier_name') or r.get('supplier', ''))} "
            f"sku={json.dumps(r.get('sku_code', ''))} "
            f"desc={json.dumps((r.get('description') or '')[:160])}"
            for i, r in enumerate(needs)
        )
        response, model_used = await chat_with_fallback(
            self.client,
            primary_model=self.primary_model,
            fallback_model=self.fallback_model,
            request_name="bom_mapper.batch_infer_supplier_country",
            max_tokens=2048,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Given a numbered list of suppliers and product hints, infer the most likely "
                        "manufacturing/shipping country as ISO 3166-1 alpha-2 (two letters, e.g. CN, VN, US). "
                        "Return ONLY a JSON array: "
                        '[{"index":1,"inferred_country":"CN","confidence":0.0-1.0},...]. '
                        "No markdown."
                    ),
                },
                {"role": "user", "content": items},
            ],
        )
        self.last_model_used = model_used
        text = (response.choices[0].message.content or "").strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        iso_to_english = {
            "CN": "China", "US": "United States", "TW": "Taiwan", "VN": "Vietnam",
            "BR": "Brazil", "MX": "Mexico", "IN": "India", "KR": "South Korea",
            "DE": "Germany", "JP": "Japan", "CA": "Canada", "GB": "United Kingdom",
            "IT": "Italy", "FR": "France", "ES": "Spain", "NL": "Netherlands",
            "PL": "Poland", "TH": "Thailand", "MY": "Malaysia", "ID": "Indonesia",
            "PH": "Philippines", "SG": "Singapore", "AU": "Australia", "NZ": "New Zealand",
            "TR": "Turkey", "CZ": "Czechia", "HU": "Hungary", "SE": "Sweden",
        }
        try:
            results = json.loads(text)
            if not isinstance(results, list):
                results = []
            lookup = {}
            for item in results:
                if not isinstance(item, dict):
                    continue
                idx = item.get("index")
                code = (item.get("inferred_country") or item.get("country") or "").strip().upper()
                if isinstance(idx, int) and len(code) == 2:
                    lookup[idx] = code
            for i, row in enumerate(needs):
                code = lookup.get(i + 1)
                if not code:
                    continue
                name = iso_to_english.get(code, code).title()
                row["supplier_country"] = name
                row["supplier_country_inferred"] = True
                print(f"[BOMMapper] {row.get('sku_code')}: inferred country {code} → {name}")
        except Exception as exc:
            print(f"[BOMMapper] Batch supplier-country inference failed: {exc}")
        return bom

    async def lookup_tariff_rate(self, product_description: str) -> HTSRates | None:
        """Chain Clean -> Census -> USITC lookups."""
        cleaned = await self._clean_description(product_description)
        match = await self._census_schedule_b_lookup(cleaned)
        if not match:
            return None
        return await self._usitc_hts_lookup(match.hs_code)

    async def _clean_description(self, description: str) -> str:
        """Standardize description into trade-ready terminology."""
        prompt = f"Clean this product description for HTS lookup: {description}"
        response, model_used = await chat_with_fallback(
            self.client,
            primary_model=self.primary_model,
            fallback_model=self.fallback_model,
            request_name="bom_mapper.clean_description",
            messages=[
                {"role": "system", "content": "Return ONLY a concise, trade-standard product description (e.g. 'lithium-ion battery packs'). No punctuation."},
                {"role": "user", "content": prompt}
            ],
        )
        self.last_model_used = model_used
        return response.choices[0].message.content.strip()

    async def _census_schedule_b_lookup(self, cleaned_desc: str) -> ScheduleBMatch | None:
        """Call Census Bureau Schedule B Search API."""
        api_key = os.getenv("CENSUS_API_KEY")
        if not api_key:
            return None
        
        url = "https://api.census.gov/data/timeseries/intltrade/exports/scheduleb"
        params = {
            "get": "SCHEDULEB,SCHEDULEB_DESC",
            "SEARCH": cleaned_desc,
            "key": api_key
        }
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    if len(data) > 1:
                        # Census returns [header, [val1, val2]]
                        hs_code = data[1][0]
                        return ScheduleBMatch(hs_code=hs_code, confidence=0.9)
            except Exception as exc:
                from db.supabase_store import store
                store.log_agent_run({
                    "agent_name": "bom_mapper_census_api",
                    "model": self.last_model_used,
                    "input_payload": {"query": cleaned_desc},
                    "output_payload": {"error": str(exc)},
                })
                print(f"[BOMMapper] Census API error: {exc}")
        return None

    async def _llm_classify_hs_code(self, cleaned_desc: str) -> ScheduleBMatch | None:
        """Use Groq LLM to classify an HS code from a product description."""
        response, model_used = await chat_with_fallback(
            self.client,
            primary_model=self.primary_model,
            fallback_model=self.fallback_model,
            request_name="bom_mapper.llm_hs_classify",
            messages=[
                {"role": "system", "content": (
                    "You are an expert in HTS (Harmonized Tariff Schedule) classification. "
                    "Given a product description, return ONLY the most likely 6-digit HS code "
                    "in the format XXXX.XX with no explanation, no markdown, nothing else."
                )},
                {"role": "user", "content": f"Product: {cleaned_desc}"},
            ],
        )
        self.last_model_used = model_used
        raw = (response.choices[0].message.content or "").strip()
        # Extract first HS-like pattern (digits and dots, 6+ chars)
        m = re.search(r"\d{4}\.?\d{2}", raw)
        if m:
            return ScheduleBMatch(hs_code=m.group(0), confidence=0.7)
        return None

    async def _usitc_hts_lookup(self, hs_code: str) -> HTSRates | None:
        """Call USITC HTS API for live rates."""
        # Normalize: remove dots if present, take first 10 digits
        clean_code = hs_code.replace(".", "")[:10]
        url = f"https://hts.usitc.gov/api/search?query={clean_code}"
        
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    # USITC can return a list or a dict with 'results'
                    results = data if isinstance(data, list) else data.get("results", [])
                    if results:
                        r = results[0]
                        return HTSRates(
                            general_rate=r.get("general_rate", "0%"),
                            special_rates=r.get("special_rates", "None"),
                            column_2_rate=r.get("column_2_rate", "0%")
                        )
            except Exception as exc:
                from db.supabase_store import store
                store.log_agent_run({
                    "agent_name": "bom_mapper_usitc_api",
                    "model": self.last_model_used,
                    "input_payload": {"hs_code": hs_code},
                    "output_payload": {"error": str(exc)},
                })
                print(f"[BOMMapper] USITC API error: {exc}")
        return None
