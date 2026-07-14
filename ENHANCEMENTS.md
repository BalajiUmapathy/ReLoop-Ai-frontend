# ReLoop AI â€” Enhancements Made & Still To Be Made

_Last updated: 2026-07-14_

**Repository:** [priyapandi04/FrontEnd](https://github.com/priyapandi04/FrontEnd) â€” branch: `main`

ReLoop AI is UPS's returns-intelligence platform. "ReLoop AI" is the **product name** only â€”
UPS remains the business context throughout the app (UPS hubs, UPS's 2050 commitment, etc.).

---

## 1. Enhancements completed

### 1a. Backend â€” ASP.NET Core 8, Clean Architecture

| Layer | What was added |
|-------|---------------|
| **`GET /api/buyers?hub=`** | Full stack: `BuyersController` â†’ `IBuyerService` / `BuyerService` â†’ `IBuyerSpRepository` / `BuyerSpRepository` â†’ `usp_GetBuyersByHub`. Returns `BuyerDto` with buyerId, buyerName, hub, zone, distanceKm, estimatedDeliveryHours, demandScore, preferredCategory, recommendation. Sorted by demand score descending. |
| **`GET /api/dashboard/trend?days=`** | Full stack: `DashboardController.GetTrend` â†’ `IDashboardService.GetTrendAsync` â†’ `IDashboardSpRepository.GetTrendAsync` â†’ `usp_GetDashboardTrend`. Returns daily 30-day time-series: date, returns, localMatches, costSaved, distanceSavedKm, co2SavedKg. |
| **`GET /api/dashboard/agent-telemetry`** | Full stack: `DashboardController.GetAgentTelemetry` â†’ `IDashboardService.GetAgentTelemetryAsync` â†’ `IDashboardSpRepository.GetAgentTelemetryAsync` â†’ `usp_GetAgentTelemetry`. Returns per-agent `totalRuns`, `successfulRuns`, `precisionRate`, `escalationRate`, `averageResponseTime`. `AutoApprovalMetrics` singleton merged at service layer as "AutoApprovalAgent" row. 5-minute cache. |
| **`AgentTelemetryDto` updated** | Added `TotalRuns`, `SuccessfulRuns`, `PrecisionRate`, `AverageResponseTime` (removed old `DecisionsMade`, `Precision`). |
| **`DashboardService`** | Injects `AutoApprovalMetrics` singleton; appends its snapshot as an additional agent entry in `GetAgentTelemetryAsync`. |
| **`ReturnProcessingOrchestrator` FK bug fixed** | No-image path was passing `ReturnRequestId` to `usp_AddToInventoryPool` â€” violating `FK_InventoryPool_Returns` (`ReturnId` â†’ `Returns.Id`). Fixed: now calls `usp_SaveImageValidationResult` first to create a `Returns` record, then passes the returned `Returns.Id` to `usp_AddToInventoryPool`. |
| **`MatchAgentRequest` + `MatchAgentService` bug fixed** | `SaveMatchResultAsync` was parsing `ProductId` (PackageId) as `ReturnRequestId` â€” FK violation against `ReturnRequests`. Fixed: `MatchAgentRequest` now has optional `ReturnRequestId? Guid`. Orchestrator passes the real `response.ReturnRequestId`. Service uses it directly. |
| **`IImageValidationSpRepository` injected in Orchestrator** | Added as constructor parameter and field so the no-image path can create `Returns` records. |
| **Caching** | All new dashboard endpoints use `IMemoryCache` with 5-minute TTL. |

**Build status:** `dotnet build` â†’ 0 errors, 0 warnings.

### 1b. Database â€” SQL Server (8 scripts in `docs/SQL/`)

| Script | Status | Purpose |
|--------|--------|---------|
| `001_Buyers_Table_Seed_SPs.sql` | âœ… Complete | `Buyers` table (schema + migration), 25-row seed (5 per hub: CHN, BLR, MUM, DEL, HYD), `usp_GetBuyersByHub` |
| `002_Dashboard_Trend_AgentTelemetry_SPs.sql` | âš ï¸ Superseded | Original `usp_GetDashboardTrend` (still valid) + old `usp_GetAgentTelemetry` (replaced by 004) |
| `003_FK_Fix_Insert_Order.sql` | âš ï¸ Superseded | Partial FK fix â€” replaced by 005 |
| `004_AgentTelemetry_Enhanced_SP.sql` | âœ… Complete | Enhanced `usp_GetAgentTelemetry` returning `TotalRuns`, `SuccessfulRuns`, `PrecisionRate`, `EscalationRate`, `AverageResponseTime` from both `MatchAgentResults` and `AgentRecommendations` |
| `005_FK_Remediation_Full.sql` | âœ… Complete | Full FK remediation with TRY/CATCH/ROLLBACK per step: drops `FK_InventoryPool_ImageValidationResults`, creates `FK_InventoryPool_Returns` (â†’ `Returns.Id`); fixes `FK_MatchAgentResults_ReturnRequests` (â†’ `ReturnRequests.Id`); verifies `FK_ReturnRequests_Packages`; seeds data in correct order; recreates all affected SPs |
| `006_Rename_ImageValidationResults_To_Returns.sql` | âœ… Complete | Renames `ImageValidationResults` table â†’ `Returns` using `sp_rename`; renames FK constraint; validates FK target; recreates `usp_SaveImageValidationResult`, `usp_AddToInventoryPool`, `usp_GetInventoryByProduct` |
| `007_Core_SPs_DemandHistory_RootCause.sql` | âœ… **NEW** | Creates `usp_GetDemandHistory` (queries `DemandHistory` by ProductId + Region), `usp_SaveRootCauseAnalysis` (inserts structured summary into `AgentRecommendations` with AgentName='RootCauseAgent'), `usp_GetReturnReasonsByCategory` (groups `Returns` by ReturnReason with percentage). Seeds 10 `DemandHistory` rows. |
| `008_Dashboard_Metrics_SPs.sql` | âœ… **NEW** | Creates `usp_GetDashboardMetrics` (TotalReturns from `ReturnRequests`, EligibleReturns from `Returns`, LocalMatches + savings from `MatchAgentResults`, DiversionRate calculated; date-range filter) and `usp_GetDashboardRootCauseInsights` (top-N return reasons with percentage from `Returns`) |

**Run order:** `001` â†’ `006` â†’ `007` â†’ `008`. Scripts 004 and 005 should run after 006.

### 1c. Frontend â€” Angular 21 (standalone components)

| Component / File | What changed |
|-----------|-------------|
| **Dashboard donut chart (live)** | `donutSlices` signal computed in `loadRegions()` from `GET /api/debug/matches` grouped by category. `@for (s of donutSlices()...)` drives `[attr.stroke-dasharray]` and `[attr.stroke-dashoffset]` on each SVG `<circle>`. Legend also reactive. Fallback to static arcs when API offline. |
| **Dashboard 10-Day Holding Trend (live)** | `holdingPoly`, `holdingDots`, `holdingLabels` signals computed in `loadTrend()` â€” weekly localMatches/returns success-rate buckets from 30-day trend data. SVG `<polyline>` and `<circle>` dots bound via `[attr.points]`. |
| **Dashboard Carbon Reduction Trend (live)** | `co2TrendPoly`, `co2TrendArea`, `co2TrendYMax`, `co2TrendLabels` signals from `loadTrend()`. COâ‚‚ kg series plotted on its own Y scale. Y-axis labels update dynamically. |
| **Sustainability hub leaderboard (live)** | `hubs` converted from static array to `signal<HubRow[]>`. `loadMatchData()` groups `GET /api/debug/matches` by hub/city, computes match-rate score and COâ‚‚ total per hub, sorts descending. Template uses `hubs()`. |
| **Sustainability Revenue by Category chart (live)** | `catBars` and `catYMax` signals computed in `loadMatchData()`. SVG bars replaced with `@for (b of catBars()...)` driving `[attr.x]`, `[attr.y]`, `[attr.height]`, `[attr.fill]`. Y-axis labels scale to `catYMax()`. |
| **`agent-performance/` (NEW)** | Full Agent Performance Dashboard page. Angular service consumes `GET /api/dashboard/agent-telemetry`. Displays table with sortable columns (click header â†’ asc/desc toggle `â‡… â†‘ â†“`), text filter by agent name, 6 KPI summary cards, progress-bar columns, color-coded badges per metric. Auto-refreshes every 30 s. Demo fallback for 5 agents when API offline. Route: `/agent-performance`. |
| **`core/esg-score.service.ts` (NEW)** | Injectable utility service: `calculate(EsgInput): EsgResult`. Four-dimensional weighted ESG score â€” Diversion Rate (35%), COâ‚‚ Saved (30%), Distance Saved (20%), Cost Saved (15%). Grades: A+ â‰¥ 90, A â‰¥ 80, B â‰¥ 70, C â‰¥ 60, D < 60. Auto-detects fraction vs. percentage `diversionRate`. Returns score, grade, label, color, bgColor, borderColor, and per-dimension breakdown. |
| **`core/esg-badge/` (NEW)** | Standalone `EsgBadgeComponent`. Compact clickable pill in page header (colour-coded from `EsgResult`). Expands to animated dropdown panel showing grade, numeric score/100, full-width gauge bar, breakdown table (dimension Â· raw value Â· sub-score bar Â· weight Â· contribution), grade scale reference. All colours data-driven via `[style.x]` â€” zero grade-specific CSS selectors. |
| **`core/esg-score.service.spec.ts` (NEW)** | 40 Vitest unit tests â€” all passing. Covers every grade boundary, score cap at 100, fraction/percentage diversionRate equivalence, all-zero inputs, breakdown structure (4 entries, weights sum to 1.0, contributions sum â‰ˆ score), colour mapping per grade, realistic production metrics. |
| **`sustainability.ts` updated** | Removed hardcoded `esgScore`/`esgLabel` signals and private `computeEsgGrade()` (2-factor only). Injects `EsgScoreService`; computes `esgResult` signal from all 4 live metrics. Imports `EsgBadgeComponent`. |
| **`sustainability.html` updated** | Replaced `<span class="esg-badge">ESG Score: A+</span>` with `<app-esg-badge [result]="esgResult()" />`. |
| **`sustainability.css` updated** | Removed now-redundant `.esg-badge` rule (styles live in badge component). |
| **`dashboard.ts` updated** | `agents` array mapping updated to use new DTO fields (`totalRuns`, `precisionRate`). |
| **`local-demand.ts`** | Removed all 62 lines of hardcoded `hubData`. Replaced with live API calls. |
| **`buyers/` (NEW)** | Buyers Directory page: hub filter bar, loading/error states, paginated table (5/page), sort by demand score, colour-coded badges. Route: `/buyers`. |
| **`trends/` (NEW)** | Trend Analytics with 3 SVG line charts (7D/14D/30D selector). Route: `/trends`. |
| **`ai-copilot.ts`** | Sample prompts fire live LLM in addition to canned response. |
| **`app.routes.ts`** | Routes: `/buyers`, `/trends`, `/agent-performance` added. |
| **`sidebar/sidebar.ts`** | Nav items: "Buyers Directory", "Trend Analytics", "Agent Performance ðŸ“¡" added. |

**Build status:** `npx ng build --configuration development` â†’ 0 errors. **Test status:** `npx ng test --no-watch` â†’ 40/40 ESG tests pass.

---

## 2. Architecture overview

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                         Angular Frontend                            â”‚
â”‚  dashboard â”‚ local-demand â”‚ buyers â”‚ trends â”‚ sustainability â”‚      â”‚
â”‚  ai-copilot â”‚ agent-performance (NEW)                              â”‚
â”‚       â”‚                    â”‚                                        â”‚
â”‚       â–¼                    â–¼                                        â”‚
â”‚              ApiService (api.service.ts)                            â”‚
â”‚  getBuyers() â”‚ getDashboardTrend() â”‚ getAgentTelemetry()           â”‚
â”‚  getDashboardMetrics() â”‚ explainBusiness() â”‚ processReturn() â”‚ ... â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                           â”‚ HTTP (CORS: localhost:4200)
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                   ASP.NET Core 8 Web API                            â”‚
â”‚  Controllers: Buyers â”‚ Dashboard â”‚ MatchAgent â”‚ Integration â”‚ ...   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Application Layer (Services + Interfaces + DTOs)                   â”‚
â”‚  BuyerService â”‚ DashboardService (+AutoApprovalMetrics) â”‚           â”‚
â”‚  ReturnProcessingOrchestrator (FK-correct) â”‚ MatchAgentService â”‚   â”‚
â”‚  RootCauseAgentService â”‚ EsgScoreService (frontend) â”‚ ...          â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Infrastructure Layer (Repositories + EF Core)                      â”‚
â”‚  BuyerSpRepository â”‚ DashboardSpRepository â”‚                        â”‚
â”‚  ImageValidationSpRepository â”‚ InventoryPoolSpRepository â”‚ ...      â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  SQL Server (13 Stored Procedures across 8 migration scripts)       â”‚
â”‚  usp_GetBuyersByHub â”‚ usp_GetDashboardTrend â”‚ usp_GetAgentTelemetryâ”‚
â”‚  usp_GetDashboardMetrics â”‚ usp_GetDashboardRootCauseInsights â”‚      â”‚
â”‚  usp_GetDemandHistory â”‚ usp_SaveRootCauseAnalysis â”‚               â”‚
â”‚  usp_GetReturnReasonsByCategory â”‚ usp_SaveMatchResult â”‚ ...        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 3. Correct FK relationship map

```
Packages (PK: Id)
  â””â”€â”€ ReturnRequests  (FK: PackageId      â†’ Packages.Id)
        â””â”€â”€ MatchAgentResults (FK: ReturnRequestId â†’ ReturnRequests.Id) âœ… fixed

Returns (PK: Id)  â† AI-validated physical return item
  â””â”€â”€ InventoryPool (FK: ReturnId         â†’ Returns.Id)               âœ… fixed

AgentRecommendations  (PK: Id) â€” no FK
DemandHistory         (PK: Id) â€” no FK
Buyers                (PK: Id) â€” no FK
```

**Insert sequence:** Packages â†’ ReturnRequests â†’ Returns â†’ InventoryPool â†’ MatchAgentResults â†’ AgentRecommendations

---

## 4. Data reality check

| Data | Source | Fallback |
|------|--------|----------|
| Dashboard KPI cards | `GET /api/dashboard/metrics` | Seed figures |
| Dashboard region bars | Aggregated from `GET /api/debug/matches` | Static array |
| Dashboard revenue locations | Aggregated from `GET /api/debug/matches` | Static array |
| Dashboard savings trend | `GET /api/dashboard/trend` | Static SVG polyline |
| Dashboard agent table | `GET /api/dashboard/agent-telemetry` | Static array |
| Dashboard root causes | `POST /api/rootcauseagent/cluster` | 3 seed clusters |
| Local Demand buyers | `GET /api/buyers?hub=` | Empty (`â€”`) |
| Local Demand scores/savings | `POST /api/matchagent/find-match` | `0` / `â€”` |
| Buyers Directory | `GET /api/buyers?hub=` | Empty |
| Trend Analytics | `GET /api/dashboard/trend?days=` | Empty charts |
| AI Eligibility | `GET /api/debug/matches` | 3 seed products |
| AI Copilot (free-text) | `POST /api/businessexplanation` | Generic fallback |
| AI Copilot (sample prompts) | Canned instant + live LLM upgrade | Canned only |
| Sustainability KPIs | `GET /api/dashboard/metrics` + `/feedback/summary` | Seed figures |
| **Dashboard donut chart** | `donutSlices` signal from `GET /api/debug/matches` | Static arcs |
| **Dashboard 10-Day Holding Trend** | Weekly match-rate from `GET /api/dashboard/trend` | Static polyline |
| **Dashboard Carbon Reduction Trend** | Daily COâ‚‚ from `GET /api/dashboard/trend` | Static polyline |
| **Sustainability hub leaderboard** | Match-rate + COâ‚‚ per hub from `GET /api/debug/matches` | Static array |
| **Sustainability Revenue by Category** | `costSaved` grouped by category from `GET /api/debug/matches` | Static bars |
| **Sustainability ESG badge** | `EsgScoreService.calculate()` from 4 live metrics | Score 0 / D |
| **Agent Performance table** | `GET /api/dashboard/agent-telemetry` | 5 demo agents |

### What remains static (no backend source yet)

- **Sustainability Profit vs Cost Trend** â€” second line chart (Janâ€“Jun static lines); can be wired to `GET /api/dashboard/trend`.
- **Sustainability COâ‚‚ by Hub bars** â€” static SVG grouped bar chart.

---

## 5. Backend endpoints â€” complete inventory

| Method | Endpoint | Status |
|--------|----------|--------|
| `GET` | `/api/buyers?hub=` | âœ… Live |
| `GET` | `/api/buyers/hubs` | âœ… Live |
| `GET` | `/api/dashboard/metrics` | âœ… Live |
| `GET` | `/api/dashboard/trend?days=` | âœ… Live |
| `GET` | `/api/dashboard/agent-telemetry` | âœ… Live (enhanced DTO) |
| `GET` | `/api/dashboard/segments` | âœ… Live |
| `POST` | `/api/businessexplanation` | âœ… Live |
| `GET` | `/api/debug/ai-health` | âœ… Live |
| `GET` | `/api/debug/dashboard` | âœ… Live |
| `GET` | `/api/debug/packages` | âœ… Live |
| `GET` | `/api/debug/returns` | âœ… Live |
| `GET` | `/api/debug/inventory` | âœ… Live |
| `GET` | `/api/debug/matches` | âœ… Live |
| `POST` | `/api/feedback` | âœ… Live |
| `GET` | `/api/feedback/summary` | âœ… Live |
| `POST` | `/api/imagevalidation` | âœ… Live |
| `POST` | `/api/integration/process-return` | âœ… Live (FK bugs fixed) |
| `POST` | `/api/matchagent/find-match` | âœ… Live (ReturnRequestId fixed) |
| `GET` | `/api/packages` | âœ… Live |
| `GET` | `/api/packages/{id}` | âœ… Live |
| `GET` | `/api/packages/tracking/{trackingNumber}` | âœ… Live |
| `GET` | `/api/returnrequests/{id}` | âœ… Live |
| `GET` | `/api/returnrequests/package/{packageId}` | âœ… Live |
| `POST` | `/api/rootcauseagent/analyze` | âœ… Live |
| `POST` | `/api/rootcauseagent/cluster` | âœ… Live |

---

## 6. Still to be done

### 6a. Frontend
1. **Sustainability Profit vs Cost Trend** â€” wire the second line chart in sustainability (currently static Janâ€“Jun lines) to `GET /api/dashboard/trend`.
2. **Return Submission** â†’ already wired; `runFullPipeline()` calls `POST /api/integration/process-return` and displays the full stepper result.
3. **Returns Inventory** â†’ already hydrated from `GET /api/debug/matches` + `GET /api/debug/inventory` via `ReturnService.hydrateFromBackend()`.

### 6b. Backend
1. **Policy RAG upgrade (optional)** â€” `PolicyRetriever` is in-process TF-IDF + cosine over `SyntheticPolicyCorpus`. For production, swap in an embeddings-backed `IPolicyRetriever` against Azure AI Search.
2. **`GET /api/dashboard/segments`** â€” `SegmentAnalytics` endpoint exists but has no Angular consumer; build a Retailer Portal analytics component.
3. **Automated integration tests** â€” add coverage for the full `process-return` pipeline path, including the FK-corrected insert sequence.

### 6c. Database / Infrastructure
1. **Run migration scripts in order** against the target database:
   `001` â†’ `006` â†’ `007` â†’ `008` â†’ `004` â†’ `005`
2. **Indexes** â€” add covering indexes on `Returns.Category`, `Returns.ReturnReason`, and `MatchAgentResults.CreatedAt` for dashboard query performance at scale.
3. **Azure OpenAI key** â€” set in environment / Key Vault; all AI-dependent agents fall back to seed data without it.

---

## 7. Quick run commands

```powershell
# Backend
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --project "UPS_ReLoop_Nexus\UPS_ReLoop_Nexus.csproj" --urls "http://localhost:5080"

# Frontend
cd ReLoop-Ai-frontend-main\ReLoop-Ai-frontend-main
npx ng serve --port 4200

# Health checks
curl http://localhost:5080/api/debug/ai-health
curl http://localhost:5080/api/buyers?hub=CHN
curl http://localhost:5080/api/dashboard/trend?days=30
curl http://localhost:5080/api/dashboard/agent-telemetry
curl http://localhost:5080/api/dashboard/metrics

# Run ESG unit tests (frontend)
cd ReLoop-Ai-frontend-main\ReLoop-Ai-frontend-main
npx ng test --no-watch   # 40 ESG tests pass
```

---

## 8. Files changed (full history)

### Backend (UPS_ReLoop_Nexus)

| File | Change |
|------|--------|
| `Controllers/DashboardController.cs` | Added `GetTrend`, `GetAgentTelemetry` |
| `Application/Interfaces/IDashboardService.cs` | Added `GetTrendAsync`, `GetAgentTelemetryAsync` |
| `Application/Interfaces/Repositories/ISpRepositories.cs` | Added `GetAgentTelemetryAsync` to `IDashboardSpRepository` |
| `Application/DTOs/Dashboard/DashboardDtos.cs` | `AgentTelemetryDto`: replaced `DecisionsMade`/`Precision` with `TotalRuns`, `SuccessfulRuns`, `PrecisionRate`, `AverageResponseTime` |
| `Application/DTOs/MatchAgent/MatchAgentDtos.cs` | Added `Guid? ReturnRequestId = null` to `MatchAgentRequest` |
| `Application/Services/DashboardService.cs` | Implemented `GetTrendAsync` + `GetAgentTelemetryAsync`; injects `AutoApprovalMetrics`; merges AutoApprovalAgent row |
| `Application/Services/ReturnProcessingOrchestrator.cs` | Fixed no-image FK bug; injects `IImageValidationSpRepository`; passes `ReturnRequestId` to `MatchAgentRequest` |
| `Application/Services/MatchAgentService.cs` | `SaveMatchResultAsync` uses `request.ReturnRequestId` instead of parsing `ProductId` |
| `Infrastructure/Persistence/Repositories/StoredProcedures/DashboardSpRepository.cs` | Updated `AgentTelemetrySpResult` + mapping for new DTO fields |

### SQL (`docs/SQL/`)

| File | Change |
|------|--------|
| `001_Buyers_Table_Seed_SPs.sql` | Buyers table + 25-row seed + `usp_GetBuyersByHub` |
| `002_Dashboard_Trend_AgentTelemetry_SPs.sql` | `usp_GetDashboardTrend` + original `usp_GetAgentTelemetry` (superseded by 004) |
| `003_FK_Fix_Insert_Order.sql` | Partial FK fix (superseded by 005) |
| `004_AgentTelemetry_Enhanced_SP.sql` | **NEW** â€” enhanced `usp_GetAgentTelemetry` with 5 columns |
| `005_FK_Remediation_Full.sql` | **NEW** â€” full FK remediation + SP recreation + seed |
| `006_Rename_ImageValidationResults_To_Returns.sql` | **NEW** â€” table rename + FK rename + SP recreation |
| `007_Core_SPs_DemandHistory_RootCause.sql` | **NEW** â€” `usp_GetDemandHistory`, `usp_SaveRootCauseAnalysis`, `usp_GetReturnReasonsByCategory` + DemandHistory seed |
| `008_Dashboard_Metrics_SPs.sql` | **NEW** â€” `usp_GetDashboardMetrics`, `usp_GetDashboardRootCauseInsights` |

### Frontend (`ReLoop-Ai-frontend-main/src/app/`)

| File | Change |
|------|--------|
| `core/api.service.ts` | `AgentTelemetry` interface updated (new fields); `getBuyers()`, `getDashboardTrend()`, `getAgentTelemetry()` added |
| `core/esg-score.service.ts` | **NEW** â€” 4-factor weighted ESG calculator with grade/colour/breakdown |
| `core/esg-score.service.spec.ts` | **NEW** â€” 40 Vitest unit tests (all passing) |
| `core/esg-badge/esg-badge.ts` | **NEW** â€” standalone badge component |
| `core/esg-badge/esg-badge.html` | **NEW** â€” expandable pill + breakdown panel |
| `core/esg-badge/esg-badge.css` | **NEW** â€” data-driven colour styles |
| `agent-performance/agent-performance.ts` | **NEW** â€” live agent telemetry table with sorting, filtering, auto-refresh |
| `agent-performance/agent-performance.html` | **NEW** â€” KPI cards + sortable table + badges |
| `agent-performance/agent-performance.css` | **NEW** â€” dashboard styles |
| `sustainability/sustainability.ts` | Injects `EsgScoreService`; computes `esgResult` from 4 live metrics; removed `computeEsgGrade()` |
| `sustainability/sustainability.html` | `<app-esg-badge [result]="esgResult()" />` replaces static badge |
| `sustainability/sustainability.css` | Removed `.esg-badge` rule |
| `dashboard/dashboard.ts` | Agent mapping updated for new DTO fields |
| `local-demand/local-demand.ts` | Removed hardcoded hub data; wired to API |
| `local-demand/local-demand.html` | Updated bindings for new `BuyerDto` |
| `buyers/buyers.ts` | **NEW** â€” Buyers Directory page |
| `buyers/buyers.html` | **NEW** |
| `buyers/buyers.css` | **NEW** |
| `trends/trends.ts` | **NEW** â€” Trend Analytics page |
| `trends/trends.html` | **NEW** |
| `trends/trends.css` | **NEW** |
| `ai-copilot/ai-copilot.ts` | Sample prompts fire live LLM |
| `app.routes.ts` | Added `/buyers`, `/trends`, `/agent-performance` routes |
| `sidebar/sidebar.ts` | Added 3 nav items |
| `dashboard/dashboard.ts` | `DonutSlice` interface; `donutSlices`, `holdingPoly`, `holdingDots`, `holdingLabels`, `co2TrendPoly`, `co2TrendArea`, `co2TrendYMax`, `co2TrendLabels` signals; `loadRegions()` extended for donut; `loadTrend()` extended for CO₂ + holding trend |
| `dashboard/dashboard.html` | Live donut SVG (`@for` + `[attr.stroke-dasharray]`); live 10-day holding trend; live carbon reduction trend — all with `@else` fallbacks |
| `sustainability/sustainability.ts` | `HubRow` + `CatBar` interfaces; `hubs` → `signal`; `catBars`, `catYMax` signals; `loadMatchData()` added; `DecimalPipe` imported |
| `sustainability/sustainability.html` | Hub leaderboard uses `hubs()`; Revenue by Category SVG uses `@for (b of catBars()...)` with dynamic y-axis |


