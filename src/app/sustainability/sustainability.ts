import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { catchError, of, forkJoin } from 'rxjs';
import { ApiService, DebugMatch, DashboardTrendPoint } from '../core/api.service';

interface Card { icon: string; label: string; value: string; desc?: string; color: string; valClass: string; }

interface TrendChart {
  title: string; icon: string; color: string; fillId: string;
  getValue: (p: DashboardTrendPoint) => number; format: (v: number) => string; unit: string;
}

@Component({
  selector: 'app-sustainability',
  imports: [],
  templateUrl: './sustainability.html',
  styleUrl: './sustainability.css',
})
export class SustainabilityComponent implements OnInit {
  private api = inject(ApiService);
  live = signal(false);

  finCards = signal<Card[]>([
    { icon: '💰', label: 'REVENUE RECOVERED', value: '₹1.2M', desc: 'From local resale operations', color: '#22C55E', valClass: 'green' },
    { icon: '🚚', label: 'COST AVOIDANCE', value: '₹487K', desc: 'Reverse logistics savings', color: '#F5A623', valClass: 'amber' },
    { icon: '📈', label: 'PROFIT IMPROVEMENT', value: '₹725K', desc: 'Net operational impact', color: '#1a0d06', valClass: 'dark' },
    { icon: '🎯', label: 'PROJECTED ANNUAL BENEFIT', value: '₹8.5M', desc: 'Based on current trajectory', color: '#6366F1', valClass: 'blue' },
  ]);

  envCards = signal<Card[]>([
    { icon: '🌿', label: 'CO₂ REDUCED', value: '428 tons', color: '#22C55E', valClass: 'green' },
    { icon: '🗺️', label: 'DISTANCE SAVED', value: '125,000 km', color: '#6366F1', valClass: 'blue' },
    { icon: '⛽', label: 'FUEL SAVED', value: '16,500 L', color: '#F5A623', valClass: 'amber' },
  ]);


  hubs = signal([
    { name: 'Chennai Hub', co2: '14.2t', score: 94, barW: 100 },
    { name: 'Bangalore Hub', co2: '12.8t', score: 91, barW: 91 },
    { name: 'Mumbai Hub', co2: '9.1t', score: 86, barW: 86 },
    { name: 'Delhi Hub', co2: '5.4t', score: 79, barW: 79 },
    { name: 'Hyderabad Hub', co2: '1.3t', score: 71, barW: 71 },
  ]);

