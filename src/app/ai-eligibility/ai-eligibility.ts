import { Component, signal, computed, inject, effect } from '@angular/core';
import { catchError, of } from 'rxjs';
import { ApiService, DebugMatch } from '../core/api.service';

interface Product {
  name: string; shortName: string; icon: string; productId: string; returnId: string; category: string;
  condition: string; retailerPolicy: string; pickupDate: string;
  holdingDays: string; locationHub: string; eligible: boolean;
  confidence: number; decision: string;
  policies: string[]; explanations: string[];
  conditionScore: number; policyScore: number; categoryScore: number; demandPotential: number;
  hasRisk: boolean; riskFlags: string[];
  resaleProbability: number; saleWindow: string; revenueRecovery: string;
  logisticsSavings: string; profitImpact: string; co2Reduction: string;
  trends: { text: string; tag: string; tagGreen?: boolean }[];
  topProducts: { name: string; val: number }[];
  hubLeaderboard: { name: string; score: number; color: string }[];
}

@Component({
  selector: 'app-ai-eligibility',
  imports: [],
  templateUrl: './ai-eligibility.html',
  styleUrl: './ai-eligibility.css',
})
export class AiEligibilityComponent {
  activeIdx = signal(0);

  readonly fallback: Product[] = [
    {
      name: 'Wireless Earbuds (Pro 2nd Gen)', shortName: 'Wireless Earbuds', icon: '🎧',
      productId: 'RET-2025-001', returnId: 'RET-2025-001', category: 'Electronics', condition: 'Excellent',
      retailerPolicy: 'Local Resale Allowed', pickupDate: '2025-06-18',
      holdingDays: 'Day 3 of 10', locationHub: 'Chennai Central',
      eligible: true, confidence: 96, decision: 'Eligible for Local Resale',
      policies: ['RP-ELEC-3.0', 'RP-ELEC-3.1'],
      explanations: [
        'Product condition is excellent with no visible damage or functional issues.',
        'Retailer policy explicitly allows local resale within holding period.',
        'Category (Electronics) historically achieves 89% local resale conversion rate.',
      ],
      conditionScore: 98, policyScore: 100, categoryScore: 89, demandPotential: 92,
      hasRisk: false, riskFlags: [],
      resaleProbability: 92, saleWindow: '3 Days', revenueRecovery: '₹12,000',
      logisticsSavings: '₹1,800', profitImpact: '+₹13,900', co2Reduction: '5.2 KG',
      trends: [
        { text: 'Electronics produce the highest ROI across all product categories.', tag: 'Electronics' },
        { text: 'Bangalore and Chennai hubs deliver the strongest resale performance.', tag: 'Hubs' },
        { text: 'Local resale conversion increased 18% this quarter vs. prior.', tag: '+18% QoQ', tagGreen: true },
      ],
      topProducts: [
        { name: 'Wireless Earbuds Pro', val: 92 }, { name: 'Wireless Earbuds 3', val: 84 },
        { name: 'Studio Headset', val: 71 }, { name: 'ANC Buds X1', val: 63 }, { name: 'QuietBuds', val: 55 },
      ],
      hubLeaderboard: [
        { name: 'Chennai', score: 92, color: '#22C55E' }, { name: 'Bangalore', score: 88, color: '#22C55E' },
        { name: 'Mumbai', score: 81, color: '#22C55E' }, { name: 'Delhi', score: 74, color: '#F5A623' }, { name: 'Hyderabad', score: 69, color: '#F5A623' },
      ],
    },
    {
      name: 'ANC Over-Ear Headphones', shortName: 'ANC Headphones', icon: '🎧',
      productId: 'RET-2025-005', returnId: 'RET-2025-005', category: 'Electronics', condition: 'Excellent',
      retailerPolicy: 'Local Resale Allowed', pickupDate: '2025-06-21',
      holdingDays: 'Day 1 of 10', locationHub: 'Chennai South',
      eligible: true, confidence: 91, decision: 'Eligible for Local Resale',
      policies: ['RP-ELEC-3.0'],
      explanations: [
        'Premium audio product in excellent condition — high buyer demand.',
        'Retailer policy permits local resale with no restrictions.',
        'Demand Potential score of 88 indicates strong local market match.',
      ],
      conditionScore: 95, policyScore: 100, categoryScore: 85, demandPotential: 88,
      hasRisk: false, riskFlags: [],
      resaleProbability: 88, saleWindow: '4 Days', revenueRecovery: '₹10,900',
      logisticsSavings: '₹1,600', profitImpact: '+₹12,300', co2Reduction: '4.8 KG',
      trends: [
        { text: 'Premium audio products have 94% buyer satisfaction in local resale markets.', tag: 'Audio' },
        { text: 'Chennai South hub shows 31% increase in audio product demand.', tag: 'Hubs' },
        { text: 'Headphone category conversion rate rose 12% this month.', tag: '+12% MoM', tagGreen: true },
      ],
      topProducts: [
        { name: 'ANC Over-Ear X5', val: 89 }, { name: 'Wireless Earbuds Pro', val: 85 },
        { name: 'QuietComfort 45', val: 72 }, { name: 'Tune Wireless', val: 61 }, { name: 'Studio Pro', val: 54 },
      ],
      hubLeaderboard: [
        { name: 'Chennai', score: 91, color: '#22C55E' }, { name: 'Bangalore', score: 85, color: '#22C55E' },
        { name: 'Mumbai', score: 78, color: '#22C55E' }, { name: 'Delhi', score: 70, color: '#F5A623' }, { name: 'Hyderabad', score: 65, color: '#F5A623' },
      ],
    },
    {
      name: '65" QLED Smart TV', shortName: '65" QLED TV', icon: '📺',
      productId: 'RET-2025-003', returnId: 'RET-2025-003', category: 'Electronics', condition: 'Good',
      retailerPolicy: 'Local Resale Allowed', pickupDate: '2025-06-20',
      holdingDays: 'Day 1 of 10', locationHub: 'Mumbai West',
      eligible: true, confidence: 84, decision: 'Eligible for Local Resale',
      policies: ['RP-ELEC-3.0', 'RP-ELEC-3.2'],
      explanations: [
        'Large format TV in good condition — suitable for local resale.',
        'Policy allows local resale; logistics cost savings are significant.',
        'Mumbai hub has moderate demand for large electronics.',
      ],
      conditionScore: 78, policyScore: 95, categoryScore: 80, demandPotential: 75,
      hasRisk: true, riskFlags: ['Large item — logistics coordination required'],
      resaleProbability: 80, saleWindow: '5 Days', revenueRecovery: '₹16,400',
      logisticsSavings: '₹3,700', profitImpact: '+₹17,800', co2Reduction: '3.9 KG',
      trends: [
        { text: 'Large electronics require logistics coordination — plan 2 days ahead.', tag: 'Logistics' },
        { text: 'Mumbai hub TV demand peaks on weekends — optimal listing time.', tag: 'Mumbai' },
        { text: '65" TV segment shows 15% price premium for refurbished units.', tag: '+15%', tagGreen: true },
      ],
      topProducts: [
        { name: '65" QLED', val: 78 }, { name: '55" OLED', val: 71 },
        { name: '50" LED Pro', val: 65 }, { name: '50" 4K LED', val: 58 }, { name: '43" HD LED', val: 49 },
      ],
      hubLeaderboard: [
        { name: 'Mumbai', score: 88, color: '#22C55E' }, { name: 'Chennai', score: 84, color: '#22C55E' },
        { name: 'Bangalore', score: 80, color: '#22C55E' }, { name: 'Delhi', score: 72, color: '#F5A623' }, { name: 'Hyderabad', score: 66, color: '#F5A623' },
      ],
    },
  ];

