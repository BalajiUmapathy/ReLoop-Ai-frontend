# ReLoop AI — Enhancements Made & Still To Be Made

_Last updated: 2026-07-14_

**Repository:** [BalajiUmapathy/ReLoop-Ai-frontend](https://github.com/BalajiUmapathy/ReLoop-Ai-frontend) — branch: `main`

ReLoop AI is UPS's returns-intelligence platform. "ReLoop AI" is the **product name** only —
UPS remains the business context throughout the app (UPS hubs, UPS's 2050 commitment, etc.).

---

## 1. Enhancements completed (this pass)

### 1a. Backend — ASP.NET Core 8, Clean Architecture

| Layer | What was added |
|-------|---------------|
| **`GET /api/buyers?hub=`** | Full stack: `BuyersController` → `IBuyerService` / `BuyerService` → `IBuyerSpRepository` / `BuyerSpRepository` → `usp_GetBuyersByHub`. Returns expanded `BuyerDto` with buyerId, buyerName, hub, zone, distanceKm, estimatedDeliveryHours, demandScore, preferredCategory, recommendation. Sorted by demand score descending. |
| **`GET /api/dashboard/trend?days=`** | Full stack: `DashboardController.GetTrend` → `IDashboardService.GetTrendAsync` → `IDashboardSpRepository.GetTrendAsync` → `usp_GetDashboardTrend`. Returns **daily** 30-day time-series: date, returns, localMatches, costSaved, distanceSavedKm, co2SavedKg. |
| **`GET /api/dashboard/agent-telemetry`** | Full stack: `DashboardController.GetAgentTelemetry` → `IDashboardService.GetAgentTelemetryAsync` → `IDashboardSpRepository.GetAgentTelemetryAsync` → `usp_GetAgentTelemetry`. Returns per-agent decisionsMade, precision, escalationRate. |
| **DTOs** | `DashboardTrendPointDto`, `AgentTelemetryDto` added to `DashboardDtos.cs`. `BuyerDto`, `BuyerListResponse` already existed. |
| **Caching** | Both new dashboard endpoints use `IMemoryCache` with 5-minute TTL (same pattern as existing `GetMetricsAsync`). |
| **DI** | All services and SP repositories were already registered in `DependencyInjection.cs` (Application + Infrastructure layers). |

**Build status:** `dotnet build` → 0 errors, 0 warnings.

### 1b. Database — SQL Server

| Script | Purpose |
|--------|---------|
| `docs/SQL/001_Buyers_Table_Seed_SPs.sql` | Creates `Buyers` table with expanded schema (`BuyerId`, `Hub`, `Name`, `Zone`, `DistanceKm`, `EstimatedDeliveryHours`, `DemandScore`, `PreferredCategory`, `Recommendation`, `IsActive`, `CreatedAt`). Includes migration path for existing tables. Seeds 25 synthetic buyers (5 per hub: CHN, BLR, MUM, DEL, HYD) with retail outlet names, categories, and demand recommendations. Creates `usp_GetBuyersByHub` stored procedure. |
| `docs/SQL/002_Dashboard_Trend_AgentTelemetry_SPs.sql` | `usp_GetDashboardTrend @Days` — daily aggregation of `MatchAgentResults` + `ReturnRequests` into a time-series. `usp_GetAgentTelemetry` — unions `MatchAgentResults` (Demand Match Agent) with `AgentRecommendations` (other agents) for per-agent precision and escalation rate. |
| `docs/SQL/003_FK_Fix_Insert_Order.sql` | Drops the mis-targeted `FK_InventoryPool_ImageValidationResults` (pointed at `ImageValidationResults` instead of `ReturnRequests`). Deletes orphan `InventoryPool` rows whose `ReturnId` doesn't exist in `ReturnRequests`. Re-creates as `FK_InventoryPool_ReturnRequests`. Cleans orphan `MatchAgentResults` rows for `FK_MatchAgentResults_ReturnRequests`. |

### 1c. Frontend — Angular 19

| Component | What changed |
|-----------|-------------|
| **`api.service.ts`** | Added `BuyerDto` (9 fields: buyerId, buyerName, hub, zone, distanceKm, estimatedDeliveryHours, demandScore, preferredCategory, recommendation), `BuyerListResponse`, `DashboardTrendPoint` (daily: date, returns, localMatches, costSaved, distanceSavedKm, co2SavedKg), `AgentTelemetry` interfaces. Added `getBuyers(hub)`, `getDashboardTrend(days)`, `getAgentTelemetry()` methods. |
| **`local-demand.ts`** | **Removed all 62 lines of hardcoded `hubData`** (buyers, scores, metrics). Replaced with a 5-line `hubMeta` (static labels: location, district, profitImpact). Buyers now loaded from `GET /api/buyers?hub=` via `buyerOverlays` signal. Featured return, inventory count from `GET /api/debug/matches`. Demand score, match rate, savings from `POST /api/matchagent/find-match`. Falls back to `—`/`0` while loading. |
| **`local-demand.html`** | Updated buyer table to use new `BuyerDto` fields (`b.buyerId`, `b.buyerName`, `b.distanceKm km`, `b.estimatedDeliveryHours h`, `b.demandScore`). |
| **`buyers/` (NEW)** | Standalone Buyers Directory page: hub filter bar, loading spinner, error card with retry, paginated table (5 per page), sort toggle by demand score, color-coded badges (High/Moderate/Low Demand), stats row (total buyers, avg score, high-demand count). Route: `/buyers`. |
| **`trends/` (NEW)** | Trend Analytics page with 3 responsive SVG line charts: Cost Savings (green, area fill), Returns vs Local Matches (dual-line with legend), CO₂ Reduction (teal, area fill). Day selector (7D/14D/30D), loading/error/empty states, KPI summaries (total, avg, peak). Route: `/trends`. |
| **`dashboard.ts`** | `regions`, `revLocations`, `agents` converted from plain arrays → Angular signals. Added `loadRegions()` — aggregates `GET /api/debug/matches` by city for region bars and revenue locations. Added `loadTrend()` — consumes `GET /api/dashboard/trend?days=30`, generates SVG polyline coordinates for the savings chart. Added `loadAgentTelemetry()` — consumes `GET /api/dashboard/agent-telemetry`, populates the agent performance table with live precision and escalation rates. |
| **`dashboard.html`** | `@for` loops updated to call signal getters (`regions()`, `revLocations()`, `agents()`). Savings trend SVG now uses `[attr.points]` binding with data-driven polyline coordinates and dynamic Y-axis labels. Static fallback lines render when API is offline. |
| **`sustainability.ts`** | Added `esgScore` and `esgLabel` signals. Added `computeEsgGrade()` — weighted formula: 60% diversion rate + 40% CO₂ impact (normalized to 500 kg baseline). Grades: A+ (≥90), A (≥80), B+ (≥70), B (≥60), C (<60). |
| **`sustainability.html`** | ESG badge changed from static `"ESG Score: A+"` → dynamic `{{ esgScore() }}`. |
| **`ai-copilot.ts`** | All 6 sample prompts now also fire the live LLM (`POST /api/businessexplanation`) in addition to showing the instant canned response. If the LLM responds, the canned answer is upgraded in-place with live text and AI-generated insight cards. Free-text was already wired. |

**Build status:** `npx ng build --configuration development` → 0 errors, ~2.02 MB bundle.

---

## 2. Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Angular Frontend                       │
│  local-demand │ dashboard │ sustainability │ ai-copilot     │
│       │             │            │               │          │
│       ▼             ▼            ▼               ▼          │
│                  ApiService (api.service.ts)                 │
│   getBuyers() │ getDashboardTrend() │ getAgentTelemetry()   │
│   getDashboardMetrics() │ explainBusiness() │ ...           │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────────┐
│               ASP.NET Core 8 Web API                        │
│  Controllers: Buyers │ Dashboard │ MatchAgent │ Integration │
├─────────────────────────────────────────────────────────────┤
│  Application Layer (Services + Interfaces + DTOs)           │
│  BuyerService │ DashboardService │ MatchAgentService │ ...  │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure Layer (Repositories + EF Core)              │
│  BuyerSpRepository │ DashboardSpRepository │ ...            │
├─────────────────────────────────────────────────────────────┤
│  SQL Server (Stored Procedures)                             │
│  usp_GetBuyersByHub │ usp_GetDashboardTrend │               │
│  usp_GetAgentTelemetry │ usp_GetDashboardMetrics │ ...      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Data reality check

Per project policy, **all data is synthetic** (UPS will not share real data). "Making it real"
means **driving the UI from the backend/DB** instead of hardcoding arrays in the frontend.

### What is now live from backend

| Data | Source | Fallback |
|------|--------|----------|
| Dashboard KPI cards | `GET /api/dashboard/metrics` | Seed figures |
| Dashboard region bars | Aggregated from `GET /api/debug/matches` by city | Static array |
| Dashboard revenue locations | Aggregated from `GET /api/debug/matches` by city | Static array |
| Dashboard savings trend | `GET /api/dashboard/trend` | Static SVG polyline |
| Dashboard agent table | `GET /api/dashboard/agent-telemetry` | Static array |
| Dashboard root causes | `POST /api/rootcauseagent/cluster` | 3 seed clusters |
| Dashboard AI Insights | Computed from live metrics + clusters | 4 seed strings |
| Local Demand buyers | `GET /api/buyers?hub=` | Empty (shows `—`) |
| Local Demand featured return | `GET /api/debug/matches` | Shows `—` |
| Local Demand scores/savings | `POST /api/matchagent/find-match` | Shows `0`/`—` |
| AI Eligibility | `GET /api/debug/matches` | 3 seed products |
| AI Copilot (free-text) | `POST /api/businessexplanation` | Generic fallback |
| AI Copilot (sample prompts) | Canned instant + live LLM upgrade | Canned only |
| Sustainability KPIs | `GET /api/dashboard/metrics` + `/feedback/summary` | Seed figures |
| Sustainability ESG badge | Computed from live diversion rate + CO₂ | Static `A+` |

### What remains static (no backend source)

- **Dashboard donut chart** (Returns by Category) — hardcoded SVG segments.
- **Dashboard 10-Day Holding Success Trend** — static SVG.
- **Dashboard Carbon Reduction Trend** — static SVG.
- **Sustainability hub leaderboard** — static array (`hubs` in `sustainability.ts`).
- **Sustainability charts** (Revenue by Category, CO₂ by Hub) — static SVG.

---

## 4. Backend endpoints — complete inventory

| Method | Endpoint | Status |
|--------|----------|--------|
| `GET` | `/api/buyers?hub=` | ✅ New |
| `GET` | `/api/buyers/hubs` | ✅ Existing |
| `GET` | `/api/dashboard/metrics` | ✅ Existing |
| `GET` | `/api/dashboard/trend?days=` | ✅ New |
| `GET` | `/api/dashboard/agent-telemetry` | ✅ New |
| `GET` | `/api/dashboard/segments` | ✅ Existing |
| `POST` | `/api/businessexplanation` | ✅ Existing |
| `GET` | `/api/debug/ai-health` | ✅ Existing |
| `GET` | `/api/debug/dashboard` | ✅ Existing |
| `GET` | `/api/debug/packages` | ✅ Existing |
| `GET` | `/api/debug/returns` | ✅ Existing |
| `GET` | `/api/debug/inventory` | ✅ Existing |
| `GET` | `/api/debug/matches` | ✅ Existing |
| `POST` | `/api/feedback` | ✅ Existing |
| `GET` | `/api/feedback/summary` | ✅ Existing |
| `POST` | `/api/imagevalidation` | ✅ Existing |
| `POST` | `/api/integration/process-return` | ✅ Existing |
| `POST` | `/api/matchagent/find-match` | ✅ Existing |
| `GET` | `/api/packages` | ✅ Existing |
| `POST` | `/api/rootcauseagent/cluster` | ✅ Existing |

---

## 5. Still to be done

### 5a. Frontend
1. **Dashboard donut chart** — aggregate matches by category to drive SVG segments.
2. **Dashboard 10-Day Holding Success Trend** — wire to time-series or compute from matches.
3. **Sustainability hub leaderboard** — compute from matches grouped by hub.
4. **Sustainability charts** — wire revenue-by-category and CO₂-by-hub SVGs to live data.

### 5b. Backend
1. **process-return FK failure** — the FK constraints are now fixed in the DB, but the
   `ReturnProcessingOrchestrator` insert ordering should be reviewed to ensure parent rows
   (ReturnRequests, ImageValidationResults) are committed before child rows
   (InventoryPool, MatchAgentResults).
2. **Policy RAG upgrade (optional)** — `PolicyRetriever` is in-process TF-IDF + cosine over
   `SyntheticPolicyCorpus`. For production, swap in an embeddings-backed `IPolicyRetriever`.
3. **Tests** — add coverage for Dashboard trend/telemetry, Buyers, MatchAgent, and the
   process-return integration path.

### 5c. Infra / demo run
1. **Run backend with Azure key** — set the Azure OpenAI key in environment, else live
   pages fall back to seed data.
2. **Execute SQL scripts** in order: `001`, `002`, `003` against the target database.

---

## 6. Quick run commands

```powershell
# Backend
$env:ASPNETCORE_ENVIRONMENT="Development"
dotnet run --project "UPS_ReLoop_Nexus\UPS_ReLoop_Nexus.csproj" --urls "http://localhost:5080"

# Frontend
cd ReLoop-Ai-frontend-main\ReLoop-Ai-frontend-main
npx ng serve --port 4200

# Health check
curl http://localhost:5080/api/debug/ai-health

# New endpoints
curl http://localhost:5080/api/buyers?hub=CHN
curl http://localhost:5080/api/dashboard/trend?days=30
curl http://localhost:5080/api/dashboard/agent-telemetry
```

---

## 7. Files changed in this pass

### Backend (UPS_ReLoop_Nexus)
- `UPS_ReLoop_Nexus/Controllers/DashboardController.cs` — added `GetTrend`, `GetAgentTelemetry`
- `UPS.ReLoop.Application/Interfaces/IDashboardService.cs` — added 2 methods
- `UPS.ReLoop.Application/Interfaces/Repositories/ISpRepositories.cs` — added 2 methods to `IDashboardSpRepository`
- `UPS.ReLoop.Application/DTOs/Dashboard/DashboardDtos.cs` — added `DashboardTrendPointDto`, `AgentTelemetryDto`
- `UPS.ReLoop.Application/Services/DashboardService.cs` — implemented trend + telemetry with cache
- `UPS.ReLoop.Infrastructure/Persistence/Repositories/StoredProcedures/DashboardSpRepository.cs` — implemented SP calls

### SQL (docs/SQL/)
- `001_Buyers_Table_Seed_SPs.sql` — Buyers table + 25-row seed + `usp_GetBuyersByHub`
- `002_Dashboard_Trend_AgentTelemetry_SPs.sql` — `usp_GetDashboardTrend` + `usp_GetAgentTelemetry`
- `003_FK_Fix_Insert_Order.sql` — FK constraint fixes with orphan cleanup

### Frontend (ReLoop-Ai-frontend-main)
- `src/app/core/api.service.ts` — expanded `BuyerDto` (9 fields), daily `DashboardTrendPoint` (6 fields), 3 API methods
- `src/app/local-demand/local-demand.ts` — removed hardcoded buyers, wired to API
- `src/app/local-demand/local-demand.html` — updated buyer table bindings for new DTO
- `src/app/buyers/buyers.ts` — **NEW** standalone buyers page with pagination, sorting, badges
- `src/app/buyers/buyers.html` — **NEW** template with hub selector, table, pagination controls
- `src/app/buyers/buyers.css` — **NEW** styles
- `src/app/trends/trends.ts` — **NEW** 3-chart trend analytics page (7D/14D/30D selector)
- `src/app/trends/trends.html` — **NEW** responsive SVG line charts with gradient fills
- `src/app/trends/trends.css` — **NEW** responsive grid styles
- `src/app/dashboard/dashboard.ts` — signals + 3 live data loaders (regions, trend, agents)
- `src/app/dashboard/dashboard.html` — signal getters + dynamic trend SVG
- `src/app/sustainability/sustainability.ts` — dynamic ESG grade computation
- `src/app/sustainability/sustainability.html` — dynamic ESG badge
- `src/app/ai-copilot/ai-copilot.ts` — sample prompts fire live LLM
- `src/app/app.routes.ts` — added `/buyers` and `/trends` routes
- `src/app/sidebar/sidebar.ts` — added "Buyers Directory" and "Trend Analytics" nav items
