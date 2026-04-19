# 🛡️ Espada (TariffShield)
### Strategic Sourcing & Real-time Tariff Protection Engine

**Espada** is an AI-powered intelligence platform designed to protect global supply chains from the volatility of trade policy and tariffs. In an era of rapid policy changes, Espada provides procurement teams with the foresight they need to de-risk their materials list before costs skyrocket.

---

## 🌟 Key Features

- **Real-time Signal Monitoring**: Automatically scans the **Federal Register** and live trade news to detect emerging tariff threats using LLM-powered extraction.
- **Intelligent BOM Analysis**: Upload messy bills of materials (CSV/PDF) and let our **BOM Mapper Agent** automatically enrich your data with missing HS codes and country-of-origin context.
- **Scenario Modeling**: Our **Strategic Modeler** generates data-driven "What If" scenarios (Dual-sourcing, Domestic Onshoring, Inventory Hedging) with detailed cost-benefit analysis.
- **AI-Powered Supplier Search**: Automatically identify alternative suppliers in low-risk jurisdictions using **Tavily** search and verified LLM filtering.

## 🏗️ Multi-Agent Architecture

Espada is built on a distributed agentic architecture:
1.  **Signal Monitor**: Detects and structured trade policy "events."
2.  **BOM Mapper**: Prepares and enriches your parts list.
3.  **Scenario Modeler**: Simulates the business impact of various mitigation strategies.
4.  **Supplier Search**: Hunts for alternative vendors to build supply chain resilience.

## 🛠️ Technology Stack

- **Frontend**: React/Vite (Modern UI with D3.js visualization)
- **Backend**: FastAPI (Python)
- **Intelligence**: Groq (Llama 3.3 70B & 8B for extraction and reasoning)
- **Infrastructure**: Fly.io (Backend), Vercel (Frontend), Supabase (Database)
- **Data APIs**: Federal Register API, Tavily Search, USITC HTS

---
*Developed for ClaudeHacks-Hackathon — April 2026*
