import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { catchError, of } from 'rxjs';
import { ApiService, SegmentAnalytics } from '../core/api.service';

interface RetailerData {
  name: string;
  icon: string;
  tagline: string;
  totalReturns: number;
  itemsResold: number;
  revenueRecovered: string;
  returnRate: string;
  co2Reduced: string;
  milesSaved: string;
  policies: { category: string; condition: string; conditionClass: string; policyId: string }[];
  tickets: { cause: string; sku: string; share: string; savings: string; status: string; statusClass: string }[];
  trendData: number[];
  trendLabels: string[];
  topSkus: { product: string; reason: string; volume: number; fix: string }[];
  esg: { label: string; value: string; icon: string; color: string }[];
}

@Component({
  selector: 'app-retailer-portal',
  imports: [],
  templateUrl: './retailer-portal.html',
  styleUrl: './retailer-portal.css',
})
export class RetailerPortalComponent implements OnInit {
  private api = inject(ApiService);

  /** True once real segment analytics have replaced the offline fallback. */
  live = signal(false);
  activeRetailer = signal('Electronics');
  retailers = signal<string[]>(['Electronics']);

  data = signal<Record<string, RetailerData>>({
    Electronics: this.fallback('Electronics'),
  });

  ngOnInit(): void {
    this.api
      .getSegments()
      .pipe(catchError(() => of([] as SegmentAnalytics[])))
      .subscribe((segments) => {
        if (!segments?.length) return;
        const map: Record<string, RetailerData> = {};
        for (const s of segments) map[s.segment] = this.fromSegment(s);
        this.data.set(map);
        this.retailers.set(segments.map((s) => s.segment));
        this.activeRetailer.set(segments[0].segment);
        this.live.set(true);
      });
  }

  private fromSegment(s: SegmentAnalytics): RetailerData {
    const statuses: [string, string][] = [
      ['Pending Review', 'st-pending'],
      ['In Progress', 'st-progress'],
    ];
    return {
      name: s.segment,
      icon: this.iconFor(s.segment),
      tagline: `AI-powered local resale · ${s.segment} partner network`,
      totalReturns: s.totalReturns,
      itemsResold: s.itemsResold,
      revenueRecovered: this.inr(s.revenueRecovered),
      returnRate: `${s.diversionRate}%`,
      co2Reduced: `${s.co2SavedKg.toLocaleString('en-IN')} kg`,
      milesSaved: `${s.distanceSavedKm.toLocaleString('en-IN')} km`,
      policies: [
        {
          category: s.segment,
          condition: this.conditionFloor(s.segment),
          conditionClass: this.condClass(s.segment),
          policyId: `RP-${s.segment.slice(0, 4).toUpperCase()}-1.0`,
        },
      ],
      tickets: s.topReasons.slice(0, 3).map((r, i) => ({
        cause: r.reason,
        sku: `${s.segment.slice(0, 4).toUpperCase()}-${(r.topLocation || 'IN').slice(0, 3).toUpperCase()}`,
        share: `${r.share}%`,
        savings: this.inr(r.estimatedAnnualImpact),
        status: statuses[i % statuses.length][0],
        statusClass: statuses[i % statuses.length][1],
      })),
      trendData: s.trend.length ? s.trend.map((t) => t.count) : [s.totalReturns],
      trendLabels: s.trend.length ? s.trend.map((t) => t.label) : ['Now'],
      topSkus: s.topReasons.slice(0, 4).map((r) => ({
        product: `${s.segment} · ${r.topLocation}`,
        reason: r.reason,
        volume: r.count,
        fix: this.fixFor(r.reason),
      })),
      esg: [
        { label: 'CO₂ REDUCED', value: `${s.co2SavedKg.toLocaleString('en-IN')} kg`, icon: '🌿', color: '#16A34A' },
        { label: 'DISTANCE SAVED', value: `${s.distanceSavedKm.toLocaleString('en-IN')} KM`, icon: '🗺️', color: '#2563EB' },
        { label: 'REVENUE RECOVERED', value: this.inr(s.revenueRecovered), icon: '💰', color: '#D97706' },
        { label: 'ITEMS DIVERTED FROM WAREHOUSE', value: s.itemsResold.toLocaleString('en-IN'), icon: '📦', color: '#92400E' },
      ],
    };
  }

  private fallback(segment: string): RetailerData {
    return {
      name: segment, icon: this.iconFor(segment),
      tagline: `AI-powered local resale · ${segment}`,
      totalReturns: 0, itemsResold: 0, revenueRecovered: '₹0', returnRate: '0%',
      co2Reduced: '0 kg', milesSaved: '0 km',
      policies: [{ category: segment, condition: 'Good', conditionClass: 'cond-good', policyId: 'RP-000-0.0' }],
      tickets: [], trendData: [0], trendLabels: ['—'], topSkus: [],
      esg: [],
    };
  }

  private inr(v: number): string {
    if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
    if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
    return `₹${Math.round(v).toLocaleString('en-IN')}`;
  }

  private iconFor(segment: string): string {
    const m: Record<string, string> = {
      Electronics: '📱', Apparel: '👕', Footwear: '👟', Accessories: '🎒',
      Home: '🏠', Beauty: '💄', Toys: '🧸', Sports: '⚽',
    };
    return m[segment] ?? '🏷️';
  }

  private conditionFloor(segment: string): string {
    const strict = ['Electronics', 'Beauty'];
    return strict.includes(segment) ? 'Excellent' : 'Good';
  }
  private condClass(segment: string): string {
    return this.conditionFloor(segment) === 'Excellent' ? 'cond-excellent' : 'cond-good';
  }

  private fixFor(reason: string): string {
    const r = (reason || '').toLowerCase();
    if (r.includes('size') || r.includes('small') || r.includes('fit')) return 'Update size guide';
    if (r.includes('defect') || r.includes('damaged')) return 'QA supplier batch';
    if (r.includes('wrong') || r.includes('described')) return 'Fix product listing';
    if (r.includes('changed')) return 'Add fit visualiser';
    return 'Review listing';
  }

  current = computed(() => this.data()[this.activeRetailer()] ?? this.fallback(this.activeRetailer()));

  xLabels = computed(() => this.current().trendLabels);

  chartPath = computed(() => {
    const d = this.current().trendData;
    const w = 540, h = 180, pad = 30;
    const min = Math.min(...d) - 50, max = Math.max(...d) + 50;
    const x = (i: number) => pad + (i / Math.max(d.length - 1, 1)) * (w - pad * 2);
    const y = (v: number) => h - pad - ((v - min) / Math.max(max - min, 1)) * (h - pad * 2);
    const path = d.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const area = path + ` L${x(d.length - 1).toFixed(1)},${(h - pad)} L${x(0).toFixed(1)},${(h - pad)} Z`;
    return { path, area, points: d.map((v, i) => ({ x: x(i), y: y(v) })), w, h, min, max, pad };
  });

  yLabels = computed(() => {
    const { min, max, h, pad } = this.chartPath();
    return [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      val: Math.round(min + t * (max - min)),
      y: h - pad - t * (h - pad * 2),
    }));
  });
}
