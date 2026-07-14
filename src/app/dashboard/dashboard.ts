import { Component, inject, signal, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { catchError, of, forkJoin } from 'rxjs';
import { ApiService, ReturnCluster, ClusterReturnItem, DashboardMetrics, DashboardTrendPoint } from '../core/api.service';

interface MetricCard {
  label: string; value: string; description: string;
  change: string; icon: string; borderColor: string;
}

/** One arc segment in the live donut chart. */
interface DonutSlice {
  color: string;
  label: string;
  dasharray: string;   // SVG stroke-dasharray
  dashoffset: number;  // SVG stroke-dashoffset
}

@Component({
  selector: 'app-dashboard',
  imports: [DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);

  /** True once real metrics have been merged in from the backend. */
  live = signal(false);
  diversionRate = signal('71.6%');
  diversionProgress = signal(84.2);
  heroRevenue = signal('₹12,47,832');

  metrics = signal<MetricCard[]>([
    { label: 'TOTAL RETURNS', value: '12,450', description: 'This quarter', change: '↑ 8.2% vs last month', icon: '📦', borderColor: '#F97316' },
    { label: 'ELIGIBLE FOR RESALE', value: '8,920', description: '71.6% eligibility rate', change: '↑ 12.4% vs last month', icon: '✅', borderColor: '#EAB308' },
    { label: 'LOCAL RESALE RATE', value: '76%', description: 'Target: 80%', change: '↑ 4.1% vs last month', icon: '🎯', borderColor: '#22C55E' },
    { label: 'REVENUE RECOVERED', value: '₹1.2M', description: 'From local resale', change: '↑ 18.7% vs last month', icon: '💰', borderColor: '#1a0d06' },
    { label: 'COST AVOIDANCE', value: '₹487K', description: 'Logistics savings', change: '↑ 11.2% vs last month', icon: '🚚', borderColor: '#EAB308' },
    { label: 'PROFIT GENERATED', value: '₹725K', description: 'Net impact', change: '↑ 22.5% vs last month', icon: '📈', borderColor: '#14B8A6' },
    { label: 'CO₂ REDUCED', value: '42.8T', description: 'Tons of emissions', change: '↑ 31.2% vs last month', icon: '🌿', borderColor: '#86EFAC' },
    { label: 'MILES SAVED', value: '125K', description: 'Transportation distance', change: '↑ 28.6% vs last month', icon: '🗺️', borderColor: '#6366F1' },
    { label: 'MATCH RATE', value: '84%', description: 'Matched on arrival', change: '↑ 5.1% vs last month', icon: '🔗', borderColor: '#A855F7' },
    { label: 'AVG DAYS TO SELL', value: '3.2d', description: 'Down from 4.8 days', change: '↓ 32% improvement', icon: '⏱️', borderColor: '#D97706' },
    { label: 'AI COST PER ITEM', value: '₹4', description: 'Platform AI cost', change: '↓ 8.3% vs last month', icon: '🤖', borderColor: '#EC4899' },
  ]);

  regions = signal([
    { label: 'Chennai', dark: 3800, gold: 2700 },
    { label: 'Bangalore', dark: 2800, gold: 2600 },
    { label: 'Mumbai', dark: 2600, gold: 2100 },
    { label: 'Delhi', dark: 2100, gold: 1900 },
    { label: 'Hyderabad', dark: 1600, gold: 1100 },
  ]);

  revLocations = signal([
    { name: 'Chennai Hub', val: '₹312K', pct: 100 },
    { name: 'Bangalore Hub', val: '₹284K', pct: 91 },
    { name: 'Mumbai Hub', val: '₹231K', pct: 74 },
    { name: 'Delhi Hub', val: '₹197K', pct: 63 },
    { name: 'Hyderabad Hub', val: '₹143K', pct: 46 },
  ]);

  agents = signal([
    { name: 'Eligibility Agent', decisions: '8,920', precision: '94.2%', escalation: '5.8% escalated', escLow: true, escMid: false, escHigh: false },
    { name: 'Demand Match Agent', decisions: '7,840', precision: '91.7%', escalation: '8.3% escalated', escLow: false, escMid: true, escHigh: false },
    { name: 'Pricing Agent', decisions: '3,120', precision: '88.4%', escalation: '11.6% escalated', escLow: false, escMid: false, escHigh: true },
    { name: 'Carbon Agent', decisions: '12,450', precision: '97.1%', escalation: '2.9% escalated', escLow: true, escMid: false, escHigh: false },
  ]);

  // Savings trend line data — loaded from GET /api/dashboard/trend.
  trendPoints = signal<DashboardTrendPoint[]>([]);
  trendPolyDark = signal('');  // costSaved line
  trendPolyGold = signal('');  // co2Saved line
  trendLabels = signal<string[]>([]);
  trendYMax = signal(180);

  // Live donut chart — category breakdown from match data.
  donutSlices = signal<DonutSlice[]>([]);

  // 10-Day holding success trend — weekly match-rate from trend data.
  holdingPoly   = signal('');
  holdingDots   = signal<{ cx: number; cy: number }[]>([]);
  holdingLabels = signal<string[]>([]);

  // Carbon reduction trend — daily CO₂ series from trend data.
  co2TrendPoly   = signal('');
  co2TrendArea   = signal('');
  co2TrendYMax   = signal(8);
  co2TrendLabels = signal<string[]>([]);

  // Root-cause clusters (Reduce pillar) — populated live from /rootcauseagent/cluster.
  rootCausesLive = signal(false);
  rootCauses = signal<ReturnCluster[]>([
    { category: 'Apparel', dominantReason: 'Size Chart Error', count: 0, percentage: 40, topLocation: 'Mumbai', estimatedAnnualImpactUsd: 380000, fixTicket: 'Fix Ticket Raised' },
    { category: 'Electronics', dominantReason: 'Software Bug On Arrival', count: 0, percentage: 27, topLocation: 'Chennai', estimatedAnnualImpactUsd: 520000, fixTicket: 'In Review' },
    { category: 'Footwear', dominantReason: 'Width Mismatch', count: 0, percentage: 18, topLocation: 'Bangalore', estimatedAnnualImpactUsd: 210000, fixTicket: 'Fix Ticket Raised' },
  ]);

  insIcon = ['⚡', '📊', '📈', '💻'];
  insIconClass = ['amber', 'blue', 'purple', 'teal'];
  aiInsights = signal<string[]>([
    'Electronics show the highest local resale probability this quarter.',
    'Local resale continues to reduce warehouse processing load.',
    'Revenue recovery is trending up as match rates improve.',
    'CO₂ savings scale directly with the diversion rate.',
  ]);
  private lastMetrics: DashboardMetrics | null = null;

  ngOnInit(): void {
    this.api
      .getDashboardMetrics()
      .pipe(catchError(() => of(null)))
      .subscribe((m) => {
        if (!m) return; // backend offline — keep the demo figures
        this.live.set(true);

        const eligibilityRate = m.totalReturns > 0 ? (m.eligibleReturns / m.totalReturns) * 100 : 0;
        const div = m.diversionRate <= 1 ? m.diversionRate * 100 : m.diversionRate;
        this.diversionRate.set(`${div.toFixed(1)}%`);
        this.diversionProgress.set(Math.min(100, (div / 85) * 100));
        this.heroRevenue.set(this.money(m.costSaved));

        this.patch('TOTAL RETURNS', this.compact(m.totalReturns), 'This quarter');
        this.patch('ELIGIBLE FOR RESALE', this.compact(m.eligibleReturns), `${eligibilityRate.toFixed(1)}% eligibility rate`);
        this.patch('LOCAL RESALE RATE', `${div.toFixed(0)}%`, 'Target: 85%');
        this.patch('REVENUE RECOVERED', this.money(m.costSaved), 'From local resale');
        this.patch('COST AVOIDANCE', this.money(m.costSaved), 'Logistics savings');
        this.patch('CO₂ REDUCED', `${(m.co2SavedKg / 1000).toFixed(1)}T`, 'Tonnes of emissions');
        this.patch('MILES SAVED', this.compact(m.distanceSavedKm), 'Transportation distance (km)');
        this.patch('MATCH RATE', `${div.toFixed(0)}%`, `${m.localMatches} local matches`);

        this.lastMetrics = m;
        this.buildInsights(m);
      });

    this.loadRootCauses();
    this.loadRegions();
    this.loadTrend();
    this.loadAgentTelemetry();
  }

  /** Joins real returns + match rows and asks the Root Cause agent to cluster them into priced fix-tickets. */
  private loadRootCauses(): void {
    forkJoin({
      returns: this.api.getReturns().pipe(catchError(() => of(null))),
      matches: this.api.getMatches().pipe(catchError(() => of(null))),
    }).subscribe(({ returns, matches }) => {
      if (!matches?.data?.length) return;
      const reasonById = new Map<string, string>();
      for (const r of returns?.data ?? []) reasonById.set(r.id, r.reason);
      const items: ClusterReturnItem[] = matches.data.map((m) => ({
        category: m.category,
        productName: m.productName,
        returnReason: reasonById.get(m.returnRequestId) ?? 'Unspecified',
        location: m.location,
      }));
      this.api
        .clusterReturns(items)
        .pipe(catchError(() => of(null)))
        .subscribe((res) => {
          if (!res?.clusters?.length) return;
          this.rootCauses.set(res.clusters.slice(0, 3));
          this.rootCausesLive.set(true);
          if (this.lastMetrics) this.buildInsights(this.lastMetrics);
        });
    });
  }

  /** Build the AI Insights list from live metrics and clusters. */
  private buildInsights(m: DashboardMetrics): void {
    const div = m.diversionRate <= 1 ? m.diversionRate * 100 : m.diversionRate;
    const top = this.rootCauses()[0];
    const out = [
      `Diversion rate is ${div.toFixed(1)}% — ${Math.max(0, 85 - div).toFixed(1)} points from the 85% target.`,
      `${this.compact(m.localMatches)} returns matched locally, recovering ${this.money(m.costSaved)} in logistics cost.`,
      `${(m.co2SavedKg / 1000).toFixed(1)}T CO₂ avoided by keeping returned items in-market.`,
      top
        ? `Top systemic driver: ${top.category} — "${top.dominantReason}" (${top.percentage}% of that segment).`
        : `${this.compact(m.eligibleReturns)} items cleared the resale-eligibility threshold this cycle.`,
    ];
    this.aiInsights.set(out);
  }

  /** Patch a KPI card's value/description in place, leaving styling intact. */
  private patch(label: string, value: string, description: string): void {
    this.metrics.update((cards) =>
      cards.map((c) => (c.label === label ? { ...c, value, description } : c)),
    );
  }

  private money(v: number): string {
    if (v >= 1_000_000) return `₹${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
    return `₹${Math.round(v)}`;
  }

  private compact(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return `${Math.round(v)}`;
  }

  /** Public INR formatter for root-cause annual-impact figures. */
  impact(v: number): string {
    return this.money(v);
  }

  /** Load region bars + revenue locations + live donut slices from match data. */
  private loadRegions(): void {
    this.api.getMatches().pipe(catchError(() => of(null))).subscribe((res) => {
      const rows = res?.data ?? [];
      if (!rows.length) return;

      const cityMap: Record<string, string> = {
        Chennai: 'Chennai', Bangalore: 'Bangalore', Mumbai: 'Mumbai', Delhi: 'Delhi', Hyderabad: 'Hyderabad',
      };
      const totalsByCity = new Map<string, { count: number; resold: number; revenue: number }>();

      // Category config for donut
      const catColors: Record<string, string> = {
        Electronics: '#1a0d06', Apparel: '#F5A623', Home: '#22C55E',
        Sports: '#6366F1', Books: '#92400E',
      };
      const catOrder = ['Electronics', 'Apparel', 'Home', 'Sports', 'Books'];
      const catCounts = new Map<string, number>();

      for (const m of rows) {
        const city = (m.location || '').split(/[ ,]/)[0];
        const mapped = cityMap[city];
        if (mapped) {
          const entry = totalsByCity.get(mapped) ?? { count: 0, resold: 0, revenue: 0 };
          entry.count++;
          if (m.matchScore >= 60) entry.resold++;
          entry.revenue += m.costSaved;
          totalsByCity.set(mapped, entry);
        }
        const cat = catOrder.includes(m.category) ? m.category : 'Other';
        catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
      }

      const regionOrder = ['Chennai', 'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad'];

      this.regions.set(regionOrder.map(label => {
        const e = totalsByCity.get(label) ?? { count: 0, resold: 0 };
        return { label, dark: e.count, gold: e.resold };
      }));

      const revenueList = regionOrder.map(label => {
        const e = totalsByCity.get(label) ?? { revenue: 0 };
        return { name: `${label} Hub`, revenue: e.revenue };
      }).sort((a, b) => b.revenue - a.revenue);

      const maxRev = Math.max(revenueList[0]?.revenue ?? 1, 1);
      this.revLocations.set(revenueList.map(r => ({
        name: r.name,
        val: this.money(r.revenue),
        pct: Math.round((r.revenue / maxRev) * 100),
      })));

      // ---- Donut slices ----
      const total = rows.length || 1;
      const circ = 2 * Math.PI * 45; // circumference for r=45
      const activeCats = [...catOrder, 'Other'].filter(c => (catCounts.get(c) ?? 0) > 0);
      let cumLen = 0;
      const slices: DonutSlice[] = activeCats.map(cat => {
        const count = catCounts.get(cat) ?? 0;
        const len = (count / total) * circ;
        const s: DonutSlice = {
          color: catColors[cat] ?? '#9CA3AF',
          label: cat,
          dasharray: `${len.toFixed(2)} ${(circ - len).toFixed(2)}`,
          dashoffset: -cumLen,
        };
        cumLen += len;
        return s;
      });
      if (slices.length) this.donutSlices.set(slices);
    });
  }

  /** Load savings trend from GET /api/dashboard/trend (30-day daily). */
  private loadTrend(): void {
    this.api.getDashboardTrend(30).pipe(catchError(() => of(null))).subscribe((pts) => {
      if (!pts?.length) return;
      this.trendPoints.set(pts);

      // Shared x-labels (every ~5th point)
      const step = Math.max(1, Math.floor(pts.length / 6));
      const labels = pts
        .filter((_, i) => i % step === 0 || i === pts.length - 1)
        .map(p => new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      this.trendLabels.set(labels);

      // ---- Monthly Savings Trend (costSaved + co2 overlay) ----
      const maxCost = Math.max(...pts.map(p => p.costSaved), 1);
      const maxCo2  = Math.max(...pts.map(p => p.co2SavedKg), 1);
      const yMax = Math.ceil(Math.max(maxCost, maxCo2) * 1.15);
      this.trendYMax.set(yMax || 180);

      const w = 260, h = 140, pad = 20;
      const xStep = pts.length > 1 ? (w - pad * 2) / (pts.length - 1) : 0;
      const toY = (v: number, max: number) => h - (v / max) * h;
      this.trendPolyDark.set(pts.map((p, i) => `${pad + i * xStep},${toY(p.costSaved, yMax)}`).join(' '));
      this.trendPolyGold.set(pts.map((p, i) => `${pad + i * xStep},${toY(p.co2SavedKg, yMax)}`).join(' '));

      // ---- CO₂ Reduction Trend (separate chart, kg scale) ----
      const co2Peak = Math.max(...pts.map(p => p.co2SavedKg), 1);
      const co2YMax = Math.ceil(co2Peak * 1.25) || 8;
      this.co2TrendYMax.set(co2YMax);
      this.co2TrendLabels.set(labels);

      const cW = 238, cPad = 20, cTop = 12, cBot = 130;
      const cH = cBot - cTop;
      const cXStep = pts.length > 1 ? cW / (pts.length - 1) : 0;
      const toCY = (v: number) => cBot - (v / co2YMax) * cH;
      const co2Pts = pts.map((p, i) => `${cPad + i * cXStep},${toCY(p.co2SavedKg).toFixed(1)}`).join(' ');
      this.co2TrendPoly.set(co2Pts);
      const lastCX = cPad + (pts.length - 1) * cXStep;
      this.co2TrendArea.set(`${co2Pts} ${lastCX.toFixed(1)},${cBot} ${cPad},${cBot}`);

      // ---- 10-Day Holding Success Trend (weekly match-rate buckets) ----
      const bucketSize = Math.max(1, Math.ceil(pts.length / 7));
      const weeks: number[] = [];
      for (let i = 0; i < pts.length; i += bucketSize) {
        const slice = pts.slice(i, i + bucketSize);
        const totalRet   = slice.reduce((s, p) => s + Math.max(p.returns, 1), 0);
        const totalMatch = slice.reduce((s, p) => s + p.localMatches, 0);
        weeks.push(Math.min(99, Math.round((totalMatch / totalRet) * 100)));
      }
      const wW = 238, wPad = 20, wTop = 12, wBot = 140;
      const wH = wBot - wTop;
      const wXStep = weeks.length > 1 ? wW / (weeks.length - 1) : 0;
      const toHY = (v: number) => wBot - (v / 100) * wH;
      this.holdingPoly.set(weeks.map((v, i) => `${wPad + i * wXStep},${toHY(v).toFixed(1)}`).join(' '));
      this.holdingDots.set(weeks.map((v, i) => ({ cx: wPad + i * wXStep, cy: toHY(v) })));
      this.holdingLabels.set(weeks.map((_, i) => `W${i + 1}`));
    });
  }

  /** Load agent telemetry from GET /api/dashboard/agent-telemetry. */
  private loadAgentTelemetry(): void {
    this.api.getAgentTelemetry().pipe(catchError(() => of(null))).subscribe((data) => {
      if (!data?.length) return;
      this.agents.set(data.map(a => {
        const esc = a.escalationRate;
        return {
          name: a.agentName,
          decisions: a.totalRuns.toLocaleString(),
          precision: `${a.precisionRate.toFixed(1)}%`,
          escalation: `${esc.toFixed(1)}% escalated`,
          escLow: esc < 6,
          escMid: esc >= 6 && esc < 10,
          escHigh: esc >= 10,
        };
      }));
    });
  }
}
