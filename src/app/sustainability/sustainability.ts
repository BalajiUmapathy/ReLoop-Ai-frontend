import { Component, inject, signal, OnInit } from '@angular/core';
import { catchError, of, forkJoin } from 'rxjs';
import { ApiService, DebugMatch } from '../core/api.service';

interface Card { icon: string; label: string; value: string; desc?: string; color: string; valClass: string; }

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

  agentCards = signal([
    { icon: '🎯', label: 'AGENT PRECISION (AVG)', value: '92.9%', valClass: 'green' },
    { icon: '⚠️', label: 'ESCALATION RATE (AVG)', value: '7.2%', valClass: 'amber' },
    { icon: '📊', label: 'DECISIONS THIS QUARTER', value: '32,330', valClass: 'dark' },
  ]);

  ngOnInit(): void {
    forkJoin({
      metrics: this.api.getDashboardMetrics().pipe(catchError(() => of(null))),
      feedback: this.api.getFeedbackSummary().pipe(catchError(() => of(null))),
      matches: this.api.getMatches().pipe(catchError(() => of(null))),
    }).subscribe(({ metrics, feedback, matches }) => {
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
      if (feedback && feedback.total > 0) {
        // AcceptRate is already a 0-100 percentage from the backend.
        this.patch(this.agentCards, 'AGENT PRECISION (AVG)', `${feedback.acceptRate.toFixed(1)}%`);
        const escalation = ((feedback.modified + feedback.rejected) / feedback.total) * 100;
        this.patch(this.agentCards, 'ESCALATION RATE (AVG)', `${escalation.toFixed(1)}%`);
        this.patch(this.agentCards, 'DECISIONS THIS QUARTER', feedback.total.toLocaleString());
      }
      const rows = matches?.data ?? [];
      if (rows.length) this.buildHubs(rows);
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
