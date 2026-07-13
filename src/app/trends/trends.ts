import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { catchError, of } from 'rxjs';
import { ApiService, DashboardTrendPoint } from '../core/api.service';

interface ChartConfig {
  title: string;
  icon: string;
  color: string;
  fillId: string;
  getValue: (p: DashboardTrendPoint) => number;
  format: (v: number) => string;
  unit: string;
}

@Component({
  selector: 'app-trends',
  imports: [],
  templateUrl: './trends.html',
  styleUrl: './trends.css',
})
export class TrendsComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(true);
  error = signal<string | null>(null);
  points = signal<DashboardTrendPoint[]>([]);
  days = signal(30);

  charts: ChartConfig[] = [
    {
      title: 'Cost Savings Trend',
      icon: '💰',
      color: '#22C55E',
      fillId: 'fillSavings',
      getValue: (p) => p.costSaved,
      format: (v) => v >= 1000 ? `₹${(v / 1000).toFixed(1)}K` : `₹${Math.round(v)}`,
      unit: '₹',
    },
    {
      title: 'Returns vs Local Matches',
      icon: '🔗',
      color: '#6366F1',
      fillId: 'fillDiversion',
      getValue: (p) => p.localMatches,
      format: (v) => `${Math.round(v)}`,
      unit: 'matches',
    },
    {
      title: 'CO₂ Reduction Trend',
      icon: '🌿',
      color: '#14B8A6',
      fillId: 'fillCo2',
      getValue: (p) => p.co2SavedKg,
      format: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}T` : `${v.toFixed(1)} kg`,
      unit: 'kg',
    },
  ];

  // Pre-computed polylines and labels for each chart
  polylines = computed(() => {
    const pts = this.points();
    if (!pts.length) return this.charts.map(() => ({ line: '', area: '', yMax: 100, yLabels: ['100', '75', '50', '25', '0'], xLabels: [] as string[], kpiTotal: 0, kpiAvg: 0, kpiPeak: 0 }));

    const W = 500, H = 180, PX = 10, PY = 10;
    const plotW = W - PX * 2;
    const plotH = H - PY * 2;
    const xStep = pts.length > 1 ? plotW / (pts.length - 1) : 0;

    // X labels: every ~5th day
    const step = Math.max(1, Math.floor(pts.length / 6));
    const xLabels = pts
      .map((p, i) => ({ i, label: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }))
      .filter((_, i) => i % step === 0 || i === pts.length - 1)
      .map(x => x.label);

    return this.charts.map((c) => {
      const vals = pts.map(c.getValue);
      const peak = Math.max(...vals, 1);
      const yMax = Math.ceil(peak * 1.15) || 100;
      const toY = (v: number) => PY + plotH - (v / yMax) * plotH;
      const toX = (i: number) => PX + i * xStep;

      const linePoints = vals.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
      const areaPoints = `${toX(0)},${toY(0)} ${linePoints} ${toX(vals.length - 1)},${PY + plotH} ${toX(0)},${PY + plotH}`;

      const total = vals.reduce((s, v) => s + v, 0);
      const q4 = yMax * 0.75, q2 = yMax * 0.5, q1 = yMax * 0.25;

      return {
        line: linePoints,
        area: areaPoints,
        yMax,
        yLabels: [this.shortNum(yMax), this.shortNum(q4), this.shortNum(q2), this.shortNum(q1), '0'],
        xLabels,
        kpiTotal: total,
        kpiAvg: total / vals.length,
        kpiPeak: peak,
      };
    });
  });

  // Secondary line for the diversion chart (returns overlaid)
  returnsLine = computed(() => {
    const pts = this.points();
    if (!pts.length) return '';
    const W = 500, H = 180, PX = 10, PY = 10;
    const plotW = W - PX * 2, plotH = H - PY * 2;
    const xStep = pts.length > 1 ? plotW / (pts.length - 1) : 0;

    const matchVals = pts.map(p => p.localMatches);
    const returnVals = pts.map(p => p.returns);
    const peak = Math.max(...matchVals, ...returnVals, 1);
    const yMax = Math.ceil(peak * 1.15) || 100;
    const toY = (v: number) => PY + plotH - (v / yMax) * plotH;

    return returnVals.map((v, i) => `${PX + i * xStep},${toY(v)}`).join(' ');
  });

  ngOnInit(): void {
    this.load();
  }

  reload(): void {
    this.load();
  }

  changeDays(d: number): void {
    this.days.set(d);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getDashboardTrend(this.days())
      .pipe(catchError(() => {
        this.error.set('Failed to load trend data. The backend may be offline.');
        this.loading.set(false);
        return of(null);
      }))
      .subscribe((data) => {
        this.loading.set(false);
        if (data) this.points.set(data);
      });
  }

  shortNum(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return `${Math.round(v)}`;
  }

  fmtKpi(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toFixed(1);
  }
}
