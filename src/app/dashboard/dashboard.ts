import { Component, inject, signal, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { catchError, of, forkJoin } from 'rxjs';
import {
  ApiService,
  ReturnCluster,
  DashboardMetrics,
  SegmentAnalytics,
  LocationAnalytics,
  FeedbackSummary,
} from '../core/api.service';

interface MetricCard {
  label: string; value: string; description: string;
  change: string; icon: string; borderColor: string;
}
interface DonutSeg { label: string; color: string; dash: string; offset: number; share: number; }
interface BarItem { label: string; value: number; pct: number; }
interface RevItem { name: string; val: string; pct: number; }
interface TrendPoint { x: number; y: number; }

const DONUT_C = 2 * Math.PI * 45; // circumference of the r=45 donut

@Component({
  selector: 'app-dashboard',
  imports: [DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  private palette = ['#1a0d06', '#22C55E', '#F5A623', '#6366F1', '#9CA3AF', '#92400E', '#EC4899', '#14B8A6', '#A855F7', '#F97316'];

  /** True once real metrics have been merged in from the backend. */
  live = signal(false);
  diversionRate = signal('—');
  diversionProgress = signal(0);
  diversionGap = signal('—');
  heroRevenue = signal('₹—');
  heroBreakdown = signal<{ label: string; value: string }[]>([]);

  // Every card below is backed by a real backend figure once `live` is true.
  metrics = signal<MetricCard[]>([
    { label: 'TOTAL RETURNS', value: '—', description: 'Processed to date', change: '', icon: '📦', borderColor: '#F97316' },
    { label: 'ELIGIBLE FOR RESALE', value: '—', description: 'Passed the resale gate', change: '', icon: '✅', borderColor: '#EAB308' },
    { label: 'ITEMS MATCHED LOCALLY', value: '—', description: 'Diverted from warehouse', change: '', icon: '🔗', borderColor: '#A855F7' },
    { label: 'COST AVOIDANCE', value: '—', description: 'Reverse-freight avoided', change: '', icon: '🚚', borderColor: '#EAB308' },
    { label: 'VALUE / ITEM', value: '—', description: 'Recovered per diverted item', change: '', icon: '💰', borderColor: '#22C55E' },
    { label: 'CO₂ REDUCED', value: '—', description: 'Emissions avoided', change: '', icon: '🌿', borderColor: '#86EFAC' },
    { label: 'DISTANCE SAVED', value: '—', description: 'Return kilometres avoided', change: '', icon: '🗺️', borderColor: '#6366F1' },
    { label: 'AVG MATCH SCORE', value: '—', description: 'Across matched items', change: '', icon: '📊', borderColor: '#14B8A6' },
    { label: 'AVG AI CONFIDENCE', value: '—', description: 'Decision certainty', change: '', icon: '🤖', borderColor: '#EC4899' },
    { label: 'AVG DAYS TO SELL', value: '—', description: 'Inside the 10-day window', change: '', icon: '⏱️', borderColor: '#0EA5E9' },
  ]);

  // ---- Charts (all populated live) ----
  categoryDonut = signal<DonutSeg[]>([]);
  regionBars = signal<BarItem[]>([]);
  revLocations = signal<RevItem[]>([]);
  segScores = signal<BarItem[]>([]);
  volumePoly = signal('');
  volumeMonths = signal<{ x: number; label: string }[]>([]);
  volumeMax = signal(0);
  chartsLive = signal(false);

  // ---- AI decision quality (human-in-the-loop) ----
  decisionQuality = signal<{ accepted: number; modified: number; rejected: number; total: number; acceptRate: number; avgConfidence: number } | null>(null);

  // Root-cause clusters (Reduce pillar) — derived live from segment analytics.
  rootCausesLive = signal(false);
  rootCauses = signal<ReturnCluster[]>([]);

  insIcon = ['⚡', '📊', '📈', '💻'];
  insIconClass = ['amber', 'blue', 'purple', 'teal'];
  aiInsights = signal<string[]>(['Connecting to the ReLoop decision engine…']);
  private lastMetrics: DashboardMetrics | null = null;

  ngOnInit(): void {
    this.api
      .getDashboardMetrics()
      .pipe(catchError(() => of(null)))
      .subscribe((m) => {
        if (!m) return; // backend offline — keep placeholders
        this.live.set(true);
        this.applyMetrics(m);
        this.lastMetrics = m;
        this.buildInsights(m);
      });

    this.loadCharts();
  }

  /** Patch the KPI grid from the /dashboard/metrics payload. */
  private applyMetrics(m: DashboardMetrics): void {
    const eligibilityRate = m.totalReturns > 0 ? (m.eligibleReturns / m.totalReturns) * 100 : 0;
    const div = m.diversionRate <= 1 ? m.diversionRate * 100 : m.diversionRate;
    this.diversionRate.set(`${div.toFixed(1)}%`);
    this.diversionProgress.set(Math.min(100, (div / 85) * 100));
    this.diversionGap.set(`${Math.max(0, 85 - div).toFixed(1)} pts to target`);
    // Hero = full triple-value recovered (freight + resale margin + service fee + CO2 - AI cost).
    // Falls back to freight-only if the older payload has no NetValue.
    const totalValue = m.totalValueRecovered && m.totalValueRecovered > 0 ? m.totalValueRecovered : m.costSaved;
    this.heroRevenue.set(this.money(totalValue));
    this.heroBreakdown.set([
      { label: 'Freight avoided', value: this.money(m.costSaved) },
      { label: 'Resale margin', value: this.money(m.resaleMargin ?? 0) },
      { label: 'Service fee', value: this.money(m.resaleServiceFee ?? 0) },
      { label: 'CO₂ value', value: this.money(m.co2Value ?? 0) },
      { label: 'AI cost', value: `−${this.money(m.aiCost ?? 0)}` },
    ]);

    const valuePerItem = m.localMatches > 0 ? totalValue / m.localMatches : 0;
    this.patch('TOTAL RETURNS', this.compact(m.totalReturns), 'Processed to date');
    this.patch('ELIGIBLE FOR RESALE', this.compact(m.eligibleReturns), `${eligibilityRate.toFixed(1)}% of all returns`);
    this.patch('ITEMS MATCHED LOCALLY', this.compact(m.localMatches), 'Diverted from warehouse');
    this.patch('COST AVOIDANCE', this.money(m.costSaved), 'Reverse-freight avoided');
    this.patch('VALUE / ITEM', this.money(valuePerItem), 'Net value per diverted item');
    this.patch('CO₂ REDUCED', this.co2(m.co2SavedKg), 'Emissions avoided');
    this.patch('DISTANCE SAVED', `${this.compact(m.distanceSavedKm)} km`, 'Return kilometres avoided');
  }

  /** Segments + match rows + feedback drive every chart and the two AI-quality cards. */
  private loadCharts(): void {
    forkJoin({
      segments: this.api.getSegments().pipe(catchError(() => of<SegmentAnalytics[]>([]))),
      locations: this.api.getLocations().pipe(catchError(() => of<LocationAnalytics[]>([]))),
      feedback: this.api.getFeedbackSummary().pipe(catchError(() => of<FeedbackSummary | null>(null))),
    }).subscribe(({ segments, locations, feedback }) => {
      if (segments.length) {
        this.buildDonut(segments);
        this.buildSegScores(segments);
        this.buildVolumeTrend(segments);
        this.applyAvgFromSegments(segments);
        this.buildRootCauses(segments);
      }
      if (locations.length) {
        this.buildRegions(locations);
        this.buildRevLocations(locations);
      }
      if (segments.length || locations.length) this.chartsLive.set(true);
      if (feedback) this.buildDecisionQuality(feedback, segments);
    });
  }

  /** Weighted avg match score + confidence across segments → two KPI cards. */
  private applyAvgFromSegments(segs: SegmentAnalytics[]): void {
    const totalReturns = segs.reduce((s, x) => s + x.totalReturns, 0);
    if (totalReturns === 0) return;
    const wScore = segs.reduce((s, x) => s + x.avgMatchScore * x.totalReturns, 0) / totalReturns;
    const wConf = segs.reduce((s, x) => s + x.avgConfidence * x.totalReturns, 0) / totalReturns;
    const wDays = segs.reduce((s, x) => s + x.avgDaysToSell * x.totalReturns, 0) / totalReturns;
    const confPct = wConf <= 1 ? wConf * 100 : wConf;
    this.patch('AVG MATCH SCORE', `${wScore.toFixed(0)}`, 'Across matched items (0–100)');
    this.patch('AVG AI CONFIDENCE', `${confPct.toFixed(0)}%`, 'Decision certainty');
    this.patch('AVG DAYS TO SELL', `${wDays.toFixed(1)}d`, 'Inside the 10-day window');
  }

  private buildDonut(segs: SegmentAnalytics[]): void {
    const ordered = [...segs].sort((a, b) => b.totalReturns - a.totalReturns);
    const total = ordered.reduce((s, x) => s + x.totalReturns, 0) || 1;
    let cum = 0;
    const out: DonutSeg[] = ordered.map((s, i) => {
      const share = (s.totalReturns / total) * 100;
      const len = (share / 100) * DONUT_C;
      const seg: DonutSeg = {
        label: s.segment,
        color: this.palette[i % this.palette.length],
        dash: `${len.toFixed(1)} ${(DONUT_C - len).toFixed(1)}`,
        offset: -((cum / 100) * DONUT_C),
        share,
      };
      cum += share;
      return seg;
    });
    this.categoryDonut.set(out);
  }

  private buildSegScores(segs: SegmentAnalytics[]): void {
    const top = [...segs].sort((a, b) => b.avgMatchScore - a.avgMatchScore).slice(0, 6);
    this.segScores.set(top.map((s) => ({ label: s.segment, value: s.avgMatchScore, pct: Math.min(100, s.avgMatchScore) })));
  }

  private buildVolumeTrend(segs: SegmentAnalytics[]): void {
    const order = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const counts = new Map<string, number>();
    for (const s of segs) for (const p of s.trend) counts.set(p.label, (counts.get(p.label) ?? 0) + p.count);
    const labels = [...counts.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b)).slice(-6);
    if (labels.length < 2) { this.volumePoly.set(''); return; }
    const max = Math.max(...labels.map((l) => counts.get(l) ?? 0)) || 1;
    const x0 = 20, x1 = 258, y0 = 18, y1 = 140;
    const pts: TrendPoint[] = labels.map((l, i) => ({
      x: x0 + (i * (x1 - x0)) / (labels.length - 1),
      y: y1 - ((counts.get(l) ?? 0) / max) * (y1 - y0),
    }));
    this.volumePoly.set(pts.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' '));
    this.volumeMonths.set(pts.map((p, i) => ({ x: p.x, label: labels[i] })));
    this.volumeMax.set(max);
  }

  /** Returns by Region = pure VOLUME (count of diverted items per location). */
  private buildRegions(locs: LocationAnalytics[]): void {
    const sorted = [...locs].sort((a, b) => b.returns - a.returns).slice(0, 6);
    const max = Math.max(...sorted.map((s) => s.returns), 1);
    this.regionBars.set(sorted.map((l) => ({ label: l.location, value: l.returns, pct: (l.returns / max) * 100 })));
  }

  /** Top Cost-Recovery = VALUE (INR recovered per location) — a different ranking to volume. */
  private buildRevLocations(locs: LocationAnalytics[]): void {
    const sorted = [...locs].sort((a, b) => b.costRecovered - a.costRecovered).slice(0, 5);
    const max = Math.max(...sorted.map((s) => s.costRecovered), 1);
    this.revLocations.set(sorted.map((l) => ({ name: l.location, val: this.money(l.costRecovered), pct: (l.costRecovered / max) * 100 })));
  }

  private buildDecisionQuality(f: FeedbackSummary, segs: SegmentAnalytics[]): void {
    const totalReturns = segs.reduce((s, x) => s + x.totalReturns, 0);
    const wConf = totalReturns > 0
      ? segs.reduce((s, x) => s + x.avgConfidence * x.totalReturns, 0) / totalReturns
      : 0;
    this.decisionQuality.set({
      accepted: f.accepted,
      modified: f.modified,
      rejected: f.rejected,
      total: f.total,
      acceptRate: f.acceptRate,
      avgConfidence: (wConf <= 1 ? wConf * 100 : wConf),
    });
  }

  /** Derive the top systemic return drivers from live segment analytics — one priced fix-ticket per category. */
  private buildRootCauses(segs: SegmentAnalytics[]): void {
    const clusters: ReturnCluster[] = segs
      .filter((s) => s.topReasons?.length)
      .map((s) => {
        const r = s.topReasons[0];
        return {
          category: s.segment,
          dominantReason: r.reason,
          count: r.count,
          percentage: Math.round(r.share <= 1 ? r.share * 100 : r.share),
          topLocation: r.topLocation,
          estimatedAnnualImpact: r.estimatedAnnualImpact,
          fixTicket: `Fix at source → alert ${r.topLocation} retailer`,
        } as ReturnCluster;
      })
      .sort((a, b) => b.estimatedAnnualImpact - a.estimatedAnnualImpact)
      .slice(0, 3);

    if (clusters.length) {
      this.rootCauses.set(clusters);
      this.rootCausesLive.set(true);
      if (this.lastMetrics) this.buildInsights(this.lastMetrics);
    }
  }

  /** Build the AI Insights list from live metrics and clusters. */
  private buildInsights(m: DashboardMetrics): void {
    const div = m.diversionRate <= 1 ? m.diversionRate * 100 : m.diversionRate;
    const top = this.rootCauses()[0];
    const out = [
      `Diversion rate is ${div.toFixed(1)}% — ${Math.max(0, 85 - div).toFixed(1)} points from the 85% target.`,
      `${this.compact(m.localMatches)} returns matched locally, avoiding ${this.money(m.costSaved)} in reverse freight.`,
      `${this.co2(m.co2SavedKg)} of CO₂ avoided by keeping returned items in-market.`,
      top
        ? `Top systemic driver: ${top.category} — "${top.dominantReason}" (${top.percentage}% of that segment).`
        : `${this.compact(m.eligibleReturns)} items cleared the resale-eligibility gate.`,
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
    if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(2)} Cr`;
    if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
    if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
    return `₹${Math.round(v)}`;
  }

  private co2(kg: number): string {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}T`;
    return `${Math.round(kg)} kg`;
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
}
