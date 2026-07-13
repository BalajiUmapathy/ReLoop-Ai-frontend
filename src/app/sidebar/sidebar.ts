import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <div class="logo-badge">R</div>
          <div class="logo-info">
            <span class="logo-title">ReLoop AI</span>
            <span class="logo-sub">Return Intelligence</span>
          </div>
        </div>
        <!--<button class="collapse-btn">&#8249;</button>-->
      </div>
      <nav class="nav">
        @for (item of navItems; track item.label) {
          <a class="nav-item" [routerLink]="item.route" routerLinkActive="active">
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label">{{ item.label }}</span>
          </a>
        }
      </nav>
    </aside>
  `,
  styles: [`
    .sidebar { width: 220px; min-width: 220px; background: #1a0d06; display: flex; flex-direction: column; overflow-y: auto; scrollbar-width: none; height: 100vh; }
    .sidebar::-webkit-scrollbar { display: none; }
    .sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 14px; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .logo { display: flex; align-items: center; gap: 10px; }
    .logo-badge { width: 36px; height: 36px; background: #F5A623; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 17px; color: white; flex-shrink: 0; }
    .logo-info { display: flex; flex-direction: column; line-height: 1; }
    .logo-title { color: #fff; font-weight: 700; font-size: 14px; margin-bottom: 2px; }
    .logo-sub { color: #F5A623; font-size: 10px; font-weight: 500; }
    .collapse-btn { background: none; border: 1px solid rgba(255,255,255,0.18); border-radius: 4px; color: rgba(255,255,255,0.5); cursor: pointer; padding: 1px 7px; font-size: 16px; line-height: 1.4; transition: background 0.2s; }
    .collapse-btn:hover { background: rgba(255,255,255,0.08); }
    .nav { padding: 12px 8px; display: flex; flex-direction: column; gap: 2px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 6px; cursor: pointer; color: rgba(255,255,255,0.6); font-size: 12.5px; font-weight: 400; transition: background 0.2s, color 0.2s; user-select: none; text-decoration: none; }
    .nav-item:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.85); }
    .nav-item.active { background: rgba(180,80,20,0.5); color: #fff; font-weight: 500; }
    .nav-icon { font-size: 15px; width: 20px; text-align: center; flex-shrink: 0; }
    .nav-label { line-height: 1.2; }
  `]
})
export class SidebarComponent {
  navItems = [
    { label: 'Executive Dashboard', icon: '⊞', route: '/dashboard' },
    { label: 'Return Submission Portal', icon: '📋', route: '/return-submission' },
    { label: 'Returns Inventory', icon: '📦', route: '/returns-inventory' },
    { label: 'AI Eligibility & Analytics', icon: '📊', route: '/ai-eligibility' },
    { label: 'Retailer Portal', icon: '🛍️', route: '/retailer-portal' },
    { label: 'Local Demand Matching', icon: '📍', route: '/local-demand' },
    { label: 'Buyers Directory', icon: '🏪', route: '/buyers' },
    { label: 'Trend Analytics', icon: '📈', route: '/trends' },
    { label: 'AI Copilot Assistant', icon: '💬', route: '/ai-copilot' },
    { label: 'Sustainability & Business Impact', icon: '🌱', route: '/sustainability' },
  ];
}
