# ReLoop AI — Frontend Enhancements Made & Still To Be Made

_Last updated: 2026-07-13_

ReLoop AI is UPS's returns-intelligence platform. "ReLoop AI" is the **product name** only —
UPS remains the business context throughout the app (UPS hubs, UPS's 2050 commitment, etc.).

---

## 1. Frontend enhancements made

### Branding / honesty
- **App name** set to **ReLoop AI** in the sidebar (logo `R`, title "ReLoop AI") and the Copilot
  page title ("ReLoop AI Copilot"). UPS references in body copy are intentionally **kept**
  (e.g. "across all UPS hubs", "UPS's carbon-neutral 2050 commitment").
- **Removed false AI-vendor claims.** The UI previously said "Microsoft Copilot-powered" and
  "GPT-4o + Claude 3.5 Sonnet" — neither was true. The model badge now reads
  **"Powered by Azure OpenAI"** (matches the real provider) and no longer exposes a specific model.
  - Prod provider: **Azure OpenAI** (`appsettings.json`, deployment `gpt-5-mini`).
  - Dev provider: GitHub Models (`appsettings.Development.json`).
- Copilot sub-header changed to **"● Grounded in live return & policy data"**.

### Pages wired to live backend data (with offline seed fallback)
| Page | Now live from backend | Fallback |
|------|-----------------------|----------|
| **Dashboard** | KPI cards (`GET /api/dashboard/metrics`), Root-cause clusters (`/rootcauseagent/cluster`), **"Today's AI Insights"** now derived from live metrics + clusters (diversion rate, local matches recovered, CO₂ avoided, top systemic driver) | Seed figures |
| **AI Eligibility** | Product cards, scores, decisions, savings, hub leaderboard & trends from `GET /api/debug/matches` | 3 seed products |
| **Local Demand** | Per-hub featured return, return ID, inventory count from real matches | Seed hub data |
| **AI Copilot** | Free-text questions call the live LLM via `POST /api/businessexplanation` | 6 scripted sample prompts |
| **Sustainability** | KPI cards + feedback metrics | Static ESG badge |

All live pages use `catchError(() => of(null))`, so if the API is offline the demo still renders
seed data and never breaks.

### Build status
- Frontend builds clean: `npx ng build --configuration development` → 0 errors, ~1.98 MB bundle.

---

## 2. Data reality check (what is real vs. synthetic)

Per project policy, **all data is synthetic** (UPS will not share real data). "Making it real"
therefore means **driving the UI from the backend/DB** instead of hardcoding arrays in the
frontend — the DB itself stays synthetic.

**Backend endpoints available today**
- `POST /api/businessexplanation` — LLM business explanation
- `GET  /api/dashboard/metrics`, `GET /api/dashboard/segments`
- `GET  /api/debug/ai-health | packages | returns | inventory | matches`
- `POST /api/feedback`, `GET /api/feedback/summary`
- `POST /api/imagevalidation`
- `POST /api/integration/process-return`
- `POST /api/matchagent/find-match`
- `POST /api/rootcauseagent/cluster`

**Still synthetic in the frontend (no backend source exists yet)**
- **Local Demand buyer lists** (`local-demand.ts` → `buyers[]`) — there is **no buyer endpoint**.
- **Dashboard charts**: donut, region bars, savings trend line, `revLocations`, and the
  `agents` precision/escalation table are static demo visuals.
- **Sustainability**: "ESG Score A+" badge is static.

---

## 3. Still to be done — all layers (for a 100% live demo)

### 3a. Frontend
1. **Buyer lists** (`local-demand.ts` → `buyers[]`) — the last hardcoded list. Wire to a new
   `GET /api/buyers?hub=` once the backend endpoint exists (see 3b).
2. **Dashboard charts from live data**:
   - Region bars / `revLocations` → aggregate `GET /api/debug/matches` by city (data already exists).
   - Savings trend line → consume a new `GET /api/dashboard/trend` (see 3b).
   - Agents table precision/escalation → consume a new agent-telemetry endpoint (see 3b).
3. **Sustainability ESG badge** → compute from live metrics instead of a static "A+".
4. **Copilot sample prompts (optional)** — route the 6 scripted prompts through the live LLM too
   (free-text already is).
5. **Cleanup** — remove dead `getDebugDashboard()` from `api.service.ts` (unused).

### 3b. Backend (missing endpoints / upgrades)
1. **Buyers endpoint** — **no buyer endpoint exists.** Add `GET /api/buyers?hub=` served from a new
   synthetic `Buyers` table (see 3c).
2. **Dashboard trend endpoint** — **no time-series endpoint exists.** Add `GET /api/dashboard/trend`
   for the savings/diversion line chart.
3. **Agent-telemetry endpoint** — **no endpoint exposes agent precision/escalation.** Surface it
   (e.g. from `AutoApprovalMetrics` / `AgentRecommendations`) so the dashboard table is real.
4. **process-return FK failure** — the pipeline currently completes via fallback but throws on insert:
   `FK_InventoryPool_ImageValidationResults` and `FK_MatchAgentResults_ReturnRequests` (see 3c).
   Fix the insert ordering so parent rows exist before child rows.
5. **Policy RAG upgrade (optional)** — `PolicyRetriever` is in-process **TF-IDF + cosine** over
   `SyntheticPolicyCorpus` (deterministic, offline-friendly). For production, swap in an
   embeddings-backed `IPolicyRetriever` and move the corpus out of code (see 3c).
6. **Tests** — only `DecisionEngineTests`, `SavingsCalculatorServiceTests`, `RetailerPolicyServiceTests`,
   `PolicyRetrieverTests` exist. Add coverage for MatchAgent, Dashboard aggregation, and the
   process-return integration path.

### 3c. SQL / database
1. **FK / seed integrity** — `RelooptableCreation.sql`:
   - `FK_InventoryPool_ImageValidationResults`: `InventoryPool.ReturnId → ImageValidationResults(Id)`
     — verify this relationship is intended (it reads oddly) and that seed rows satisfy it.
   - `FK_MatchAgentResults_ReturnRequests`: every `MatchAgentResults.ReturnRequestId` must exist in
     `ReturnRequests`. Align the synthetic seed so process-return inserts don't violate these FKs.
2. **Buyers table + seed** — add a synthetic `Buyers` table (hub, zone, distance, delivery, score)
   to back the buyers endpoint.
3. **Policy corpus in DB (optional)** — move `SyntheticPolicyCorpus` into a `Policies` table so RAG
   reads governing policies from the database instead of code.

### 3d. Infra / demo run
1. **Run backend with the Azure key** — start the API in the terminal where the Azure OpenAI key is
   set (prod `appsettings.json` → Azure `gpt-5-mini`), else live pages fall back to seed data.
2. ⚠️ **Rotate the PAT** that was pasted in chat earlier.

---

## 4. Quick run commands

```powershell
# Backend (run in the terminal where the Azure OpenAI key is set)
$env:ASPNETCORE_ENVIRONMENT="Development"
dotnet run --project "team-repos\Hackathon2026\UPS_ReLoop_Nexus\UPS_ReLoop_Nexus.csproj" --urls "http://localhost:5080"

# Frontend
cd figma-website
npx ng serve --port 4200

# Health check
curl http://localhost:5080/api/debug/ai-health
```

---

## 5. Backend enhancement done in the same pass (small)

A single small backend + SQL commit was made alongside these frontend changes:

- **Backend** (`team-repos/Hackathon2026`, branch `Balaji-Enhancement_ReLoopAI`):
  `Add segment analytics endpoint and unify confidence to 0-1` — adds the
  `GET /api/dashboard/segments` analytics endpoint and normalizes all confidence values to a
  consistent 0–1 scale across the agents.
- **SQL** (`team-repos/SQL-Queries`, branch `Balaji-Enhancement_ReLoopAI`):
  `Align seed recommendation bands with the match calculator` — updates the synthetic seed data so
  recommendation thresholds match the match-calculator logic.
