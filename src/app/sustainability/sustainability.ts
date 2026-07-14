import { Component, inject, signal, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { catchError, of, forkJoin } from 'rxjs';
import { ApiService } from '../core/api.service';
import { EsgScoreService, EsgResult } from '../core/esg-score.service';
import { EsgBadgeComponent } from '../core/esg-badge/esg-badge';

interface Card { icon: string; label: string; value: string; desc?: string; color: string; valClass: string; }

interface HubRow { name: string; co2: string; score: number; barW: number; }

interface CatBar {
  label: string;
  shortLabel: string;
  color: string;
  height: number;  // SVG pixels (0–117)
  y: number;       // SVG y top coordinate
  x: number;       // SVG x left coordinate
  value: string;   // formatted revenue
}

@Component({
  selector: 'app-sustainability',
  imports: [EsgBadgeComponent, DecimalPipe],
  templateUrl: './sustainability.html',
  styleUrl: './sustainability.css',
})
export class SustainabilityComponent implements OnInit {
  private api = inject(ApiService);
  private esgService = inject(EsgScoreService);

  live = signal(false);

  /** Computed ESG result — starts with neutral defaults, updated on API load. */
  esgResult = signal<EsgResult>(this.esgService.calculate({
    diversionRate:   0,
    co2SavedKg:      0,
    distanceSavedKm: 0,
    costSaved:       0,
  }));

  finCards = signal<Card[]>([
    { icon: '💰', label: 'REVENUE RECOVERED', value: '₹1.2M', desc: 'From local resale operations', color: '#22C55E', valClass: 'green' },
    { icon: '🚚', label: 'COST AVOIDANCE', value: '₹487K', desc: 'Reverse logistics savings', color: '#F5A623', valClass: 'amber' },
    { icon: '📈', label: 'PROFIT IMPROVEMENT', value: '₹725K', desc: 'Net operational impact', color: '#1a0d06', valClass: 'dark' },
    { icon: '🎯', label: 'PROJECTED ANNUAL BENEFIT', value: '₹8.5M', desc: 'Based on current trajectory', color: '#6366F1', valClass: 'blue' },
    { icon: '🏆', label: 'RETURN ON INVESTMENT', value: '315%', desc: 'Platform ROI this year', color: '#22C55E', valClass: 'green' },
    { icon: '📦', label: 'INVENTORY AVAILABILITY GAIN', value: '42%', desc: 'Improvement vs. baseline', color: '#F5A623', valClass: 'amber' },
  ]);

  envCards = signal<Card[]>([
    { icon: '🌿', label: 'CO₂ REDUCED', value: '428 tons', color: '#22C55E', valClass: 'green' },
    { icon: '🗺️', label: 'DISTANCE SAVED', value: '125,000 km', color: '#6366F1', valClass: 'blue' },
    { icon: '⛽', label: 'FUEL SAVED', value: '16,500 L', color: '#F5A623', valClass: 'amber' },
    { icon: '🏢', label: 'WAREHOUSE COST AVOIDED', value: '₹1,75,000', color: '#1a0d06', valClass: 'dark' },
  ]);


  hubs = signal<HubRow[]>([
    { name: 'Chennai Hub',   co2: '14.2t', score: 94, barW: 100 },
    { name: 'Bangalore Hub', co2: '12.8t', score: 91, barW:  91 },
    { name: 'Mumbai Hub',    co2: '9.1t',  score: 86, barW:  86 },
    { name: 'Delhi Hub',     co2: '5.4t',  score: 79, barW:  79 },
    { name: 'Hyderabad Hub', co2: '1.3t',  score: 71, barW:  71 },
  ]);

  /** Revenue recovery bars per category (driven by live match data). */
  catBars   = signal<CatBar[]>([]);
  catYMax   = signal(600);

  agentCards = signal([
    { icon: '🎯', label: 'AGENT PRECISION (AVG)', value: '92.9%', valClass: 'green' },
    { icon: '⚠️', label: 'ESCALATION RATE (AVG)', value: '7.2%', valClass: 'amber' },
    { icon: '📊', label: 'DECISIONS THIS QUARTER', value: '32,330', valClass: 'dark' },
    { icon: '📈', label: 'MODEL ACCURACY TREND', value: '+4.1%', valClass: 'green' },
  ]);

  ngOnInit(): void {
    forkJoin({
      metrics: this.api.getDashboardMetrics().pipe(catchError(() => of(null))),
      feedback: this.api.getFeedbackSummary().pipe(catchError(() => of(null))),
    }).subscribe(({ metrics, feedback }) => {
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

        // Compute ESG result from all four live metrics.
        this.esgResult.set(this.esgService.calculate({
          diversionRate:   metrics.diversionRate,
          co2SavedKg:      metrics.co2SavedKg,
          distanceSavedKm: metrics.distanceSavedKm,
          costSaved:       metrics.costSaved,
        }));
      }
      if (feedback && feedback.total > 0) {
        this.patch(this.agentCards, 'AGENT PRECISION (AVG)', `${(feedback.acceptRate * 100).toFixed(1)}%`);
        const escalation = feedback.total > 0 ? ((feedback.modified + feedback.rejected) / feedback.total) * 100 : 0;
        this.patch(this.agentCards, 'ESCALATION RATE (AVG)', `${escalation.toFixed(1)}%`);
        this.patch(this.agentCards, 'DECISIONS THIS QUARTER', feedback.total.toLocaleString());
      }
    });

    this.loadMatchData();
  }

  /** Compute hub leaderboard + category revenue chart from live match data. */
  private loadMatchData(): void {
    this.api.getMatches().pipe(catchError(() => of(null))).subscribe((res) => {
      const rows = res?.data ?? [];
      if (!rows.length) return;

      // ---- Hub leaderboard ----
      const hubMap: Record<string, string> = {
        Chennai: 'Chennai Hub', Bangalore: 'Bangalore Hub',
        Mumbai: 'Mumbai Hub', Delhi: 'Delhi Hub', Hyderabad: 'Hyderabad Hub',
      };
      const hubTotals = new Map<string, { co2: number; matches: number; total: number }>();

      for (const m of rows) {
        const city   = (m.location || '').split(/[ ,]/)[0];
        const hub    = hubMap[city];
        if (!hub) continue;
        const entry  = hubTotals.get(hub) ?? { co2: 0, matches: 0, total: 0 };
        entry.co2   += m.co2Saved;
        entry.total++;
        if (m.matchScore >= 60) entry.matches++;
        hubTotals.set(hub, entry);
      }

      const hubOrder = ['Chennai Hub', 'Bangalore Hub', 'Mumbai Hub', 'Delhi Hub', 'Hyderabad Hub'];
      const hubList = hubOrder
        .map(name => {
          const e     = hubTotals.get(name) ?? { co2: 0, matches: 0, total: 1 };
          const score = e.total > 0 ? Math.round((e.matches / e.total) * 100) : 70;
          const co2Fmt = e.co2 >= 1000
            ? `${(e.co2 / 1000).toFixed(1)}t`
            : `${e.co2.toFixed(1)} kg`;
          return { name, co2: co2Fmt, score, barW: score };
        })
        .sort((a, b) => b.score - a.score);

      if (hubList.length) this.hubs.set(hubList);

      // ---- Revenue by Category bars ----
      const catConfig = [
        { label: 'Electronics', short: 'Elec', color: '#1a0d06', x: 40 },
        { label: 'Apparel',     short: 'App',  color: '#F5A623', x: 80 },
        { label: 'Home',        short: 'Home', color: '#22C55E', x: 120 },
        { label: 'Sports',      short: 'Sprt', color: '#6366F1', x: 160 },
        { label: 'Books',       short: 'Bks',  color: '#92400E', x: 200 },
      ];
      const catRevenue = new Map<string, number>();
      for (const m of rows) {
        const key = catConfig.find(c => c.label.toLowerCase() === (m.category ?? '').toLowerCase())?.label;
        if (key) catRevenue.set(key, (catRevenue.get(key) ?? 0) + m.costSaved);
      }
      const maxRev  = Math.max(...catConfig.map(c => catRevenue.get(c.label) ?? 0), 1);
      const yMax    = Math.ceil(maxRev / 100) * 100 || 600;
      this.catYMax.set(yMax);
      this.catBars.set(catConfig.map(c => {
        const val = catRevenue.get(c.label) ?? 0;
        const h   = Math.max(2, Math.round((val / yMax) * 117));
        return { label: c.label, shortLabel: c.short, color: c.color, x: c.x, height: h, y: 130 - h, value: this.money(val) };
      }));
    });
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
