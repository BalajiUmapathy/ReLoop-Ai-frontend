import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard';
import { ReturnSubmissionComponent } from './return-submission/return-submission';
import { ReturnsInventoryComponent } from './returns-inventory/returns-inventory';
import { RetailerPortalComponent } from './retailer-portal/retailer-portal';
import { LocalDemand } from './local-demand/local-demand';
import { AiEligibilityComponent } from './ai-eligibility/ai-eligibility';
import { AiCopilotComponent } from './ai-copilot/ai-copilot';
import { SustainabilityComponent } from './sustainability/sustainability';
import { BuyersComponent } from './buyers/buyers';
import { TrendsComponent } from './trends/trends';
import { AgentPerformanceComponent } from './agent-performance/agent-performance';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'return-submission', component: ReturnSubmissionComponent },
  { path: 'returns-inventory', component: ReturnsInventoryComponent },
  { path: 'retailer-portal', component: RetailerPortalComponent },
  { path: 'local-demand', component: LocalDemand },
  { path: 'buyers', component: BuyersComponent },
  { path: 'trends', component: TrendsComponent },
  { path: 'ai-eligibility', component: AiEligibilityComponent },
  { path: 'ai-copilot', component: AiCopilotComponent },
  { path: 'sustainability', component: SustainabilityComponent },
  { path: 'agent-performance', component: AgentPerformanceComponent },
  { path: '**', redirectTo: 'dashboard' },
];
