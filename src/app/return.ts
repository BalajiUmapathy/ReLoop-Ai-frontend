import { Injectable, signal, inject } from '@angular/core';
import { catchError, of, forkJoin } from 'rxjs';
import { ApiService, DebugMatch, DebugInventory } from './core/api.service';

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
}

@Injectable({ providedIn: 'root' })
export class ReturnService {
  private _returns = signal<ReturnItem[]>([
    { id: 'RET-2025-009', product: 'Mirrorless Camera Kit', category: 'Electronics', condition: 'Fair', locationHub: 'Delhi', subHub: 'Delhi Hub B', pickupDate: '2025-06-08', retailer: 'PhotoPro', returnDate: '2025-06-08', holdDays: 13, demandScore: 38, riskScore: 82, avgMarkdown: '22%', marginRetained: '32%', status: 'Escalated' },
    { id: 'RET-2025-004', product: 'Multi-Cooker 7-in-1', category: 'Home', condition: 'Fair', locationHub: 'Delhi', subHub: 'Delhi Hub A', pickupDate: '2025-06-10', retailer: 'HomeMart', returnDate: '2025-06-10', holdDays: 11, demandScore: 45, riskScore: 72, avgMarkdown: '18%', marginRetained: '41%', status: 'At Risk' },
    { id: 'RET-2025-011', product: 'Gas BBQ Grill', category: 'Home', condition: 'Good', locationHub: 'Bangalore', subHub: 'Bangalore East', pickupDate: '2025-06-19', retailer: 'HomeMart', returnDate: '2025-06-19', holdDays: 9, demandScore: 61, riskScore: 25, avgMarkdown: '15%', marginRetained: '55%', status: 'At Risk' },
    { id: 'RET-2025-008', product: 'Running Shoes (Boost)', category: 'Apparel', condition: 'Good', locationHub: 'Mumbai', subHub: 'Mumbai East', pickupDate: '2025-06-12', retailer: 'SportsHub', returnDate: '2025-06-12', holdDays: 8, demandScore: 55, riskScore: 45, avgMarkdown: '12%', marginRetained: '58%', status: 'At Risk' },
    { id: 'RET-2025-007', product: '12.9" Pro Tablet', category: 'Electronics', condition: 'Excellent', locationHub: 'Hyderabad', subHub: 'Hyderabad Hub', pickupDate: '2025-06-16', retailer: 'TechBrand', returnDate: '2025-06-16', holdDays: 7, demandScore: 88, riskScore: 12, avgMarkdown: '—', marginRetained: '89%', status: 'Eligible' },
    { id: 'RET-2025-002', product: 'Running Shoes (Air)', category: 'Apparel', condition: 'Good', locationHub: 'Bangalore', subHub: 'Bangalore North', pickupDate: '2025-06-15', retailer: 'SportsHub', returnDate: '2025-06-15', holdDays: 6, demandScore: 78, riskScore: 22, avgMarkdown: '8%', marginRetained: '72%', status: 'Matched' },
    { id: 'RET-2025-006', product: 'Cordless Stick Vacuum', category: 'Home', condition: 'Good', locationHub: 'Bangalore', subHub: 'Bangalore South', pickupDate: '2025-06-17', retailer: 'HomeMart', returnDate: '2025-06-17', holdDays: 5, demandScore: 67, riskScore: 28, avgMarkdown: '5%', marginRetained: '78%', status: 'Matched' },
    { id: 'RET-2025-001', product: 'Wireless Earbuds (Pro 2nd Gen)', category: 'Electronics', condition: 'Excellent', locationHub: 'Chennai', subHub: 'Chennai Central', pickupDate: '2025-06-18', retailer: 'TechBrand', returnDate: '2025-06-18', holdDays: 3, demandScore: 92, riskScore: 8, avgMarkdown: '—', marginRetained: '94%', status: 'Eligible' },
    { id: 'RET-2025-003', product: '65" QLED Smart TV', category: 'Electronics', condition: 'Good', locationHub: 'Mumbai', subHub: 'Mumbai West', pickupDate: '2025-06-20', retailer: 'TechBrand', returnDate: '2025-06-20', holdDays: 1, demandScore: 85, riskScore: 15, avgMarkdown: '—', marginRetained: '91%', status: 'Eligible' },
    { id: 'RET-2025-005', product: 'ANC Over-Ear Headphones', category: 'Electronics', condition: 'Excellent', locationHub: 'Chennai', subHub: 'Chennai South', pickupDate: '2025-06-21', retailer: 'TechBrand', returnDate: '2025-06-21', holdDays: 1, demandScore: 91, riskScore: 9, avgMarkdown: '—', marginRetained: '96%', status: 'Eligible' },
  ]);

  getReturns() { return this._returns; }

  addReturn(item: ReturnItem) {
    this._returns.update(r => [item, ...r]);
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
    const holdDays = inv?.holdingDays ?? (i % 10) + 1;
    const risk = Math.max(4, Math.round(100 - m.confidence * 100));
    return {
      id: `RET-${m.returnRequestId.slice(0, 8).toUpperCase()}`,
      product: m.productName || m.productId,
      category: m.category || 'General',
      condition: m.condition || 'Good',
      locationHub: m.location || 'Chennai',
      subHub: `${m.location || 'Chennai'} Hub`,
      pickupDate: (m.createdAt || '').split('T')[0],
      retailer: (m.productName || m.productId).split(' ')[0],
      returnDate: (m.createdAt || '').split('T')[0],
      holdDays,
      demandScore: Math.round(m.matchScore),
      riskScore: risk,
      avgMarkdown: m.matchScore >= 80 ? '—' : `${Math.round((100 - m.matchScore) * 0.25)}%`,
      marginRetained: `${Math.round(m.matchScore)}%`,
      status: this.mapStatus(m.recommendation, m.matchScore, holdDays),
    };
  }

  private mapStatus(recommendation: string, score: number, holdDays: number): string {
    const r = (recommendation || '').toUpperCase();
    if (holdDays >= 10) return 'Escalated';
    if (r.includes('SELL_LOCAL') || score >= 80) return 'Matched';
    if (r.includes('REDISTRIBUTE') || score >= 60) return 'Eligible';
    if (r.includes('DISCOUNT') || score >= 40) return 'At Risk';
    if (r.includes('LIQUIDATE') || r.includes('WAREHOUSE')) return 'Escalated';
    return 'Pending';
  }
}
