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

## 3. Frontend enhancements still to be made (for a 100% live demo)

Priority order:

1. **Backend running with Azure key** — start the API in the terminal where the Azure OpenAI
   key/PAT is set, else live pages fall back to seed data.
   - ⚠️ **Rotate the PAT** that was pasted in chat earlier.
2. **Buyer marketplace data** — **no buyer endpoint exists**; add a synthetic `Buyers` table +
   `GET /api/buyers?hub=` endpoint, then wire `local-demand.ts` buyer lists to it
   (removes the last hardcoded list).
3. **Dashboard charts from live data**:
   - Region bars / `revLocations` → aggregate `GET /api/debug/matches` by city.
   - Savings trend line → **no time-series endpoint exists**; add one (e.g. `GET /api/dashboard/trend`).
   - Agents table precision/escalation → **no agent-telemetry endpoint exists**; expose it from the backend.
4. **Sustainability ESG badge** → compute from live metrics instead of a static "A+".
5. **Copilot sample prompts (optional)** — route the 6 scripted prompts through the live LLM too,
   so every answer is generated (free-text already is).
6. **Cleanup** — remove dead `getDebugDashboard()` from `api.service.ts` (unused).

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
