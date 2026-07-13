import { Component, signal, computed, inject, effect } from '@angular/core';
import { catchError, of } from 'rxjs';
import { ApiService, BuyerDto, DebugMatch } from '../core/api.service';

interface HubData {
  featuredReturn: string; returnId: string; location: string; district: string;
  nearbyDemand: number; demandScore: number; saleWindow: string; matchRate: number;
  inventoryItems: number; activeBuyers: number;
  revenueRecovery: string; distanceSaved: string; profitImpact: string; carbonReduction: string;
  buyers: { name: string; zone: string; distance: string; delivery: string; score: number }[];
}

@Component({
  selector: 'app-local-demand',
  imports: [],
  templateUrl: './local-demand.html',
  styleUrl: './local-demand.css',
})
export class LocalDemand {
  activeHub = signal('CHN');
  hubs = ['CHN', 'BLR', 'MUM', 'DEL', 'HYD'];

  // Static display labels only — everything else comes from API.
  private hubMeta: Record<string, { location: string; district: string; profitImpact: string }> = {
    CHN: { location: 'Chennai Hub',   district: 'Central district', profitImpact: '+₹13,900' },
    BLR: { location: 'Bangalore Hub', district: 'North district',   profitImpact: '+₹11,800' },
    MUM: { location: 'Mumbai Hub',    district: 'West district',    profitImpact: '+₹17,800' },
    DEL: { location: 'Delhi Hub',     district: 'Hub B district',   profitImpact: '+₹7,900'  },
    HYD: { location: 'Hyderabad Hub', district: 'Central district', profitImpact: '+₹10,600' },
  };

  private liveInfo = signal<Map<string, Partial<HubData>>>(new Map());
  private buyerOverlays = signal<Map<string, BuyerDto[]>>(new Map());

  hub = computed(() => {
    const key = this.activeHub();
    const meta = this.hubMeta[key];
    const info = this.liveInfo().get(key);
    const overlay = this.overlays().get(key);
    const buyers = this.buyerOverlays().get(key) ?? [];
    return {
      featuredReturn:   info?.featuredReturn   ?? '—',
      returnId:         info?.returnId         ?? '—',
      inventoryItems:   info?.inventoryItems   ?? 0,
      location:         meta.location,
      district:         meta.district,
      profitImpact:     meta.profitImpact,
      nearbyDemand:     buyers.length,
      activeBuyers:     buyers.length,
      demandScore:      overlay?.demandScore   ?? 0,
      matchRate:        overlay?.matchRate     ?? 0,
      saleWindow:       overlay?.saleWindow    ?? '—',
      revenueRecovery:  overlay?.revenueRecovery ?? '—',
      distanceSaved:    overlay?.distanceSaved  ?? '—',
      carbonReduction:  overlay?.carbonReduction ?? '—',
      buyers,
    };
  });

  /** True when the active hub's headline numbers came from the live Match agent. */
  live = computed(() => this.overlays().has(this.activeHub()));

  private api = inject(ApiService);
  private overlays = signal<Map<string, Partial<HubData>>>(new Map());
  private cityByHub: Record<string, string> = {
    CHN: 'Chennai', BLR: 'Bangalore', MUM: 'Mumbai', DEL: 'Delhi', HYD: 'Hyderabad',
  };

  constructor() {
    // Pull each hub's featured return from real match data when available.
    this.api.getMatches().pipe(catchError(() => of(null))).subscribe((res) => {
      const rows = res?.data ?? [];
      if (!rows.length) return;
      const byCity = new Map<string, DebugMatch[]>();
      for (const m of rows) {
        const city = (m.location || '').split(/[ ,]/)[0];
        const list = byCity.get(city) ?? [];
        list.push(m); byCity.set(city, list);
      }
      const info = new Map<string, Partial<HubData>>();
      for (const key of this.hubs) {
        const list = byCity.get(this.cityByHub[key]) ?? [];
        if (!list.length) continue;
        const topMatch = [...list].sort((a, b) => b.matchScore - a.matchScore)[0];
        info.set(key, {
          featuredReturn: topMatch.productName,
          returnId: topMatch.returnRequestId ? topMatch.returnRequestId.slice(0, 8).toUpperCase() : topMatch.productId,
          inventoryItems: list.length,
        });
      }
      this.liveInfo.set(info);
      this.overlays.set(new Map());
    });

    // Fetch buyers from GET /api/buyers?hub= for each hub tab.
    effect(() => {
      const key = this.activeHub();
      if (this.buyerOverlays().has(key)) return;
      this.api
        .getBuyers(key)
        .pipe(catchError(() => of(null)))
        .subscribe((res) => {
          if (!res?.buyers?.length) return;
          this.buyerOverlays.update((m) => new Map(m).set(key, res.buyers));
        });
    });

    // Fetch match-agent data for headline numbers.
    effect(() => {
      const key = this.activeHub();
      if (this.overlays().has(key)) return;
      const info = this.liveInfo().get(key);
      if (!info?.returnId && !info?.featuredReturn) return;
      this.api
        .findMatch({
          productId: info.returnId ?? key,
          productName: info.featuredReturn ?? key,
          category: 'Electronics',
          location: this.cityByHub[key],
          condition: 'Good',
        })
        .pipe(catchError(() => of(null)))
        .subscribe((res) => {
          if (!res) return;
          this.overlays.update((m) =>
            new Map(m).set(key, {
              demandScore: res.matchScore,
              matchRate: res.matchScore,
              saleWindow: res.expectedDaysToSell ? `${res.expectedDaysToSell} Days` : '—',
              revenueRecovery: `₹${Math.round(res.costSaved)}`,
              distanceSaved: `${Math.round(res.distanceSavedKm)} KM`,
              carbonReduction: `${res.co2Saved.toFixed(1)} KG`,
            }),
          );
        });
    });
  }

  scoreColor(s: number) {
    if (s >= 90) return '#22C55E';
    if (s >= 80) return '#EAB308';
    return '#F97316';
  }
}
