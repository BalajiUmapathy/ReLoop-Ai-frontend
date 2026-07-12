import { Component, inject, signal, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { catchError, of, forkJoin } from 'rxjs';
import { ApiService, ReturnCluster, ClusterReturnItem, DashboardMetrics } from '../core/api.service';

interface MetricCard {
  label: string; value: string; description: string;
  change: string; icon: string; borderColor: string;
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

  regions = [
    { label: 'Chennai', dark: 3800, gold: 2700 },
    { label: 'Bangalore', dark: 2800, gold: 2600 },
    { label: 'Mumbai', dark: 2600, gold: 2100 },
    { label: 'Delhi', dark: 2100, gold: 1900 },
    { label: 'Hyderabad', dark: 1600, gold: 1100 },
  ];

  revLocations = [
    { name: 'Chennai Hub', val: '₹312K', pct: 100 },
    { name: 'Bangalore Hub', val: '₹284K', pct: 91 },
    { name: 'Mumbai Hub', val: '₹231K', pct: 74 },
    { name: 'Delhi Hub', val: '₹197K', pct: 63 },
    { name: 'Hyderabad Hub', val: '₹143K', pct: 46 },
  ];

  agents = [
    { name: 'Eligibility Agent', decisions: '8,920', precision: '94.2%', escalation: '5.8% escalated', escLow: true, escMid: false, escHigh: false },
    { name: 'Demand Match Agent', decisions: '7,840', precision: '91.7%', escalation: '8.3% escalated', escLow: false, escMid: true, escHigh: false },
    { name: 'Pricing Agent', decisions: '3,120', precision: '88.4%', escalation: '11.6% escalated', escLow: false, escMid: false, escHigh: true },
    { name: 'Carbon Agent', decisions: '12,450', precision: '97.1%', escalation: '2.9% escalated', escLow: true, escMid: false, escHigh: false },
  ];

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
}
