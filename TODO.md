# TariffShield — TODO

---

## OPEN — High Priority

### Remove useless GET traffic

- [ ] Remove `GET /api/v1/recommendations/{rec_id}/progress` polling from `frontend/src/pages/RecommendationsPage.jsx` — this 2-second polling is only used for the cosmetic live stage indicator; the page already polls `GET /api/v1/recommendations/{rec_id}` for the real analysis state and results — Owner: Builder — Priority: high
- [ ] Remove the automatic 5-minute `GET /api/v1/news` refresh interval from `frontend/src/pages/DashboardPage.jsx` — keep the initial fetch or convert it to a manual refresh button so the backend is not hit repeatedly for non-essential news updates — Owner: Builder — Priority: high
- [ ] Remove the fallback `GET /api/v1/events` call in `frontend/src/pages/EventsPage.jsx` — `frontend/src/App.jsx` already loads events and passes them into the page, so this extra fetch is redundant in the current SPA flow — Owner: Builder — Priority: high
- [ ] Remove any remaining startup `GET /api/v1/health` call if it still exists in the active branch — it is only used for a liveness badge and is safe to drop if Fly health checks already cover backend availability — Owner: Builder — Priority: high

### GET requests that should stay

- [ ] Keep `GET /api/v1/events` and `GET /api/v1/boms` in `frontend/src/App.jsx` unless the app state-loading flow is redesigned — these are the primary bootstrap requests for the main UI — Owner: Builder — Priority: med
- [ ] Keep `GET /api/v1/boms` in `frontend/src/pages/EventsPage.jsx` unless BOM data is passed down from `App.jsx` — this request is currently needed so the page can choose a BOM for event analysis — Owner: Builder — Priority: med
- [ ] Keep `GET /api/v1/recommendations/{rec_id}` polling in `frontend/src/pages/RecommendationsPage.jsx` unless it is replaced with SSE/WebSockets — this is the request that actually updates analysis status and results while a recommendation is running — Owner: Builder — Priority: med
- [ ] Keep `GET /api/v1/scenarios/{scenario_id}` polling after scenario approval unless supplier search completion is delivered another way — this request is currently how approved scenarios receive supplier results — Owner: Builder — Priority: med
- [ ] Keep `GET /api/v1/audit` only if the Audit page remains a supported feature; if the page is not needed, remove both the route usage and the tab together rather than treating it as silent background traffic — Owner: Builder — Priority: med

### Recommendation flow + status model

- [ ] Unify recommendation statuses across backend and frontend — the UI still contains `awaiting_approval`, `approved`, and `rejected` branches, but the active backend flow mainly returns `running`, `complete`, and `error`; either implement the richer state machine end-to-end or simplify the frontend to match the current API — Owner: Builder — Priority: high
- [ ] Decide whether scenario approval should change recommendation status — `POST /api/v1/scenarios/{scenario_id}/approve` marks a scenario as chosen, but does not update the parent recommendation record to an approval-specific status for the UI/audit trail — Owner: Builder — Priority: high

### API consistency

- [ ] Replace direct `fetch('/api/v1/...')` calls in the frontend with the shared `api()` helper (or equivalent shared base-URL utility) so deployments using `VITE_API_BASE_URL` do not break edit/delete/upload actions — affected spots include `frontend/src/pages/DashboardPage.jsx` and `frontend/src/pages/UploadPage.jsx` — Owner: Builder — Priority: high
- [ ] Add a shared helper for multipart/form-data uploads so file uploads use the same base URL logic as JSON API calls without duplicating fetch behavior — Owner: Builder — Priority: high

### Signal Monitor cleanup

- [ ] Remove the duplicate `_get_writable_path()` definition in `src/agents/signal_monitor.py` and keep a single clear implementation for writable-path fallback behavior — Owner: Builder — Priority: high
- [ ] Separate API-runtime logic from leftover CLI/file-audit behavior in `src/agents/signal_monitor.py` so filesystem persistence for seen IDs and JSONL audit logs is explicit, minimal, and easier to reason about in Vercel/Fly environments — Owner: Builder — Priority: high

---

## OPEN — Product / UX

### Globe + map behavior

- [ ] Replace the hardcoded corridor data in `frontend/src/components/Globe3D.jsx` with event- and BOM-driven mapping so the dashboard reflects actual uploaded supplier countries and event jurisdictions instead of a fixed demo dataset — Owner: Builder — Priority: med
- [ ] Remove the runtime dependency on `https://unpkg.com/world-atlas@2/countries-110m.json` by vendoring the topology asset locally or serving it from the app bundle — Owner: Builder — Priority: med

### Event analysis flow

- [ ] Let the user explicitly choose which BOM to analyze for an event before firing `POST /api/v1/events/{event_id}/analyze`; the current flow defaults to the first loaded BOM, which is risky for multi-product accounts — Owner: Builder — Priority: med
- [ ] Show the selected BOM more clearly in the scenarios/recommendations flow so users can tell which product a recommendation belongs to without cross-checking IDs — Owner: Builder — Priority: med

---

## OPEN — Codebase Hygiene

### Repository cleanup

- [ ] Remove checked-in build artifacts and dependency directories that should not live in git (`frontend/dist`, `frontend/node_modules`) and confirm `.gitignore` covers them correctly — Owner: Builder — Priority: med
- [ ] Reconcile `README.md`, `SPEC.md`, and the implemented code paths so the docs describe the actual current recommendation/approval flow, deployment assumptions, and storage behavior — Owner: Builder — Priority: med

### Testing

- [ ] Replace ad hoc script-style verification in `tests/test_fixes.py` and `tests/verify_todo.py` with a real automated test path (`pytest`-friendly assertions and isolated fixtures/mocks where needed) so regressions are caught consistently — Owner: Builder — Priority: med
- [ ] Add focused tests for recommendation status transitions, scenario approval behavior, and frontend/API base URL handling — Owner: Builder — Priority: med
