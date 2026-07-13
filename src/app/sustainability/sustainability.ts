import { Component, inject, signal, OnInit } from '@angular/core';
import { catchError, of, forkJoin } from 'rxjs';
import { ApiService } from '../core/api.service';

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
  esgScore = signal('A+');
  esgLabel = signal('Excellent');

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


  hubs = [
    { name: 'Chennai Hub', co2: '14.2t', score: 94, barW: 100 },
    { name: 'Bangalore Hub', co2: '12.8t', score: 91, barW: 91 },
    { name: 'Mumbai Hub', co2: '9.1t', score: 86, barW: 86 },
    { name: 'Delhi Hub', co2: '5.4t', score: 79, barW: 79 },
    { name: 'Hyderabad Hub', co2: '1.3t', score: 71, barW: 71 },
  ];

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

        // Compute dynamic ESG grade from diversion rate + co2.
        this.esgScore.set(this.computeEsgGrade(metrics.diversionRate, metrics.co2SavedKg));
      }
      if (feedback && feedback.total > 0) {
        this.patch(this.agentCards, 'AGENT PRECISION (AVG)', `${(feedback.acceptRate * 100).toFixed(1)}%`);
        const escalation = feedback.total > 0 ? ((feedback.modified + feedback.rejected) / feedback.total) * 100 : 0;
        this.patch(this.agentCards, 'ESCALATION RATE (AVG)', `${escalation.toFixed(1)}%`);
        this.patch(this.agentCards, 'DECISIONS THIS QUARTER', feedback.total.toLocaleString());
      }
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

  /** Compute ESG grade from live metrics. Diversion rate and CO₂ savings drive the score. */
  private computeEsgGrade(diversionRate: number, co2SavedKg: number): string {
    const div = diversionRate <= 1 ? diversionRate * 100 : diversionRate;
    // Weighted score: 60% diversion rate (out of 100), 40% CO₂ impact (normalized to 500kg = 100 points).
    const co2Score = Math.min(100, (co2SavedKg / 500) * 100);
    const total = div * 0.6 + co2Score * 0.4;
    if (total >= 90) { this.esgLabel.set('Excellent'); return 'A+'; }
    if (total >= 80) { this.esgLabel.set('Very Good'); return 'A'; }
    if (total >= 70) { this.esgLabel.set('Good'); return 'B+'; }
    if (total >= 60) { this.esgLabel.set('Satisfactory'); return 'B'; }
    this.esgLabel.set('Needs Improvement'); return 'C';
  }
}
