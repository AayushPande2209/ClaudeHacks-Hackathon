# ⚔️ Espada — Strategic Sourcing & Real-Time Tariff Protection Engine

> Built for the **ClaudeHacks Hackathon · April 2026**

Espada (formerly **TariffShield**) is an AI-powered intelligence platform that protects small business importers from sudden tariff shocks. Upload your Bill of Materials, and Espada watches trade policy feeds around the clock — alerting you to emerging risks and automatically generating ranked alternative sourcing strategies before costs spiral out of control.

**Live demo:** [claude-hacks-hackathon.vercel.app](https://claude-hacks-hackathon.vercel.app)

---

## Table of Contents

- [The Problem](#the-problem)
- [How It Works](#how-it-works)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Sample Data](#sample-data)

---

## The Problem

Trade policy changes faster than procurement teams can react. A tariff announcement on a Monday can double landed costs by Thursday — leaving small importers scrambling for alternatives with no data, no time, and no clear options.

Espada closes that gap by continuously monitoring authoritative sources (the Federal Register, live trade news) and translating policy signals into concrete, ranked sourcing scenarios tailored to your specific Bill of Materials.

---

## How It Works

1. **Upload your BOM** — CSV files with SKU codes, supplier countries, and spend data.
2. **Espada monitors 24/7** — the Signal Monitor agent polls the Federal Register API and Tavily web search for emerging tariff events.
3. **Exposure is scored** — the BOM Mapper agent enriches your parts list with HS codes and quantifies per-SKU tariff impact in dollars.
4. **Three scenarios are generated in parallel** — Reshore, Nearshore, and Dual-Source alternatives are produced concurrently and ranked by cost delta, lead time, and confidence.
5. **You act** — ranked recommendations appear on your dashboard with enough detail to go straight to your procurement team.

---

## Key Features

- **Real-Time Signal Monitoring** — Polls the Federal Register REST API and Tavily Search to detect tariff events as they are published. LLM extraction pulls HS codes, affected jurisdictions, rate deltas, and threat levels from raw document text.
- **Intelligent BOM Analysis** — Upload messy CSVs. The BOM Mapper cleans product descriptions, resolves HS codes via the Census Bureau Schedule B API, and fetches live tariff rates from the USITC HTS API.
- **Parallel Scenario Modeling** — Three sub-agents (Reshore, Nearshore, Dual-Source) run concurrently via `asyncio.gather()` and are ranked by a composite score covering landed cost delta, lead time change, and source confidence.
- **Business Context Personalization** — Every agent prompt is enriched with a compiled `business_context` block drawn from your onboarding profile, so recommendations reflect your industry, supplier relationships, and import volume.
- **Full Audit Trail** — Every agent invocation is logged to `agent_runs` with inputs, outputs, model, and latency. Past recommendations preserve full scenario lineage for review.

---

## Architecture

Espada is built on a distributed multi-agent pipeline:

```
[Federal Register API]   [Tavily API]
            \             /
             v           v
        [Signal Monitor] ────> tariff_events (Supabase)
                                       │
                                       v
                              [BOM Mapper] ───> exposure_scores (Supabase)
                                       │
                                       v
              ┌─────────[Scenario Modeler — asyncio.gather()]──────────┐
              v                        v                               v
         [Reshore]               [Nearshore]                   [Dual-Source]
              \________________________│______________________________/
                                       v
                          [Orchestrator ranking — Llama 3.3 70B]
                                       │
                                       v
                            recommendations (Supabase)
                                       │
                                       v
                             [React Dashboard — Vercel]
```

### Agents

| Agent | Role | LLM Calls |
|---|---|---|
| **Signal Monitor** | Detects & enriches tariff events from Federal Register + Tavily | 3–4 (discover mode) or 1 (enrich mode) |
| **BOM Mapper** | Maps SKUs to HS codes, scores supplier exposure, computes dollar impact | 1 per BOM upload |
| **Scenario Modeler** | Generates Reshore / Nearshore / Dual-Source alternatives in parallel | 3 concurrent |

All agents use `llama-3.3-70b-versatile` via the Groq API. Inter-agent messages are validated against Pydantic schemas (`EnrichedEvent`, `BOMAnalysis`) before being passed downstream.

---

## Tech Stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS + D3.js | Vercel |
| Backend | FastAPI (Python 3.11+) | Fly.io |
| Database & Auth | Supabase (PostgreSQL + Row-Level Security) | Supabase Cloud |
| LLM | Llama 3.3 70B (`llama-3.3-70b-versatile`) | Groq API |
| Agent orchestration | Python `asyncio.gather()` | Backend process |
| Trade signals | Federal Register REST API (no key) + Tavily API | — |
| HS code resolution | Census Bureau Schedule B API + USITC HTS API | — |

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- A [Supabase](https://supabase.com) project
- A [Groq](https://console.groq.com) API key (free tier available)
- A [Tavily](https://tavily.com) API key
- A [Census Bureau](https://www.census.gov/data/developers/guidance/api-user-guide.html) API key

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/AayushPande2209/ClaudeHacks-Hackathon.git
cd ClaudeHacks-Hackathon

# Install Python dependencies
pip install -r requirements.txt

# Copy and fill in environment variables
cp .env.example .env

# Start the FastAPI server
uvicorn api.main:app --reload
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

### Docker

A `Dockerfile` is included for containerized deployment.

```bash
docker build -t espada .
docker run -p 8000:8000 --env-file .env espada
```

---

## Environment Variables

| Variable | Required By | Notes |
|---|---|---|
| `GROQ_API_KEY` | Backend — all agents | Groq API (free tier available) |
| `SUPABASE_URL` | Backend + Frontend | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Frontend | Public client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Used only by the Signal Monitor poller; bypasses RLS |
| `TAVILY_API_KEY` | Backend — Signal Monitor | Tavily web search |
| `CENSUS_API_KEY` | Backend — BOM Mapper | Census Bureau Schedule B API |
| `INTERNAL_TOKEN` | Backend — `/api/v1/internal/poll-signals` | Shared secret for the cron-triggered polling endpoint |

Federal Register API and USITC HTS API require no authentication.

---

## API Reference

All routes are hosted on Fly.io. Authentication uses Supabase JWTs (`Authorization: Bearer <token>`).

### Onboarding
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/onboarding` | Submit survey + upload BOM CSV/PDFs. Returns `{ business_profile_id, bom_id }` |

### BOM Management
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/boms` | Upload a BOM CSV. Returns parsed rows + validation report |
| `GET` | `/api/v1/boms` | List all BOMs for the authenticated user |
| `GET` | `/api/v1/boms/{bom_id}` | Retrieve a single BOM with its rows |
| `DELETE` | `/api/v1/boms/{bom_id}` | Soft-delete a BOM |

### Tariff Events
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/events` | List recent tariff events affecting the user (paginated) |
| `GET` | `/api/v1/events/{event_id}` | Get a single event with exposure breakdown |

### Scenarios & Recommendations
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/events/{event_id}/analyze` | Trigger BOM Mapper + Scenario Modeler. Returns `recommendation_id` |
| `GET` | `/api/v1/recommendations/{rec_id}` | Get ranked scenarios for a recommendation |

### Internal / Admin
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/internal/poll-signals` | Cron-triggered Signal Monitor run (token-gated) |
| `GET` | `/api/v1/health` | Liveness probe for Fly.io |

---

## Database Schema

PostgreSQL via Supabase. Row-Level Security (RLS) is enforced on all user-scoped tables.

Key tables: `users`, `business_profiles`, `boms`, `bom_rows`, `tariff_events`, `exposure_scores`, `scenarios`, `recommendations`, `agent_runs` (audit log).

See [`SPEC.md`](./SPEC.md) for full column definitions and RLS policies.

---

## Project Structure

```
.
├── api/                  # FastAPI backend
├── db/                   # Supabase migrations and schema
├── frontend/             # React + Vite frontend
├── src/                  # Agent source code (Signal Monitor, BOM Mapper, Scenario Modeler)
├── tests/                # Test suite (Playwright + unit tests)
├── sample_csvs/          # Example BOMs for testing
├── Dockerfile
├── fly.toml              # Fly.io deployment config
├── vercel.json           # Vercel deployment config
├── requirements.txt
├── SPEC.md               # Full technical specification
└── README.md
```

---

## Sample Data

Three sample BOM CSVs are included in the repo root for testing:

| File | Scenario |
|---|---|
| `sample_electronics_china_risk.csv` | Electronics supply chain with high China exposure |
| `sample_industrial_mixed.csv` | Industrial parts with mixed supplier origins |
| `sample_medical_diversified.csv` | Medical components with diversified sourcing |

---

## License

MIT
