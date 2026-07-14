import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import { ReturnService } from '../return';
import { ApiService, FeedbackSummary } from '../core/api.service';
import { ReturnItem } from '../return';
import { imageValidationFor, ImageValidation } from '../return';

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
  /** Row whose quick-actions menu is open, plus where to anchor it. */
  menuItem = signal<ReturnItem | null>(null);
  menuPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

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
  sendFeedback(id: string, action: 'Accept' | 'Modify' | 'Reject', product: string, notes?: string) {
    this.reviewed.update((m) => ({ ...m, [id]: action }));
    this.api
      .submitFeedback({
        returnRequestId: null,
        action,
        correctedField: action === 'Modify' ? 'Status' : null,
        associateId: 'assoc-console',
        notes: notes ?? `${action} on ${product} (${id})`,
      })
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.loadFeedback());
  }

  /** Accept the AI decision as-is. */
  accept(r: ReturnItem) { this.sendFeedback(r.id, 'Accept', r.product); }

  /** Reject the AI decision — flips the row to the Rejected loss terminal. */
  reject(r: ReturnItem) {
    this.svc.overrideStatus(r.id, 'Rejected');
    this.syncSelected(r.id, 'Rejected');
    this.sendFeedback(r.id, 'Reject', r.product, `Rejected ${r.product} (${r.id}) — associate override`);
  }

  /** Toggle the per-row quick-actions menu, anchored under the clicked kebab. */
  toggleMenu(r: ReturnItem, ev: MouseEvent) {
    ev.stopPropagation();
    if (this.menuItem()?.id === r.id) { this.menuItem.set(null); return; }
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    this.menuPos.set({ x: Math.max(12, rect.right - 232), y: rect.bottom + 6 });
    this.menuItem.set(r);
  }
  closeMenu() { this.menuItem.set(null); }

  /** Apply an associate status override and log it as a Modify signal. */
  applyModify(r: ReturnItem, status: string) {
    if (!status || status === r.status) return;
    this.svc.overrideStatus(r.id, status);
    this.syncSelected(r.id, status);
    this.sendFeedback(r.id, 'Modify', r.product, `Status ${r.status} → ${status} on ${r.product} (${r.id})`);
  }

  /** Keep the open detail drawer in sync after a status override. */
  private syncSelected(id: string, status: string) {
    const s = this.selected();
    if (s && s.id === id) this.selected.set({ ...s, status });
  }

  search = signal('');
  statusFilter = signal('All');
  categoryFilter = signal('All');
  conditionFilter = signal('All');

  statuses = ['All', 'Pending', 'Approved', 'Eligible', 'Matched', 'Diverted', 'ReturnToSeller', 'Rejected'];
  /** Statuses an associate can override a row to (used by the Modify dropdown). */
  overrideStatuses = ['Pending', 'Approved', 'Eligible', 'Matched', 'Diverted', 'ReturnToSeller', 'Rejected'];
  categories = ['All', 'Electronics', 'Apparel', 'Home', 'Sports', 'Books'];
  conditions = ['All', 'Excellent', 'Good', 'Fair', 'Poor'];

  /** Canonical return-lifecycle metadata (label, colour, meaning, who sets it, what it counts toward). */
  statusMeta: Record<string, { label: string; css: string; desc: string; who: string; counts: string }> = {
    Pending: { label: 'Pending', css: 'st-pending', desc: 'Just submitted, not processed yet.', who: 'Intake (no agent)', counts: 'Total only' },
    Approved: { label: 'Approved', css: 'st-approved', desc: 'Cleared intake, approved into the resale flow.', who: 'Image Validation passed', counts: 'Eligible' },
    Eligible: { label: 'Eligible', css: 'st-eligible', desc: 'Photo-validated as resale-worthy, waiting for a local buyer.', who: 'Image Validation Agent', counts: 'Eligible' },
    Matched: { label: 'Matched', css: 'st-matched', desc: 'Match Agent found a local buyer — resold locally instead of warehousing.', who: 'Match Agent (score ≥ 70)', counts: 'Eligible + Local Matches + Diversion' },
    Diverted: { label: 'Diverted', css: 'st-diverted', desc: 'Diversion agent rerouted it into a local channel (discount, access point, widened radius).', who: 'Diversion Agent', counts: 'Eligible + Local Matches + Diversion' },
    ReturnToSeller: { label: 'Return to Seller', css: 'st-return', desc: '10-day clock expired or policy blocked resale — shipped back.', who: 'Holding clock / policy', counts: 'Total only (the loss)' },
    Rejected: { label: 'Rejected', css: 'st-rejected', desc: 'Failed image validation (damaged) — cannot be resold.', who: 'Image Validation Agent', counts: 'Total only' },
  };

  statusInfo(s: string) {
    return this.statusMeta[s] ?? { label: s, css: 'st-pending', desc: '', who: '', counts: '' };
  }

  /** Builds the horizontal lifecycle stepper shown in the detail drawer. */
  lifecycle(status: string): { label: string; state: 'done' | 'active' | 'todo' | 'bad' }[] {
    if (status === 'Rejected') {
      return [
        { label: 'Pending', state: 'done' },
        { label: 'Image Validation', state: 'bad' },
        { label: 'Rejected', state: 'bad' },
      ];
    }
    if (status === 'ReturnToSeller') {
      return [
        { label: 'Pending', state: 'done' },
        { label: 'Approved', state: 'done' },
        { label: 'Eligible', state: 'done' },
        { label: 'Return to Seller', state: 'bad' },
      ];
    }
    const idx: Record<string, number> = { Pending: 0, Approved: 1, Eligible: 2, Matched: 3, Diverted: 3 };
    const cur = idx[status] ?? 0;
    const last = status === 'Diverted' ? 'Diverted' : 'Matched';
    return ['Pending', 'Approved', 'Eligible', last].map((label, i) => ({
      label,
      state: i < cur ? 'done' : i === cur ? 'active' : 'todo',
    }));
  }

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
    return this.statusInfo(s).css;
  }

  statusLabel(s: string) {
    return this.statusInfo(s).label;
  }

  conditionClass(c: string) {
    const k = (c ?? '').toLowerCase().replace(/[^a-z]/g, '');
    const map: Record<string, string> = {
      excellent: 'cond-excellent', new: 'cond-excellent', likenew: 'cond-excellent', mint: 'cond-excellent',
      good: 'cond-good', used: 'cond-good',
      fair: 'cond-fair', worn: 'cond-fair',
      poor: 'cond-poor', damaged: 'cond-poor', broken: 'cond-poor', defective: 'cond-poor',
    };
    return map[k] ?? 'cond-neutral';
  }

  /** Vision-agent readout for a row (uses the row's fields, else re-derives). */
  imageVal(r: ReturnItem): ImageValidation {
    if (r.damageScore != null && r.imageConfidence != null) {
      return {
        damageScore: r.damageScore,
        imageConfidence: r.imageConfidence,
        missingTags: r.missingTags ?? false,
        imageRemarks: r.imageRemarks ?? '',
      };
    }
    return imageValidationFor(r.condition, r.id);
  }

  /** Damage-score badge colour (low = green, high = red). */
  damageClass(score: number): string {
    if (score <= 2) return 'dmg-low';
    if (score <= 5) return 'dmg-mid';
    return 'dmg-high';
  }

  // ---- Dynamic-pricing detail drawer -------------------------------------
  selected = signal<ReturnItem | null>(null);
  openDetail(r: ReturnItem) { this.selected.set(r); }
  closeDetail() { this.selected.set(null); }

  /** Eligibility verdict shown in the drawer (merged from the old AI Eligibility page). */
  isEligible(r: ReturnItem): boolean {
    return ['Approved', 'Eligible', 'Matched', 'Diverted'].includes(r.status) || r.demandScore >= 60;
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
