import { Injectable, signal, inject } from '@angular/core';
import { catchError, of, forkJoin } from 'rxjs';
import { ApiService, DebugMatch, DebugInventory } from './core/api.service';

/**
 * Real local sort-hubs per metro. A city hub fans out to several neighbourhood
 * sort centres, so a Chennai return actually sits in Porur/Velachery/etc.
 * Kept in sync with the backend ResolveSubHub map in DebugController.
 */
const SUB_HUBS: Record<string, string[]> = {
  Chennai: ['Porur', 'Velachery', 'Guindy', 'Ambattur', 'Tambaram', 'Anna Nagar'],
  Bangalore: ['Whitefield', 'Koramangala', 'Electronic City', 'Hebbal', 'Jayanagar', 'Marathahalli'],
  Bengaluru: ['Whitefield', 'Koramangala', 'Electronic City', 'Hebbal', 'Jayanagar', 'Marathahalli'],
  Mumbai: ['Andheri', 'Bhiwandi', 'Powai', 'Vashi', 'Thane', 'Borivali'],
  Delhi: ['Okhla', 'Gurgaon', 'Noida', 'Dwarka', 'Rohini', 'Narela'],
  Hyderabad: ['Gachibowli', 'Uppal', 'Kondapur', 'Shamshabad', 'Kukatpally'],
  Pune: ['Hinjewadi', 'Kharadi', 'Wakad', 'Chakan', 'Hadapsar'],
  Kolkata: ['Salt Lake', 'Howrah', 'Behala', 'Dum Dum', 'Rajarhat'],
};
const DEFAULT_SUB_HUBS = ['Central', 'North', 'South', 'East', 'West'];

/** Deterministic neighbourhood sort-hub for a city + stable key, e.g. "Porur". */
export function subHubFor(location: string | undefined, key: string): string {
  const city = (location || 'Chennai').trim();
  const pool = SUB_HUBS[city] ?? DEFAULT_SUB_HUBS;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return pool[Math.abs(hash) % pool.length];
}

export interface ReturnItem {
  id: string;
  product: string;
  category: string;
  condition: string;
  locationHub: string;
  subHub: string;
  pickupDate: string;
  retailer: string;
  returnDate: string;
  holdDays: number;
  demandScore: number;
  riskScore: number;
  avgMarkdown: string;
  marginRetained: string;
  status: string;
  // Diversion / dynamic-pricing agent output (present on live rows).
  diversionAction?: string;
  basePrice?: number;
  suggestedPrice?: number;
  priceAdjustmentPct?: number;
  searchRadiusKm?: number;
  clearanceRisk?: number;
  sellProbability?: number;
  daysRemaining?: number;
  diversionReasoning?: string;
}

