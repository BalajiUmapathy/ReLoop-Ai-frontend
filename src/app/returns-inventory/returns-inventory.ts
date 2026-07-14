import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import { ReturnService } from '../return';
import { ApiService, FeedbackSummary } from '../core/api.service';
import { ReturnItem } from '../return';

@Component({
  selector: 'app-returns-inventory',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './returns-inventory.html',
  styleUrl: './returns-inventory.css',
})
export class ReturnsInventoryComponent implements OnInit {
  private svc = inject(ReturnService);
  private api = inject(ApiService);

  live = this.svc.live;
  loading = this.svc.loading;

  // Human-in-the-loop feedback
  feedback = signal<FeedbackSummary | null>(null);
  reviewed = signal<Record<string, 'Accept' | 'Modify' | 'Reject'>>({});

  ngOnInit(): void {
    this.svc.hydrateFromBackend();
    this.loadFeedback();
  }

  private loadFeedback() {
    this.api
      .getFeedbackSummary()
      .pipe(catchError(() => of(null)))
      .subscribe((s) => this.feedback.set(s));
  }

  /** Captures an associate Accept / Modify / Reject decision and feeds the learning loop. */
  sendFeedback(id: string, action: 'Accept' | 'Modify' | 'Reject', product: string) {
    this.reviewed.update((m) => ({ ...m, [id]: action }));
    this.api
      .submitFeedback({
        returnRequestId: null,
        action,
        correctedField: action === 'Modify' ? 'Recommendation' : null,
        associateId: 'assoc-console',
        notes: `${action} on ${product} (${id})`,
      })
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.loadFeedback());
  }

  search = signal('');
  statusFilter = signal('All');
  categoryFilter = signal('All');
  conditionFilter = signal('All');

  statuses = ['All', 'Eligible', 'Matched', 'Pending', 'Sold Locally', 'Returned', 'At Risk', 'Escalated'];
  categories = ['All', 'Electronics', 'Apparel', 'Home', 'Sports', 'Books'];
  conditions = ['All', 'Excellent', 'Good', 'Fair', 'Poor'];

  items = computed(() => {
    return this.svc.getReturns()().filter(r => {
      const q = this.search().toLowerCase();
      const matchSearch = !q || r.product.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
      const matchStatus = this.statusFilter() === 'All' || r.status === this.statusFilter();
      const matchCat = this.categoryFilter() === 'All' || r.category === this.categoryFilter();
      const matchCond = this.conditionFilter() === 'All' || r.condition === this.conditionFilter();
      return matchSearch && matchStatus && matchCat && matchCond;
    });
  });

  holdClass(days: number) {
    if (days >= 10) return 'hold-red';
    if (days >= 6) return 'hold-orange';
    if (days >= 3) return 'hold-yellow';
    return 'hold-green';
  }

  statusClass(s: string) {
    return ({ 'Eligible': 'st-eligible', 'Matched': 'st-matched', 'At Risk': 'st-risk', 'Escalated': 'st-escalated', 'Pending': 'st-pending' } as Record<string,string>)[s] ?? 'st-pending';
  }

  conditionClass(c: string) {
    return ({ 'Excellent': 'cond-excellent', 'Good': 'cond-good', 'Fair': 'cond-fair', 'Poor': 'cond-poor' } as Record<string,string>)[c] ?? '';
  }

  // ---- Dynamic-pricing detail drawer -------------------------------------
  selected = signal<ReturnItem | null>(null);
  openDetail(r: ReturnItem) { this.selected.set(r); }
  closeDetail() { this.selected.set(null); }

  /** Eligibility verdict shown in the drawer (merged from the old AI Eligibility page). */
  isEligible(r: ReturnItem): boolean {
    return ['Eligible', 'Matched', 'Sold Locally'].includes(r.status) || r.demandScore >= 60;
  }
  eligibilityLabel(r: ReturnItem): string {
    return this.isEligible(r) ? 'Eligible for Local Resale' : 'Manual Review Required';
  }
  /** Sell-through probability as a 0-100 percentage (agent value or demand fallback). */
  sellPct(r: ReturnItem): number {
    return (r.sellProbability ?? r.demandScore / 100) * 100;
  }

  /** Compact INR formatter for the pricing drawer (₹1.2K / ₹8.4K style). */
  money(v?: number): string {
    if (v == null) return '—';
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
    return `₹${Math.round(v)}`;
  }

  /** Colour band for the clearance-risk meter. */
  riskBand(pct: number): 'low' | 'mid' | 'high' {
    if (pct >= 60) return 'high';
    if (pct >= 30) return 'mid';
    return 'low';
  }

  /** Exports the currently filtered rows to a CSV file the browser downloads. */
  exportCsv() {
    const rows = this.items();
    if (!rows.length) return;
    const headers = [
      'Return ID', 'Product', 'Category', 'Location', 'Hub', 'Condition', 'Return Date',
      'Hold Days', 'Demand Score', 'Risk Score', 'Avg Markdown', 'Margin Retained', 'Status',
    ];
    const escape = (v: string | number) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r) => [
      r.id, r.product, r.category, r.locationHub, r.subHub, r.condition, r.returnDate,
      r.holdDays, r.demandScore, r.riskScore, r.avgMarkdown, r.marginRetained, r.status,
    ].map(escape).join(','));
    const csv = [headers.join(','), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `returns-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
