import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ReturnService } from '../return';
import { ApiService, MatchAgentResponse, ReturnProcessingResponse } from '../core/api.service';

const SUB_HUBS: Record<string, string[]> = {
  Chennai: ['Porur Hub', 'Velachery Hub', 'Guindy Hub', 'Ambattur Hub', 'Tambaram Hub', 'Anna Nagar Hub'],
  Bangalore: ['Whitefield Hub', 'Koramangala Hub', 'Electronic City Hub', 'Hebbal Hub', 'Jayanagar Hub', 'Marathahalli Hub'],
  Mumbai: ['Andheri Hub', 'Bhiwandi Hub', 'Powai Hub', 'Vashi Hub', 'Thane Hub', 'Borivali Hub'],
  Delhi: ['Okhla Hub', 'Gurgaon Hub', 'Noida Hub', 'Dwarka Hub', 'Rohini Hub', 'Narela Hub'],
  Hyderabad: ['Gachibowli Hub', 'Uppal Hub', 'Kondapur Hub', 'Shamshabad Hub', 'Kukatpally Hub'],
  Pune: ['Hinjewadi Hub', 'Kharadi Hub', 'Wakad Hub', 'Chakan Hub', 'Hadapsar Hub'],
  Kolkata: ['Salt Lake Hub', 'Howrah Hub', 'Behala Hub', 'Dum Dum Hub', 'Rajarhat Hub'],
};
const DEFAULT_SUB_HUBS = ['Central Hub', 'North Hub', 'South Hub', 'East Hub', 'West Hub'];

@Component({
  selector: 'app-return-submission',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './return-submission.html',
  styleUrl: './return-submission.css',
})
export class ReturnSubmissionComponent implements OnInit {
  private svc = inject(ReturnService);
  private router = inject(Router);
  private api = inject(ApiService);

  returnId = this.svc.nextId();

  product = signal('');
  category = signal('Electronics');
  condition = signal('Excellent');
  locationHub = signal('Chennai');
  subHub = signal('Porur Hub');
  pickupDate = signal('');
  retailer = signal('');
  returnReason = signal('Changed mind');
  priceInput = signal<number | null>(null);
  quantity = signal(1);
  orderRef = signal('');
  notes = signal('');
  dragOver = signal(false);

  subHubs = computed(() => SUB_HUBS[this.locationHub()] ?? DEFAULT_SUB_HUBS);

  onHubChange(hub: string) {
    this.locationHub.set(hub);
    const pool = SUB_HUBS[hub] ?? DEFAULT_SUB_HUBS;
    this.subHub.set(pool[0]);
  }

  // Live AI (real backend match agent)
  analyzing = signal(false);
  liveResult = signal<MatchAgentResponse | null>(null);
  liveError = signal('');

  // Full pipeline (real backend orchestrator: image + policy + match + diversion + revenue + auto-approval)
  pipelineRunning = signal(false);
  pipeline = signal<ReturnProcessingResponse | null>(null);
  pipelineError = signal('');
  private packageId = signal<string | null>(null);
  packageTracking = signal<string>('');

  // Two-step submit: after AI runs, confirmReady flips to true → second click submits
  confirmReady = signal(false);

  /** All confidence signals are canonical 0-1; multiply to a percentage (guards legacy 0-100). */
  pct(v: number): number {
    return Math.round(v <= 1 ? v * 100 : v);
  }

  ngOnInit(): void {
    // Grab a real returnable package so the full pipeline has a valid FK to run against.
    this.api
      .getPackages()
      .pipe(catchError(() => of([])))
      .subscribe((pkgs) => {
        const p = pkgs.find((x) => x.isReturnable) ?? pkgs[0];
        if (p) {
          this.packageId.set(p.id);
          this.packageTracking.set(p.trackingNumber);
        }
      });
  }

  categories = ['Electronics', 'Apparel', 'Home', 'Sports', 'Books'];
  conditions = ['Excellent', 'Good', 'Fair', 'Poor'];
  hubs = ['Chennai', 'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad'];
  reasons = ['Changed mind', 'Size too small', 'Defective item', 'Wrong item shipped', 'Not as described', 'Damaged in transit'];

  conditionScore = computed(() => ({ Excellent: 98, Good: 75, Fair: 45, Poor: 20 }[this.condition()] ?? 75));
  demandScore = computed(() => ({ Electronics: 94, Apparel: 78, Home: 65, Sports: 70, Books: 40 }[this.category()] ?? 70));
  resaleProbability = computed(() => Math.round(this.conditionScore() * 0.6 + this.demandScore() * 0.4));
  saleWindow = computed(() => ({ Excellent: '2-3 Days', Good: '4-6 Days', Fair: '7-10 Days', Poor: '14+ Days' }[this.condition()] ?? '4-6 Days'));
  eligible = computed(() => this.resaleProbability() >= 70);
  hasData = computed(() => this.product().length >= 3);

  // Debounce flag: shows a "thinking" state while AI processes
  aiThinking = signal(false);
  showEstimate = signal(false);
  private debounceTimer: any = null;

  /** Called from template on product input to debounce estimate display */
  onProductChange(val: string) {
    this.product.set(val);
    this.showEstimate.set(false);
    this.aiThinking.set(false);
    clearTimeout(this.debounceTimer);
    if (val.length >= 3) {
      this.aiThinking.set(true);
      this.debounceTimer = setTimeout(() => {
        this.aiThinking.set(false);
        this.showEstimate.set(true);
      }, 1200);
    }
  }

