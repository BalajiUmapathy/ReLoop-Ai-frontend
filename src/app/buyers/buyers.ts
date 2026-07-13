import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import { ApiService, BuyerDto } from '../core/api.service';

@Component({
  selector: 'app-buyers',
  imports: [DecimalPipe],
  templateUrl: './buyers.html',
  styleUrl: './buyers.css',
})
export class BuyersComponent implements OnInit {
  private api = inject(ApiService);

  // Hub selection
  hubs = ['CHN', 'BLR', 'MUM', 'DEL', 'HYD'];
  hubLabels: Record<string, string> = {
    CHN: 'Chennai', BLR: 'Bangalore', MUM: 'Mumbai', DEL: 'Delhi', HYD: 'Hyderabad',
  };
  activeHub = signal('CHN');

  // Data state
  allBuyers = signal<BuyerDto[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Sorting
  sortAsc = signal(false);

  // Pagination
  pageSize = signal(5);
  currentPage = signal(1);

  // Computed: sorted list
  sorted = computed(() => {
    const list = [...this.allBuyers()];
    const asc = this.sortAsc();
    list.sort((a, b) => asc ? a.demandScore - b.demandScore : b.demandScore - a.demandScore);
    return list;
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.sorted().length / this.pageSize())));

  // Computed: current page slice
  paged = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.sorted().slice(start, start + this.pageSize());
  });

  // Stats
  totalBuyers = computed(() => this.allBuyers().length);
  avgScore = computed(() => {
    const list = this.allBuyers();
    return list.length ? list.reduce((s, b) => s + b.demandScore, 0) / list.length : 0;
  });
  highDemandCount = computed(() => this.allBuyers().filter(b => b.demandScore >= 85).length);

  ngOnInit(): void {
    this.loadBuyers('CHN');
  }

  selectHub(hub: string): void {
    this.activeHub.set(hub);
    this.currentPage.set(1);
    this.loadBuyers(hub);
  }

  toggleSort(): void {
    this.sortAsc.update(v => !v);
    this.currentPage.set(1);
  }

  prevPage(): void {
    this.currentPage.update(p => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.currentPage.update(p => Math.min(this.totalPages(), p + 1));
  }

  badgeClass(recommendation: string): string {
    const r = recommendation.toLowerCase();
    if (r.includes('high')) return 'badge-high';
    if (r.includes('low')) return 'badge-low';
    return 'badge-med';
  }

  scoreColor(score: number): string {
    if (score >= 85) return '#22C55E';
    if (score >= 70) return '#EAB308';
    return '#F97316';
  }

  private loadBuyers(hub: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getBuyers(hub)
      .pipe(catchError((err) => {
        this.error.set(`Failed to load buyers for ${this.hubLabels[hub] ?? hub}. Please try again.`);
        this.loading.set(false);
        return of(null);
      }))
      .subscribe((res) => {
        this.loading.set(false);
        if (!res) return;
        this.allBuyers.set(res.buyers ?? []);
      });
  }
}