@Injectable({ providedIn: 'root' })
export class ReturnService {
  private _returns = signal<ReturnItem[]>([
    { id: 'RET-2025-009', product: 'Mirrorless Camera Kit', category: 'Electronics', condition: 'Fair', locationHub: 'Delhi', subHub: 'Okhla', pickupDate: '2025-06-08', retailer: 'PhotoPro', returnDate: '2025-06-08', holdDays: 13, demandScore: 38, riskScore: 82, avgMarkdown: '22%', marginRetained: '32%', status: 'Rejected' },
    { id: 'RET-2025-004', product: 'Multi-Cooker 7-in-1', category: 'Home', condition: 'Fair', locationHub: 'Delhi', subHub: 'Gurgaon', pickupDate: '2025-06-10', retailer: 'HomeMart', returnDate: '2025-06-10', holdDays: 11, demandScore: 45, riskScore: 72, avgMarkdown: '18%', marginRetained: '41%', status: 'ReturnToSeller' },
    { id: 'RET-2025-011', product: 'Gas BBQ Grill', category: 'Home', condition: 'Good', locationHub: 'Bangalore', subHub: 'Whitefield', pickupDate: '2025-06-19', retailer: 'HomeMart', returnDate: '2025-06-19', holdDays: 9, demandScore: 61, riskScore: 25, avgMarkdown: '15%', marginRetained: '55%', status: 'Diverted' },
    { id: 'RET-2025-008', product: 'Running Shoes (Boost)', category: 'Apparel', condition: 'Good', locationHub: 'Mumbai', subHub: 'Andheri', pickupDate: '2025-06-12', retailer: 'SportsHub', returnDate: '2025-06-12', holdDays: 8, demandScore: 55, riskScore: 45, avgMarkdown: '12%', marginRetained: '58%', status: 'Diverted' },
    { id: 'RET-2025-007', product: '12.9" Pro Tablet', category: 'Electronics', condition: 'Excellent', locationHub: 'Hyderabad', subHub: 'Gachibowli', pickupDate: '2025-06-16', retailer: 'TechBrand', returnDate: '2025-06-16', holdDays: 7, demandScore: 88, riskScore: 12, avgMarkdown: '—', marginRetained: '89%', status: 'Matched' },
    { id: 'RET-2025-002', product: 'Running Shoes (Air)', category: 'Apparel', condition: 'Good', locationHub: 'Bangalore', subHub: 'Koramangala', pickupDate: '2025-06-15', retailer: 'SportsHub', returnDate: '2025-06-15', holdDays: 6, demandScore: 78, riskScore: 22, avgMarkdown: '8%', marginRetained: '72%', status: 'Matched' },
    { id: 'RET-2025-006', product: 'Cordless Stick Vacuum', category: 'Home', condition: 'Good', locationHub: 'Bangalore', subHub: 'Electronic City', pickupDate: '2025-06-17', retailer: 'HomeMart', returnDate: '2025-06-17', holdDays: 5, demandScore: 67, riskScore: 28, avgMarkdown: '5%', marginRetained: '78%', status: 'Eligible' },
    { id: 'RET-2025-001', product: 'Wireless Earbuds (Pro 2nd Gen)', category: 'Electronics', condition: 'Excellent', locationHub: 'Chennai', subHub: 'Porur', pickupDate: '2025-06-18', retailer: 'TechBrand', returnDate: '2025-06-18', holdDays: 3, demandScore: 92, riskScore: 8, avgMarkdown: '—', marginRetained: '94%', status: 'Eligible' },
    { id: 'RET-2025-003', product: '65" QLED Smart TV', category: 'Electronics', condition: 'Good', locationHub: 'Mumbai', subHub: 'Powai', pickupDate: '2025-06-20', retailer: 'TechBrand', returnDate: '2025-06-20', holdDays: 1, demandScore: 85, riskScore: 15, avgMarkdown: '—', marginRetained: '91%', status: 'Pending' },
    { id: 'RET-2025-005', product: 'ANC Over-Ear Headphones', category: 'Electronics', condition: 'Excellent', locationHub: 'Chennai', subHub: 'Velachery', pickupDate: '2025-06-21', retailer: 'TechBrand', returnDate: '2025-06-21', holdDays: 1, demandScore: 91, riskScore: 9, avgMarkdown: '—', marginRetained: '96%', status: 'Approved' },
  ]);

  getReturns() { return this._returns; }

  addReturn(item: ReturnItem) {
    this._returns.update(r => [item, ...r]);
  }

  /** Manually override a row's lifecycle status (associate “Modify” action). */
  overrideStatus(id: string, status: string) {
    this._returns.update(rows => rows.map(r => (r.id === id ? { ...r, status } : r)));
  }

  nextId(): string {
    const count = this._returns().length + 1;
    return `RET-2025-${String(count + 100).padStart(3, '0')}`;
  }

  private api = inject(ApiService);
  /** True once the list has been replaced with live backend data. */
  live = signal(false);
  /** True while the first live fetch is in flight (seed data shows meanwhile). */
  loading = signal(false);
  private hydrated = false;

  /**
   * Replace the demo list with real AI match results the first time the
   * inventory view is opened. Falls back silently to the seeded demo data
   * when the backend is offline, so the UI is never empty.
   */
  hydrateFromBackend(): void {
    if (this.hydrated) return;
    this.hydrated = true;
    this.loading.set(true);
    forkJoin({
      matches: this.api.getMatches().pipe(catchError(() => of(null))),
      inventory: this.api.getInventory().pipe(catchError(() => of(null))),
    }).subscribe(({ matches, inventory }) => {
      this.loading.set(false);
      if (!matches || !matches.data?.length) return;
      const holdByReturn = new Map<string, DebugInventory>();
      inventory?.data?.forEach((inv) => holdByReturn.set(inv.returnId, inv));

      const items = matches.data.map((m, i) => this.fromMatch(m, i, holdByReturn.get(m.returnRequestId)));
      this._returns.set(items);
      this.live.set(true);
    });
  }

