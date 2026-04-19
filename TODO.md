# TariffShield — TODO

---

## OPEN — Blocking (server won't run correctly without these)

### Environment / startup

- [x] Move `load_dotenv()` (and the `from dotenv import load_dotenv` import) to the very top of `src/api.py`, before any other import that reads env vars — currently it lives only in `main.py` which is never executed when uvicorn runs `uvicorn api:app`; without this fix `GROQ_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are all `None` at runtime — Owner: Builder — Priority: high
- [x] In `frontend/vite.config.js` change the dev server port from `3000` to `5173` (Vite's default), or remove the explicit port entirely — the proxy config only applies when Vite runs on port 3000, but Vite is binding to 5173, so all `/api/*` calls hit the Vite static server instead of FastAPI → 502 — Owner: Builder — Priority: high

### HITL Gate — complete the removal (blocks clean startup)

- [x] Delete `src/agents/hitl_gate.py` entirely — Owner: Builder — Priority: high
- [x] In `src/agents/orchestrator.py`: remove Stage 4 `HITLGateAgent` import and call; pipeline now ends after Orchestrator ranking — Owner: Builder — Priority: high
- [x] In `src/pipeline.py`: remove `from agents.hitl_gate import HITLGateAgent` (line 16) and all remaining HITL references; pipeline ends at scenario ranking — Owner: Builder — Priority: high
- [x] In `src/api.py`: remove `POST /api/v1/recommendations/{rec_id}/approve` and `POST /api/v1/recommendations/{rec_id}/reject` route handlers — Owner: Builder — Priority: high
- [x] Write Supabase migration `db/migrations/002_drop_hitl_columns.sql` to drop `status` and `approved_at` from the `recommendations` table — Owner: Builder — Priority: high

---

## OPEN — Must Fix

### BOM Mapper — live API wiring (broken despite [x] status)

- [x] In `src/agents/bom_mapper.py` inside `_enrich_missing_hs_codes()` (lines ~165–185): replace the placeholder comment with a real call to `_census_schedule_b_lookup(row["description"])` → if result is not None, call `_usitc_hts_lookup(result.hs_code)` → write the resolved HS code back to the row dict and log the result; handle None returns from either step gracefully (leave hs_code as-is and continue) — Owner: Builder — Priority: high
- [x] Verify that `_census_schedule_b_lookup()` and `_usitc_hts_lookup()` exceptions are logged (not silently swallowed) — currently both are wrapped in bare `except` that return `None` with no log entry; add a `store.log_agent_run()` call on exception so failures are visible in the audit trail — Owner: Builder — Priority: high

### Reviewer Fixes — R1

- [x] **Issue 1** — Add `get_profile(user_id: str) -> dict | None` to `SupabaseStore` in `src/db/supabase_store.py` querying `business_profiles` where `user_id` matches — Owner: Builder — Priority: high
- [x] **Issue 1** — In `src/utils/context_builder.py`: replace the `hasattr(store, "_supabase_profile")` branch with a direct call to `store.get_profile(user_id)`; handle `None` gracefully (return a minimal context block with "No business profile found") — Owner: Builder — Priority: high
- [x] **Issue 2** — Add `pdfplumber` to `requirements.txt` as a hard dependency; in `src/data/bom_loader.py` remove the `except ImportError: os.system(...)` block entirely — Owner: Builder — Priority: high
- [x] **Issue 3** — In `src/api.py` replace `str(hash(body.title + body.description))` with `hashlib.sha256((body.title + body.description).encode()).hexdigest()`; add `import hashlib` — Owner: Builder — Priority: high
- [x] **Issue 4** — In `src/api.py` on `POST /api/v1/internal/poll-signals`: read `INTERNAL_TOKEN` from env at startup; reject requests where `Authorization` header != `Bearer $INTERNAL_TOKEN` with a 401 — Owner: Builder — Priority: high
- [x] **Issue 4** — Add `INTERNAL_TOKEN` to `.env` with a randomly generated value — Owner: Builder — Priority: high
- [x] **Issue 5** — In `src/pipeline.py`: record `start = time.monotonic()` before each agent `.run()` call; compute `latency_ms = int((time.monotonic() - start) * 1000)` after; replace split partial log calls with a single complete `store.log_agent_run()` containing `agent_name`, `model`, `input_payload`, `output_payload`, and `latency_ms` — fix for Signal Monitor (lines ~203–213) and BOM Mapper (lines ~223–227) — Owner: Builder — Priority: high
- [x] **Issue 6** — In `src/pipeline.py` change `_AGENTS_PATH` to `str(Path(__file__).parent)`; apply the same fix to the duplicate broken path in `src/api.py:440` and `src/api.py:487` — Owner: Builder — Priority: high
- [x] **Issue 7** — Declare `EnrichedEvent` Pydantic model in `src/agents/signal_monitor.py` matching SPEC.md §3.1; wrap `SignalMonitorAgent.run()` return: `return EnrichedEvent(**result).model_dump()` — Owner: Builder — Priority: high
- [x] **Issue 7** — Declare `BOMAnalysis` Pydantic model in `src/agents/bom_mapper.py` matching SPEC.md §3.2; wrap `BOMMapperAgent.run()` return: `return BOMAnalysis(**result).model_dump()` — Owner: Builder — Priority: high
- [x] **Issue 7** — In `src/pipeline.py`: after each agent `.run()` call re-validate against the corresponding Pydantic model; on `ValidationError` log to `agent_runs` and raise so the pipeline halts cleanly — Owner: Builder — Priority: high

---

## OPEN — Recommendation ERROR (new bugs found 2026-04-19)

- [x] In `src/db/supabase_store.py` `create_recommendation()`: remove `draft_email` and `approved_at` from the inserted row dict — confirmed clean; migration 002 only drops `draft_email` and `approved_at`, `status` preserved — Owner: Builder — Priority: high
- [x] In `db/migrations/002_drop_hitl_columns.sql`: confirmed SQL only drops `approved_at` and `draft_email`; `status` preserved — Owner: Builder — Priority: high
- [x] In `frontend/src/pages/RecommendationsPage.jsx`: when `rec.status === 'error'`, render `rec.error` in a red alert box — already implemented — Owner: Builder — Priority: high

---

## OPEN — Should Fix

- [x] **S1** — In `src/api.py` pass the authenticated user's ID to `store.list_boms(user_id=current_user_id)` and `store.list_recommendations(user_id=current_user_id)`; update `SupabaseStore` to filter by `user_id` in both methods — Owner: Builder — Priority: med
- [x] **S2** — In `src/api.py` compute `event_id = body.event_id or str(uuid.uuid4())` once before the dict literal and reference that variable for both `"id"` and `"event_id"` keys — Owner: Builder — Priority: med
- [x] **S3** — In `src/pipeline.py` replace `bom_analysis.get('summary', {})` with the real exposure fields from `BOMAnalysis` (`affected_skus`, `total_annual_tariff_impact_usd`) and pass them into the scenario ranking prompt — Owner: Builder — Priority: med

---

## DONE — Tavily Migration

- [x] Add `tavily-python` to `requirements.txt`; create `src/tools/tavily_client.py` with a `TavilyClient` class that calls `tavily.search(query, max_results=count)` and normalizes each result to `{title, url, description, published}` — Owner: Builder
- [x] In `src/agents/signal_monitor.py`: replace `BraveMCPClient` with `TavilyClient`; rename tool to `"tavily_search"`; rename `_execute_brave_search` → `_execute_tavily_search` — Owner: Builder
- [x] In `.env`: consolidate to `TAVILY_API_KEY`; delete `src/tools/mcp_client.py` — Owner: Builder

---

## DONE — Supabase Migration

- [x] Add `supabase` to `requirements.txt`; create `src/db/supabase_client.py` with singleton `db` — Owner: Builder
- [x] Write `db/migrations/001_initial_schema.sql` with all tables from SPEC.md §6 and RLS policies — Owner: Builder
- [x] Run migration against Supabase project; verify tables and RLS active — Owner: Builder
- [x] Write `src/db/supabase_store.py` with full 17-method store interface backed by live Supabase queries; keep `_progress` dict in-memory — Owner: Builder
- [x] Replace `from store import store` with `from db.supabase_store import store` in `api.py` and `pipeline.py`; delete `src/store.py` and `src/data/store.json` — Owner: Builder
- [x] Fix `.env` typos: `GROQ_API` → `GROQ_API_KEY`; confirm all Supabase keys read via `os.getenv` in `supabase_client.py` — Owner: Builder

---

## DONE — Onboarding

- [x] Build multi-step onboarding survey in React — fields: business name, industry, products, supplier countries (multiselect ISO-3166), monthly import volume USD, existing supplier relationships, biggest tariff concern — Owner: Builder
- [x] Build BOM CSV upload component in React with client-side row validation (required columns: `sku_code`, `description`, `supplier_country`, `unit_cost_usd`) — Owner: Builder
- [x] Build optional PDF upload component in React (accepts multiple files) — Owner: Builder
- [x] Add `pdfplumber` to `requirements.txt` and write `extract_pdf_text(pdf_file) -> str` in `data/bom_loader.py` — Owner: Builder
- [x] Create `business_profiles` table in Supabase per SPEC.md §6; enable RLS `user_id = auth.uid()`; upsert on re-submit — Owner: Builder
- [x] Implement `POST /api/v1/onboarding` FastAPI endpoint — multipart form with survey fields + BOM CSV + PDFs; returns `{ business_profile_id, bom_id }` — Owner: Builder
- [x] Write `compile_business_context(user_id) -> str` in `utils/context_builder.py` — Owner: Builder
- [x] Thread `business_context` into the system prompt of all three agents (Signal Monitor, BOM Mapper, Scenario Modeler) — Owner: Builder

---

## DONE — Data Integration

- [x] Add Federal Register REST API client to `signal_monitor.py` — built `tools/federal_register.py` with `FederalRegisterClient`; paginates until no new `document_number`s seen — Owner: Builder
- [x] Update dedup logic in `signal_monitor.py` to key on `document_number`; persisted in `data/seen_document_numbers.json` — Owner: Builder
- [x] Write extraction prompt that returns `hs_codes`, `jurisdictions`, `effective_date`, `rate_change_bps` in `FedRegDocExtraction` Pydantic model — Owner: Builder
- [x] Log every Federal Register API call to `agent_runs` via `_log_agent_run()` — Owner: Builder
- [x] Write description-cleaning prompt in `bom_mapper.py`; `DESCRIPTION_CLEANER_SYSTEM` + `_clean_description()` method — Owner: Builder
- [x] Implement Census Schedule B API client — `_census_schedule_b_lookup()` + `ScheduleBMatch` Pydantic model — Owner: Builder
- [x] Implement USITC HTS API client — `_usitc_hts_lookup()` + `HTSRates` model — Owner: Builder
- [x] Chain Census → USITC into `lookup_tariff_rate(product_description)` in `bom_mapper.py` — no local caching — Owner: Builder
