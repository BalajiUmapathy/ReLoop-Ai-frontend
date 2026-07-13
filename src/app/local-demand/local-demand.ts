import { Component, signal, computed, inject, effect } from '@angular/core';
import { catchError, of } from 'rxjs';
import { ApiService, DebugMatch, BuyerDto } from '../core/api.service';

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

  private hubData: Record<string, HubData> = {
    CHN: {
      featuredReturn: 'Wireless Earbuds (Pro)', returnId: 'RET-2025-001', location: 'Chennai Hub', district: 'Central district',
      nearbyDemand: 41, demandScore: 92, saleWindow: '3 Days', matchRate: 84,
      inventoryItems: 341, activeBuyers: 41, revenueRecovery: '₹12,000', distanceSaved: '320 KM', profitImpact: '+₹13,900', carbonReduction: '5.2 KG',
      buyers: [
        { name: 'Arjun Sharma', zone: 'T. Nagar, Chennai', distance: '2.1 km', delivery: '2h 30min', score: 96 },
        { name: 'Priya Krishnamurthy', zone: 'Adyar, Chennai', distance: '3.4 km', delivery: '3h 15min', score: 91 },
        { name: 'Ravi Sundar', zone: 'Velachery, Chennai', distance: '5.2 km', delivery: '4h 00min', score: 87 },
        { name: 'Meera Nair', zone: 'Porur, Chennai', distance: '7.8 km', delivery: '5h 30min', score: 82 },
        { name: 'Karthik Rajan', zone: 'Tambaram, Chennai', distance: '9.1 km', delivery: '6h 00min', score: 78 },
      ],
    },
    BLR: {
      featuredReturn: 'Running Shoes (Air)', returnId: 'RET-2025-002', location: 'Bangalore Hub', district: 'North district',
      nearbyDemand: 38, demandScore: 87, saleWindow: '4 Days', matchRate: 79,
      inventoryItems: 284, activeBuyers: 38, revenueRecovery: '₹10,600', distanceSaved: '280 KM', profitImpact: '+₹11,800', carbonReduction: '4.1 KG',
      buyers: [
        { name: 'Rohan Mehta', zone: 'Indiranagar, Bangalore', distance: '1.8 km', delivery: '2h 00min', score: 94 },
        { name: 'Sneha Reddy', zone: 'Koramangala, Bangalore', distance: '3.1 km', delivery: '3h 00min', score: 88 },
        { name: 'Vikram Nair', zone: 'Whitefield, Bangalore', distance: '6.2 km', delivery: '4h 30min', score: 83 },
        { name: 'Anjali Singh', zone: 'HSR Layout, Bangalore', distance: '8.4 km', delivery: '5h 00min', score: 77 },
        { name: 'Deepak Kumar', zone: 'Electronic City, Bangalore', distance: '11.2 km', delivery: '6h 30min', score: 71 },
      ],
    },
    MUM: {
      featuredReturn: '65" QLED Smart TV', returnId: 'RET-2025-003', location: 'Mumbai Hub', district: 'West district',
      nearbyDemand: 29, demandScore: 81, saleWindow: '5 Days', matchRate: 72,
      inventoryItems: 231, activeBuyers: 29, revenueRecovery: '₹16,400', distanceSaved: '210 KM', profitImpact: '+₹17,800', carbonReduction: '3.8 KG',
      buyers: [
        { name: 'Rahul Joshi', zone: 'Bandra, Mumbai', distance: '2.5 km', delivery: '2h 45min', score: 91 },
        { name: 'Pooja Sharma', zone: 'Andheri, Mumbai', distance: '4.0 km', delivery: '3h 30min', score: 85 },
        { name: 'Amit Patel', zone: 'Powai, Mumbai', distance: '7.1 km', delivery: '5h 00min', score: 79 },
        { name: 'Kavita Desai', zone: 'Thane, Mumbai', distance: '9.3 km', delivery: '5h 45min', score: 74 },
        { name: 'Suresh Iyer', zone: 'Navi Mumbai', distance: '12.0 km', delivery: '7h 00min', score: 68 },
      ],
    },
    DEL: {
      featuredReturn: 'Mirrorless Camera Kit', returnId: 'RET-2025-009', location: 'Delhi Hub', district: 'Hub B district',
      nearbyDemand: 22, demandScore: 64, saleWindow: '8 Days', matchRate: 58,
      inventoryItems: 197, activeBuyers: 22, revenueRecovery: '₹7,400', distanceSaved: '150 KM', profitImpact: '+₹7,900', carbonReduction: '2.9 KG',
      buyers: [
        { name: 'Aditya Kapoor', zone: 'Connaught Place, Delhi', distance: '3.2 km', delivery: '3h 15min', score: 86 },
        { name: 'Neha Gupta', zone: 'Lajpat Nagar, Delhi', distance: '5.8 km', delivery: '4h 30min', score: 79 },
        { name: 'Rajesh Verma', zone: 'Dwarka, Delhi', distance: '9.0 km', delivery: '5h 30min', score: 71 },
        { name: 'Sunita Chauhan', zone: 'Noida, Delhi NCR', distance: '11.5 km', delivery: '6h 15min', score: 65 },
        { name: 'Manoj Tiwari', zone: 'Gurgaon, Delhi NCR', distance: '14.2 km', delivery: '7h 30min', score: 59 },
      ],
    },
    HYD: {
      featuredReturn: '12.9" Pro Tablet', returnId: 'RET-2025-007', location: 'Hyderabad Hub', district: 'Central district',
      nearbyDemand: 31, demandScore: 88, saleWindow: '4 Days', matchRate: 76,
      inventoryItems: 143, activeBuyers: 31, revenueRecovery: '₹9,300', distanceSaved: '240 KM', profitImpact: '+₹10,600', carbonReduction: '3.4 KG',
      buyers: [
        { name: 'Srinivas Rao', zone: 'Hitech City, Hyderabad', distance: '2.2 km', delivery: '2h 15min', score: 93 },
        { name: 'Lakshmi Prasad', zone: 'Banjara Hills, Hyderabad', distance: '4.5 km', delivery: '3h 30min', score: 86 },
        { name: 'Venkat Reddy', zone: 'Madhapur, Hyderabad', distance: '6.8 km', delivery: '4h 45min', score: 80 },
        { name: 'Padma Rao', zone: 'Secunderabad', distance: '9.5 km', delivery: '5h 30min', score: 73 },
        { name: 'Ramu Naidu', zone: 'Kukatpally, Hyderabad', distance: '11.8 km', delivery: '6h 45min', score: 67 },
      ],
    },
  };

  private liveInfo = signal<Map<string, Partial<HubData>>>(new Map());
  private buyerOverlays = signal<Map<string, BuyerDto[]>>(new Map());

  hub = computed(() => {
    const base = this.hubData[this.activeHub()];
    const info = this.liveInfo().get(this.activeHub());
    const overlay = this.overlays().get(this.activeHub());
    const buyers = this.buyerOverlays().get(this.activeHub());
    const merged = { ...base, ...info, ...overlay };
    return buyers ? { ...merged, buyers } : merged;
  });

  /** True when the active hub's headline numbers came from the live Match agent. */
  live = computed(() => this.overlays().has(this.activeHub()));

  /** True when the active hub's buyer list came from the live buyers endpoint. */
  buyersLive = computed(() => this.buyerOverlays().has(this.activeHub()));

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

    effect(() => {
      const key = this.activeHub();
      if (this.overlays().has(key)) return;
      const h = this.hubData[key];
      const info = this.liveInfo().get(key);
      this.api
        .findMatch({
          productId: info?.returnId ?? h.returnId,
          productName: info?.featuredReturn ?? h.featuredReturn,
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
              saleWindow: res.expectedDaysToSell ? `${res.expectedDaysToSell} Days` : h.saleWindow,
              revenueRecovery: `₹${Math.round(res.costSaved)}`,
              distanceSaved: `${Math.round(res.distanceSavedKm)} KM`,
              carbonReduction: `${res.co2Saved.toFixed(1)} KG`,
            }),
          );
        });
    });

    // Load real hyperlocal buyers per hub when the endpoint is available; the
    // seeded list stays as an offline/illustrative fallback until then.
    effect(() => {
      const key = this.activeHub();
      if (this.buyerOverlays().has(key)) return;
      this.api
        .getBuyers(this.cityByHub[key])
        .pipe(catchError(() => of<BuyerDto[]>([])))
        .subscribe((buyers) => {
          if (!buyers?.length) return;
          this.buyerOverlays.update((m) => new Map(m).set(key, buyers));
        });
    });
  }

  scoreColor(s: number) {
    if (s >= 90) return '#22C55E';
    if (s >= 80) return '#EAB308';
    return '#F97316';
  }
}
