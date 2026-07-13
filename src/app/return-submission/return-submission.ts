import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ReturnService } from '../return';
import { ApiService, MatchAgentResponse, ReturnProcessingResponse } from '../core/api.service';

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
  subHub = signal('');
  pickupDate = signal('');
  retailer = signal('');
  returnReason = signal('Changed mind');
  dragOver = signal(false);

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
  hasData = computed(() => this.product().length > 0);

  /** Calls the real Match agent (POST /api/matchagent/find-match) and shows its verdict. */
  runLiveMatch() {
    if (!this.product()) return;
    this.analyzing.set(true);
    this.liveError.set('');
    this.liveResult.set(null);
    const productId = `PROD-${this.retailer().toUpperCase() || 'GEN'}-${this.product().replace(/\s+/g, '-').toUpperCase().slice(0, 12)}`;
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
    this.api
      .processReturn({
        packageId: pkg,
        productName: this.product(),
        category: this.category(),
        returnReason: this.returnReason(),
        location: this.locationHub(),
        basePrice: 4999,
      })
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.pipelineRunning.set(false);
        if (!res) {
          this.pipelineError.set('Pipeline unavailable — backend offline.');
          return;
        }
        this.pipeline.set(res);
      });
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
