import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard';
import { ReturnSubmissionComponent } from './return-submission/return-submission';
import { ReturnsInventoryComponent } from './returns-inventory/returns-inventory';
import { RetailerPortalComponent } from './retailer-portal/retailer-portal';
import { LocalDemand } from './local-demand/local-demand';
import { AiCopilotComponent } from './ai-copilot/ai-copilot';
import { SustainabilityComponent } from './sustainability/sustainability';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'return-submission', component: ReturnSubmissionComponent },
  { path: 'returns-inventory', component: ReturnsInventoryComponent },
  { path: 'retailer-portal', component: RetailerPortalComponent },
  { path: 'local-demand', component: LocalDemand },
  { path: 'ai-copilot', component: AiCopilotComponent },
  { path: 'sustainability', component: SustainabilityComponent },
  { path: '**', redirectTo: 'dashboard' },
];