  /** Indicative list price (INR) by category — feeds the dynamic-pricing / revenue agents.
   *  If user enters a dollar price, convert to INR (×83) for the backend. */
  basePrice = computed(() => {
    const manual = this.priceInput();
    if (manual && manual > 0) return Math.round(manual * 83); // user entered $, backend needs ₹
    return ({ Electronics: 8999, Apparel: 2499, Home: 3499, Sports: 3999, Books: 699 }[this.category()] ?? 3499);
  });

  /** Convert INR value from backend to display USD (1 USD ≈ 83 INR) */
  usd(inr: number): string {
    return '$' + Math.round(inr / 83).toLocaleString('en-US');
  }

  /** Calls the real Match agent (POST /api/matchagent/find-match) and shows its verdict. */
  runLiveMatch() {
    if (!this.product()) return;
    this.analyzing.set(true);
    this.liveError.set('');
    this.liveResult.set(null);
    const productId = `PROD-${this.retailer().toUpperCase() || 'GEN'}-${this.product().replace(/\s+/g, '-').toUpperCase().slice(0, 12)}`;
    // Brief thinking delay so user sees AI is working
    setTimeout(() => {
      this.api
        .findMatch({
          productId,
          productName: this.product(),
          category: this.category(),
          location: this.locationHub(),
          condition: this.condition(),
        })
        .pipe(catchError(() => of(null)))
        .subscribe((res) => {
          this.analyzing.set(false);
          if (!res) {
            this.liveError.set('Backend offline — showing local estimate only.');
            return;
          }
          this.liveResult.set(res);
        });
    }, 800);
  }

  /** Runs the FULL AI orchestrator (POST /api/integration/process-return): image validation,
   * retailer policy, hyperlocal match, diversion, decision-confidence gate, auto-approval,
   * revenue economics and grounded citations — the end-to-end decision. */
  runFullPipeline() {
    if (!this.product()) return;
    const pkg = this.packageId();
    if (!pkg) {
      this.pipelineError.set('No package available to link — backend offline.');
      return;
    }
    this.pipelineRunning.set(true);
    this.pipelineError.set('');
    this.pipeline.set(null);
    // Brief thinking delay so user sees AI is working
    setTimeout(() => {
      this.api
        .processReturn({
          packageId: pkg,
          productName: this.product(),
          category: this.category(),
          returnReason: this.returnReason(),
          location: this.locationHub(),
          condition: this.condition(),
          basePrice: this.basePrice(),
        })
        .pipe(catchError(() => of(null)))
        .subscribe((res) => {
          this.pipelineRunning.set(false);
          if (!res) {
            this.pipelineError.set('Pipeline unavailable — backend offline.');
            return;
          }
          this.pipeline.set(res);
          this.confirmReady.set(true); // AI ran manually — enable confirm submit
        });
    }, 1000);
  }

  /** Smart two-step submit: first click runs the AI pipeline; second click (confirmReady) actually submits. */
  handleSubmit() {
    if (!this.product() || !this.pickupDate() || !this.retailer()) return;
    if (!this.confirmReady()) {
      // Step 1 — run AI, scroll panel into view, then flip confirmReady
      this.runFullPipelineAndConfirm();
      return;
    }
    // Step 2 — confirmed, do the real submit
    this.onSubmit();
  }

  /** Like runFullPipeline but sets confirmReady=true on completion instead of just setting pipeline. */
  runFullPipelineAndConfirm() {
    const pkg = this.packageId();
    if (!pkg) {
      // Backend offline — still allow submission after showing local estimate
      this.confirmReady.set(true);
      this.showEstimate.set(true);
      return;
    }
    this.pipelineRunning.set(true);
    this.pipelineError.set('');
    this.pipeline.set(null);
    setTimeout(() => {
      this.api
        .processReturn({
          packageId: pkg,
          productName: this.product(),
          category: this.category(),
          returnReason: this.returnReason(),
          location: this.locationHub(),
          condition: this.condition(),
          basePrice: this.basePrice(),
        })
        .pipe(catchError(() => of(null)))
        .subscribe((res) => {
          this.pipelineRunning.set(false);
          if (res) this.pipeline.set(res);
          else this.pipelineError.set('AI offline — you can still submit.');
          this.showEstimate.set(true);
          this.confirmReady.set(true);
        });
    }, 1000);
  }

  onSubmit() {
    if (!this.product() || !this.pickupDate() || !this.retailer()) return;
    const live = this.liveResult();
    const demand = live ? live.matchScore : this.demandScore();
    this.svc.addReturn({
      id: this.returnId,
      product: this.product(),
      category: this.category(),
      condition: this.condition(),
      locationHub: this.locationHub(),
      subHub: this.subHub() || `${this.locationHub()} Central`,
      pickupDate: this.pickupDate(),
      retailer: this.retailer(),
      returnDate: new Date().toISOString().split('T')[0],
      holdDays: 0,
      demandScore: demand,
      riskScore: 100 - this.resaleProbability(),
      avgMarkdown: this.condition() === 'Excellent' ? '--' : `${Math.round((100 - this.conditionScore()) * 0.3)}%`,
      marginRetained: `${this.resaleProbability()}%`,
      status: this.eligible() ? 'Eligible' : 'Pending',
    });
    this.router.navigate(['/returns-inventory']);
  }
}
