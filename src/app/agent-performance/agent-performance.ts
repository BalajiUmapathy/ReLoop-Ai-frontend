import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { catchError, of, interval, Subscription } from 'rxjs';
import { ApiService, AgentTelemetry } from '../core/api.service';

/** View-model row: AgentTelemetry + client-computed successRate */
export interface AgentRow extends AgentTelemetry {
  successRate: number; // (successfulRuns / totalRuns) * 100
}

export type SortKey =
  | 'agentName'
  | 'totalRuns'
  | 'successRate'
  | 'precisionRate'
  | 'escalationRate'
  | 'averageResponseTime';

@Component({
  selector: 'app-agent-performance',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './agent-performance.html',
  styleUrl: './agent-performance.css',
})
export class AgentPerformanceComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private refreshSub?: Subscription;

  // ---- State ----
  loading = signal(true);
  error = signal<string | null>(null);
  lastRefreshed = signal<Date>(new Date());

  rawData = signal<AgentRow[]>([]);
  filterText = signal('');
  sortKey = signal<SortKey>('precisionRate');
  sortAsc = signal(false);

  // ---- Derived ----
  filtered = computed(() => {
    const q = this.filterText().toLowerCase().trim();
    return this.rawData().filter(r =>
      !q || r.agentName.toLowerCase().includes(q),
    );
  });

  sorted = computed(() => {
    const key = this.sortKey();
    const asc = this.sortAsc();
    return [...this.filtered()].sort((a, b) => {
      const av = a[key] as string | number;
      const bv = b[key] as string | number;
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    });
  });

  // ---- Summary KPIs ----
  totalAgents = computed(() => this.rawData().length);

  avgSuccessRate = computed(() => {
    const rows = this.rawData();
    return rows.length ? rows.reduce((s, r) => s + r.successRate, 0) / rows.length : 0;
  });

  avgPrecision = computed(() => {
    const rows = this.rawData();
    return rows.length ? rows.reduce((s, r) => s + r.precisionRate, 0) / rows.length : 0;
  });

  avgResponseTime = computed(() => {
    const rows = this.rawData();
    return rows.length
      ? Math.round(rows.reduce((s, r) => s + r.averageResponseTime, 0) / rows.length)
      : 0;
  });

  highEscalationCount = computed(() =>
    this.rawData().filter(r => r.escalationRate > 10).length,
  );

  totalDecisions = computed(() =>
    this.rawData().reduce((s, r) => s + r.totalRuns, 0),
  );

  // ---- Lifecycle ----
  ngOnInit(): void {
    this.loadData();
    this.refreshSub = interval(30_000).subscribe(() => this.loadData());
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getAgentTelemetry().pipe(
      catchError(() => {
        this.error.set('API unavailable — displaying demo data.');
        return of(this.demoData());
      }),
    ).subscribe(data => {
      this.rawData.set(
        data.map(d => ({
          ...d,
          successRate: d.totalRuns > 0
            ? Math.round((d.successfulRuns / d.totalRuns) * 10_000) / 100
            : 0,
        })),
      );
      this.lastRefreshed.set(new Date());
      this.loading.set(false);
    });
  }

  // ---- Sorting ----
  setSort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortAsc.update(v => !v);
    } else {
      this.sortKey.set(key);
      // name asc by default; metrics desc by default
      this.sortAsc.set(key === 'agentName');
    }
  }

  sortIcon(key: SortKey): string {
    if (this.sortKey() !== key) return '⇅';
    return this.sortAsc() ? '↑' : '↓';
  }

  // ---- Color helpers ----
  successClass(rate: number): string {
    if (rate >= 90) return 'badge-green';
    if (rate >= 70) return 'badge-amber';
    return 'badge-red';
  }

  precisionClass(rate: number): string {
    if (rate >= 90) return 'badge-green';
    if (rate >= 75) return 'badge-amber';
    return 'badge-red';
  }

  escalationClass(rate: number): string {
    if (rate <= 5) return 'badge-green';
    if (rate <= 15) return 'badge-amber';
    return 'badge-red';
  }

  responseTimeClass(ms: number): string {
    if (ms <= 100) return 'badge-green';
    if (ms <= 200) return 'badge-amber';
    return 'badge-red';
  }

  barColor(rate: number): string {
    if (rate >= 90) return '#16A34A';
    if (rate >= 70) return '#D97706';
    return '#DC2626';
  }

  overallStatus(row: AgentRow): { label: string; cls: string } {
    // Weighted score: success + precision penalised by escalation
    const score = (row.successRate * 0.45 + row.precisionRate * 0.45) - row.escalationRate * 0.1;
    if (score >= 82) return { label: 'Healthy', cls: 'status-green' };
    if (score >= 60) return { label: 'Watch', cls: 'status-amber' };
    return { label: 'Critical', cls: 'status-red' };
  }

  agentIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('match')) return '🔗';
    if (n.includes('image') || n.includes('valid')) return '🖼️';
    if (n.includes('root') || n.includes('cause')) return '🔍';
    if (n.includes('eligib')) return '✅';
    if (n.includes('auto') || n.includes('approval')) return '⚡';
    if (n.includes('pricing')) return '💲';
    return '🤖';
  }

  friendlyName(name: string): string {
    return name
      .replace(/Agent$/i, ' Agent')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
  }

  formatTime(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  }

  formatLargeNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  }

  lastRefreshedStr = computed(() =>
    this.lastRefreshed().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  );

  // ---- Demo fallback ----
  private demoData(): AgentTelemetry[] {
    return [
      {
        agentName: 'MatchAgent',
        totalRuns: 7840,
        successfulRuns: 7215,
        precisionRate: 91.7,
        escalationRate: 8.3,
        averageResponseTime: 120,
      },
      {
        agentName: 'ImageValidationAgent',
        totalRuns: 5640,
        successfulRuns: 5358,
        precisionRate: 95.0,
        escalationRate: 3.2,
        averageResponseTime: 250,
      },
      {
        agentName: 'RootCauseAgent',
        totalRuns: 3210,
        successfulRuns: 2983,
        precisionRate: 92.9,
        escalationRate: 7.1,
        averageResponseTime: 180,
      },
      {
        agentName: 'EligibilityAgent',
        totalRuns: 8920,
        successfulRuns: 8403,
        precisionRate: 94.2,
        escalationRate: 5.8,
        averageResponseTime: 95,
      },
      {
        agentName: 'AutoApprovalAgent',
        totalRuns: 4500,
        successfulRuns: 4320,
        precisionRate: 96.0,
        escalationRate: 2.0,
        averageResponseTime: 45,
      },
    ];
  }
}