  // ---- 30-day live performance trends (merged from the former Trends page) ----
  trendPoints = signal<DashboardTrendPoint[]>([]);
  trendCharts: TrendChart[] = [
    {
      title: 'Cost Savings Trend', icon: '💰', color: '#22C55E', fillId: 'susFillSavings',
      getValue: (p) => p.costSaved,
      format: (v) => v >= 1000 ? `₹${(v / 1000).toFixed(1)}K` : `₹${Math.round(v)}`, unit: '₹',
    },
    {
      title: 'Returns vs Local Matches', icon: '🔗', color: '#6366F1', fillId: 'susFillDiversion',
      getValue: (p) => p.localMatches, format: (v) => `${Math.round(v)}`, unit: 'matches',
    },
    {
      title: 'CO₂ Reduction Trend', icon: '🌿', color: '#14B8A6', fillId: 'susFillCo2',
      getValue: (p) => p.co2SavedKg,
      format: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}T` : `${v.toFixed(1)} kg`, unit: 'kg',
    },
  ];

  trendPolylines = computed(() => {
    const pts = this.trendPoints();
    if (!pts.length) return this.trendCharts.map(() => ({ line: '', area: '', yLabels: ['0', '0', '0', '0', '0'], xLabels: [] as string[], kpiTotal: 0, kpiAvg: 0, kpiPeak: 0 }));

    const W = 500, H = 180, PX = 10, PY = 10;
    const plotW = W - PX * 2, plotH = H - PY * 2;
    const xStep = pts.length > 1 ? plotW / (pts.length - 1) : 0;
    const step = Math.max(1, Math.floor(pts.length / 6));
    const xLabels = pts
      .map((p) => new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
      .filter((_, i) => i % step === 0 || i === pts.length - 1);

    return this.trendCharts.map((c) => {
      const vals = pts.map(c.getValue);
      const peak = Math.max(...vals, 1);
      const yMax = Math.ceil(peak * 1.15) || 100;
      const toY = (v: number) => PY + plotH - (v / yMax) * plotH;
      const toX = (i: number) => PX + i * xStep;
      const line = vals.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
      const area = `${toX(0)},${toY(0)} ${line} ${toX(vals.length - 1)},${PY + plotH} ${toX(0)},${PY + plotH}`;
      const total = vals.reduce((s, v) => s + v, 0);
      return {
        line, area,
        yLabels: [this.shortNum(yMax), this.shortNum(yMax * 0.75), this.shortNum(yMax * 0.5), this.shortNum(yMax * 0.25), '0'],
        xLabels, kpiTotal: total, kpiAvg: total / vals.length, kpiPeak: peak,
      };
    });
  });

  returnsLine = computed(() => {
    const pts = this.trendPoints();
    if (!pts.length) return '';
    const W = 500, H = 180, PX = 10, PY = 10;
    const plotW = W - PX * 2, plotH = H - PY * 2;
    const xStep = pts.length > 1 ? plotW / (pts.length - 1) : 0;
    const matchVals = pts.map((p) => p.localMatches);
    const returnVals = pts.map((p) => p.returns);
    const peak = Math.max(...matchVals, ...returnVals, 1);
    const yMax = Math.ceil(peak * 1.15) || 100;
    const toY = (v: number) => PY + plotH - (v / yMax) * plotH;
    return returnVals.map((v, i) => `${PX + i * xStep},${toY(v)}`).join(' ');
  });

  shortNum(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return `${Math.round(v)}`;
  }

  ngOnInit(): void {
    forkJoin({
      metrics: this.api.getDashboardMetrics().pipe(catchError(() => of(null))),
      matches: this.api.getMatches().pipe(catchError(() => of(null))),
    }).subscribe(({ metrics, matches }) => {
      if (metrics) {
        this.live.set(true);
        this.patch(this.finCards, 'REVENUE RECOVERED', this.money(metrics.costSaved));
        this.patch(this.finCards, 'COST AVOIDANCE', this.money(metrics.costSaved));
        // Profit modelled at ~1.5x logistics savings, projected annual = quarter x4.
        this.patch(this.finCards, 'PROFIT IMPROVEMENT', this.money(metrics.costSaved * 1.5));
        this.patch(this.finCards, 'PROJECTED ANNUAL BENEFIT', this.money(metrics.costSaved * 4));
        this.patch(this.envCards, 'CO₂ REDUCED', `${(metrics.co2SavedKg / 1000).toFixed(1)} tons`);
        this.patch(this.envCards, 'DISTANCE SAVED', `${Math.round(metrics.distanceSavedKm).toLocaleString()} km`);
        // Diesel reverse-haul ~0.13 L/km avoided.
        this.patch(this.envCards, 'FUEL SAVED', `${Math.round(metrics.distanceSavedKm * 0.13).toLocaleString()} L`);
      }
      const rows = matches?.data ?? [];
      if (rows.length) this.buildHubs(rows);
    });

    // Live 30-day trend charts (merged from the former Trends page).
    this.api.getDashboardTrend(30).pipe(catchError(() => of(null))).subscribe((data) => {
      if (data) this.trendPoints.set(data);
    });
  }

  /** Rank hubs by live CO₂ saved and average match score from real match data. */
  private buildHubs(rows: DebugMatch[]): void {
    const agg = new Map<string, { co2: number; score: number; n: number }>();
    for (const m of rows) {
      const city = (m.location || 'Unknown').split(/[ ,]/)[0];
      const a = agg.get(city) ?? { co2: 0, score: 0, n: 0 };
      a.co2 += m.co2Saved; a.score += m.matchScore; a.n += 1;
      agg.set(city, a);
    }
    const ranked = [...agg.entries()]
      .map(([name, a]) => ({ name: `${name} Hub`, co2Kg: a.co2, score: Math.round(a.score / a.n) }))
      .sort((x, y) => y.score - x.score);
    if (!ranked.length) return;
    const top = ranked[0].score || 1;
    this.hubs.set(
      ranked.map((h) => ({
        name: h.name,
        co2: `${(h.co2Kg / 1000).toFixed(1)}t`,
        score: h.score,
        barW: Math.round((h.score / top) * 100),
      })),
    );
  }

  private patch<T extends { label: string; value: string }>(sig: ReturnType<typeof signal<T[]>>, label: string, value: string): void {
    sig.update((cards) => cards.map((c) => (c.label === label ? { ...c, value } : c)));
  }

  private money(v: number): string {
    if (v >= 1_000_000) return `₹${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
    return `₹${Math.round(v)}`;
  }
}