  products = signal<Product[]>(this.fallback);

  product = computed(() => {
    const base = this.products()[this.activeIdx()] ?? this.fallback[0];
    const overlay = this.overlays().get(this.activeIdx());
    return overlay ? { ...base, ...overlay } : base;
  });

  /** True when the active product's numbers came from the live Match agent. */
  live = computed(() => this.overlays().has(this.activeIdx()));

  private api = inject(ApiService);
  private overlays = signal<Map<number, Partial<Product>>>(new Map());

  constructor() {
    // Replace seed data with real returned items from the database when available.
    this.api.getMatches().pipe(catchError(() => of(null))).subscribe((res) => {
      const rows = res?.data ?? [];
      if (!rows.length) return;
      const mapped = rows.slice(0, 6).map((m) => this.mapMatch(m));
      const top = [...rows].sort((a, b) => b.matchScore - a.matchScore).slice(0, 5)
        .map((m) => ({ name: this.short(m.productName, 16), val: Math.round(m.matchScore) }));
      const hubLeaderboard = this.buildHubLeaderboard(rows);
      const trends = this.buildTrends(rows);
      mapped.forEach((p) => { p.topProducts = top; p.hubLeaderboard = hubLeaderboard; p.trends = trends; });
      this.overlays.set(new Map());
      this.activeIdx.set(0);
      this.products.set(mapped);
    });

    // When the selected product changes, fetch a real agent verdict once.
    effect(() => {
      const idx = this.activeIdx();
      if (this.overlays().has(idx)) return;
      const p = this.products()[idx];
      if (!p) return;
      this.api
        .findMatch({
          productId: p.productId,
          productName: p.name,
          category: p.category,
          location: p.locationHub.split(' ')[0],
          condition: p.condition,
        })
        .pipe(catchError(() => of(null)))
        .subscribe((res) => {
          if (!res) return;
          const conf = res.confidence <= 1 ? res.confidence * 100 : res.confidence;
          const overlay: Partial<Product> = {
            confidence: Math.round(conf),
            resaleProbability: res.matchScore,
            demandPotential: res.matchScore,
            eligible: res.matchScore >= 60,
            decision: res.recommendation || p.decision,
            saleWindow: res.expectedDaysToSell ? `${res.expectedDaysToSell} Days` : p.saleWindow,
            logisticsSavings: `₹${Math.round(res.costSaved)}`,
            co2Reduction: `${res.co2Saved.toFixed(1)} KG`,
            // Quick match agent doesn't compute resale revenue / profit — only the full
            // pipeline does. Blank them in live mode instead of showing seed constants.
            revenueRecovery: '—',
            profitImpact: '—',
            explanations: [res.explanation, ...p.explanations].filter(Boolean).slice(0, 3),
          };
          this.overlays.update((m) => new Map(m).set(idx, overlay));
        });
    });
  }