  private fromMatch(m: DebugMatch, i: number, inv?: DebugInventory): ReturnItem {
    const holdDays = m.holdingDay ?? inv?.holdingDays ?? (i % 10) + 1;
    // Prefer the real diversion agent's dead-stock risk; fall back to the
    // inverse of match confidence only when the agent output is absent.
    const risk = m.clearanceRisk != null
      ? Math.round(m.clearanceRisk * 100)
      : Math.max(4, Math.round(100 - m.confidence * 100));
    // Real markdown from the dynamic-pricing agent (returned as a negative cut);
    // '—' means full price.
    const cut = m.priceAdjustmentPct != null ? Math.abs(Math.round(m.priceAdjustmentPct)) : null;
    const markdown = cut != null
      ? (cut > 0 ? `${cut}%` : '—')
      : (m.matchScore >= 80 ? '—' : `${Math.round((100 - m.matchScore) * 0.25)}%`);
    return {
      id: `RET-${m.returnRequestId.slice(0, 8).toUpperCase()}`,
      product: m.productName || m.productId,
      category: m.category || 'General',
      condition: m.condition || 'Good',
      locationHub: m.location || 'Chennai',
      subHub: m.subHub || subHubFor(m.location, m.returnRequestId),
      pickupDate: (m.createdAt || '').split('T')[0],
      retailer: (m.productName || m.productId).split(' ')[0],
      returnDate: (m.createdAt || '').split('T')[0],
      holdDays,
      demandScore: Math.round(m.matchScore),
      riskScore: risk,
      avgMarkdown: markdown,
      marginRetained: `${Math.round(m.matchScore)}%`,
      status: this.mapStatus(m.diversionAction || m.recommendation, m.matchScore, holdDays),
      diversionAction: m.diversionAction,
      basePrice: m.basePrice,
      suggestedPrice: m.suggestedPrice,
      priceAdjustmentPct: m.priceAdjustmentPct,
      searchRadiusKm: m.searchRadiusKm,
      clearanceRisk: m.clearanceRisk,
      sellProbability: m.sellProbability,
      daysRemaining: m.daysRemaining,
      diversionReasoning: m.diversionReasoning,
    };
  }

  /**
   * Maps agent output onto the canonical return lifecycle:
   * Pending → Approved → Eligible → Matched / Diverted (resold ✅)
   * with ReturnToSeller / Rejected as loss terminals ❌.
   */
  private mapStatus(recommendation: string, score: number, holdDays: number): string {
    const r = (recommendation || '').toUpperCase();
    // Failed image validation (damaged) — cannot be resold.
    if (r.includes('REJECT') || r.includes('NOT_ELIGIBLE') || r.includes('LIQUIDATE') || r.includes('DAMAGED')) return 'Rejected';
    // Holding clock expired or policy blocked resale — shipped back.
    if (holdDays >= 10 || r.includes('RETURN_TO_SELLER') || r.includes('WAREHOUSE') || r.includes('ESCALATE')) return 'ReturnToSeller';
    // Diversion agent rerouted into a local channel.
    if (r.includes('DISCOUNT') || r.includes('ACCESS_POINT') || r.includes('WIDEN_RADIUS') || r.includes('DIVERT')) return 'Diverted';
    // Match agent found a local buyer (score ≥ 70).
    if (r.includes('SELL_LOCAL') || r.includes('MATCH') || score >= 70) return 'Matched';
    // Photo-validated as resale-worthy, waiting for a local buyer.
    if (r.includes('REDISTRIBUTE') || r.includes('HOLD') || score >= 60) return 'Eligible';
    // Cleared intake / image validation passed.
    if (score >= 40) return 'Approved';
    return 'Pending';
  }
}