  private short(s: string, n: number): string {
    return !s ? '' : s.length > n ? s.slice(0, n) + '…' : s;
  }

  private catIcon(cat: string): string {
    const c = (cat || '').toLowerCase();
    if (c.includes('electr')) return '🔌';
    if (c.includes('apparel') || c.includes('cloth') || c.includes('fashion')) return '👕';
    if (c.includes('home') || c.includes('kitchen')) return '🏠';
    if (c.includes('sport') || c.includes('fitness')) return '🏅';
    if (c.includes('book') || c.includes('media')) return '📚';
    if (c.includes('toy')) return '🧸';
    return '📦';
  }

  private condScore(cond: string): number {
    switch ((cond || '').toLowerCase()) {
      case 'excellent': return 96;
      case 'good': return 82;
      case 'fair': return 64;
      case 'poor': return 42;
      default: return 75;
    }
  }

  private buildHubLeaderboard(rows: DebugMatch[]) {
    const agg = new Map<string, { sum: number; n: number }>();
    for (const m of rows) {
      const city = (m.location || 'Unknown').split(/[ ,]/)[0];
      const a = agg.get(city) ?? { sum: 0, n: 0 };
      a.sum += m.matchScore; a.n += 1; agg.set(city, a);
    }
    return [...agg.entries()]
      .map(([name, a]) => ({ name, score: Math.round(a.sum / a.n) }))
      .sort((x, y) => y.score - x.score)
      .slice(0, 5)
      .map((h) => ({ ...h, color: h.score >= 80 ? '#22C55E' : '#F5A623' }));
  }

  private buildTrends(rows: DebugMatch[]) {
    const eligible = rows.filter((m) => m.matchScore >= 60).length;
    const pct = Math.round((eligible / rows.length) * 100);
    const catCount = new Map<string, number>();
    for (const m of rows) catCount.set(m.category, (catCount.get(m.category) ?? 0) + 1);
    const topCat = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Electronics';
    const hubs = new Set(rows.map((m) => (m.location || '').split(/[ ,]/)[0])).size;
    return [
      { text: `${rows.length} returns analysed across ${hubs} hubs in the current cycle.`, tag: 'Live' },
      { text: `${topCat} is the most-returned category this cycle.`, tag: 'Category' },
      { text: `${eligible} of ${rows.length} items cleared the local-resale threshold.`, tag: `${pct}%`, tagGreen: true },
    ];
  }

  private mapMatch(m: DebugMatch): Product {
    const conf = m.confidence <= 1 ? Math.round(m.confidence * 100) : Math.round(m.confidence);
    const eligible = m.matchScore >= 60;
    const cs = this.condScore(m.condition);
    const ageDays = Math.round((Date.now() - new Date(m.createdAt).getTime()) / 86400000);
    const days = Math.max(1, Math.min(10, isFinite(ageDays) && ageDays > 0 ? ageDays : 1));
    return {
      name: m.productName,
      shortName: this.short(m.productName, 16),
      icon: this.catIcon(m.category),
      productId: m.productId,
      returnId: m.returnRequestId ? m.returnRequestId.slice(0, 8).toUpperCase() : m.productId,
      category: m.category,
      condition: m.condition,
      retailerPolicy: eligible ? 'Local Resale Allowed' : 'Review Required',
      pickupDate: (m.createdAt || '').slice(0, 10),
      holdingDays: `Day ${days} of 10`,
      locationHub: m.location,
      eligible,
      confidence: conf,
      decision: eligible ? `Eligible — ${m.recommendation}` : `Review — ${m.recommendation}`,
      policies: [`RP-${(m.category || 'GEN').slice(0, 4).toUpperCase()}-3.0`],
      explanations: [
        `Condition "${m.condition}" scored ${cs}% on the resale-readiness model.`,
        `Match agent recommends ${m.recommendation} at a match score of ${Math.round(m.matchScore)}.`,
      ],
      conditionScore: cs,
      policyScore: eligible ? 100 : 70,
      categoryScore: Math.round(m.matchScore),
      demandPotential: Math.round(m.matchScore),
      hasRisk: cs < 65,
      riskFlags: cs < 65 ? ['Condition below resale threshold — manual check advised'] : [],
      resaleProbability: Math.round(m.matchScore),
      saleWindow: '—',
      revenueRecovery: `₹${Math.round(m.costSaved)}`,
      logisticsSavings: `₹${Math.round(m.costSaved)}`,
      profitImpact: `+₹${Math.round(m.costSaved)}`,
      co2Reduction: `${(m.co2Saved ?? 0).toFixed(1)} KG`,
      trends: [],
      topProducts: [],
      hubLeaderboard: [],
    };
  }
}
