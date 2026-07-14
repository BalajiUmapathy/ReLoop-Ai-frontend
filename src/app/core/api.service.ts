import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/** Envelope every UPS ReLoop Nexus endpoint returns. */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: string[];
  statusCode: number;
}

// ---- Dashboard ----
export interface RootCauseInsight {
  reason: string;
  count: number;
  percentage: number;
}
export interface DashboardMetrics {
  totalReturns: number;
  eligibleReturns: number;
  localMatches: number;
  diversionRate: number;
  distanceSavedKm: number;
  costSaved: number;
  co2SavedKg: number;
  totalValueRecovered: number;
  resaleMargin: number;
  resaleServiceFee: number;
  co2Value: number;
  aiCost: number;
  rootCauseInsights: RootCauseInsight[];
}
export interface DebugDataResult<T = Record<string, any>> {
  table: string;
  rowCount: number;
  data: T[];
  spValidation: string;
  metadata?: Record<string, any>;
}
export interface DebugReturn {
  id: string;
  packageId: string;
  reason: string;
  status: string;
  hasAiAnalysis: boolean;
  resolutionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  isDeleted: boolean;
}
export interface DebugMatch {
  id: string;
  returnRequestId: string;
  productId: string;
  productName: string;
  category: string;
  location: string;
  subHub?: string;
  condition: string;
  matchScore: number;
  recommendation: string;
  confidence: number;
  distanceSavedKm: number;
  costSaved: number;
  co2Saved: number;
  createdAt: string;
  // Diversion / dynamic-pricing agent output (per-row), added by /api/debug/matches.
  holdingDay?: number;
  daysRemaining?: number;
  diversionAction?: string;
  basePrice?: number;
  suggestedPrice?: number;
  priceAdjustmentPct?: number;
  searchRadiusKm?: number;
  clearanceRisk?: number;
  sellProbability?: number;
  diversionReasoning?: string;
}
export interface DebugInventory {
  id: string;
  returnId: string;
  productId: string;
  location: string;
  holdingDays: number;
  matchScore: number;
  status: string;
  createdAt: string;
}

// ---- Match agent ----
export interface MatchAgentRequest {
  productId: string;
  productName: string;
  category: string;
  location: string;
  condition: string;
}
export interface MatchDetail {
  factor: string;
  points: number;
  reason: string;
}
export interface MatchAgentResponse {
  matchScore: number;
  recommendation: string;
  confidence: number;
  distanceSavedKm: number;
  costSaved: number;
  co2Saved: number;
  explanation: string;
  channel: string;
  expectedDaysToSell: number;
  matchDetails: MatchDetail[];
}

// ---- Integration pipeline ----
export interface ReturnProcessingRequest {
  packageId: string;
  productName: string;
  category: string;
  returnReason: string;
  location: string;
  imageBase64?: string | null;
  additionalContext?: string | null;
  condition?: string | null;
  holdingDaysCompleted?: number | null;
  pickupDate?: string | null;
  basePrice?: number | null;
}
export interface ImageValidationResult {
  condition: string;
  damageScore: number;
  eligible: boolean;
  confidence: number;
  remarks: string;
}
export interface MatchResult {
  matchScore: number;
  recommendation: string;
  confidence: number;
  explanation: string;
  channel: string;
  expectedDaysToSell: number;
}
export interface RootCauseResult {
  rootCause: string;
  recommendation: string;
  impact: string;
}
export interface SavingsSummary {
  distanceSavedKm: number;
  costSaved: number;
  co2SavedKg: number;
}
export interface LocalListing {
  reserved: boolean;
  channel: string;
  listingReference: string;
  expectedDaysToSell: number;
  listedPrice: number;
}
export interface HoldingClockResult {
  holdingDay: number;
  daysRemaining: number;
  isExpired: boolean;
  autoReturnTriggered: boolean;
  clockStatus: string;
  message: string;
}
export interface PolicyComplianceResult {
  resaleAllowed: boolean;
  isRestrictedCategory: boolean;
  policyRef: string;
  policyName: string;
  reason: string;
  retrievalScore: number;
  retrievedSnippet: string;
}
export interface DiversionDecision {
  action: string;
  basePrice: number;
  suggestedPrice: number;
  priceAdjustmentPct: number;
  searchRadiusKm: number;
  escalated: boolean;
  reasoning: string;
  sellProbability?: number;
  clearanceRisk?: number;
}
export interface DecisionConfidence {
  score: number;
  band: string;
  shouldEscalate: boolean;
  factors: string[];
}
export interface RevenueOpportunity {
  freightAvoided: number;
  resaleMargin: number;
  resaleServiceFee: number;
  co2ValueInr: number;
  aiCost: number;
  totalNetValue: number;
}
export interface AutoApprovalResult {
  route: string;
  requiresHumanReview: boolean;
  confidenceScore: number;
  itemValue: number;
  sampledForQaAudit: boolean;
  reason: string;
}
export interface Citation {
  sourceType: string;
  refId: string;
  snippet: string;
}
export interface ReturnProcessingResponse {
  returnRequestId: string;
  packageId: string;
  status: string;
  imageValidation?: ImageValidationResult | null;
  hyperlocalMatch?: MatchResult | null;
  rootCauseAnalysis?: RootCauseResult | null;
  savings: SavingsSummary;
  holdingClock?: HoldingClockResult | null;
  policyCompliance?: PolicyComplianceResult | null;
  diversion?: DiversionDecision | null;
  decisionConfidence?: DecisionConfidence | null;
  autoApproval?: AutoApprovalResult | null;
  revenueOpportunity?: RevenueOpportunity | null;
  listing?: LocalListing | null;
  citations: Citation[];
  processedAt: string;
}

// ---- Root cause clustering ----
export interface ClusterReturnItem {
  category: string;
  productName: string;
  returnReason: string;
  location: string;
}
export interface ReturnCluster {
  category: string;
  dominantReason: string;
  count: number;
  percentage: number;
  topLocation: string;
  estimatedAnnualImpact: number;
  fixTicket: string;
}
export interface ReturnClusterResult {
  totalReturns: number;
  clusters: ReturnCluster[];
}

// ---- Business explanation ----
export interface BusinessExplanationRequest {
  productName: string;
  category?: string;
  demandScore?: number;
  distanceSavedKm?: number;
  costSaved?: number;
  co2Saved?: number;
  recommendation?: string;
  matchScore?: number;
}
export interface BusinessExplanationResponse {
  explanation: string;
  summary: string;
  keyBenefits: string[];
}

// ---- Feedback ----
export interface FeedbackSummary {
  total: number;
  accepted: number;
  modified: number;
  rejected: number;
  acceptRate: number;
  topCorrectedFields: { field: string; count: number }[];
  autoApproval: any;
}
export interface FeedbackRequest {
  returnRequestId?: string | null;
  action: 'Accept' | 'Modify' | 'Reject';
  correctedField?: string | null;
  originalValue?: string | null;
  correctedValue?: string | null;
  associateId?: string | null;
  notes?: string | null;
}

// ---- Segment analytics (partner portal) ----
export interface SegmentReason {
  reason: string;
  count: number;
  share: number;
  topLocation: string;
  estimatedAnnualImpact: number;
}
export interface SegmentTrendPoint {
  label: string;
  count: number;
}
export interface SegmentAnalytics {
  segment: string;
  totalReturns: number;
  itemsResold: number;
  diversionRate: number;
  revenueRecovered: number;
  co2SavedKg: number;
  distanceSavedKm: number;
  avgMatchScore: number;
  avgConfidence: number;
  avgDaysToSell: number;
  topReasons: SegmentReason[];
  trend: SegmentTrendPoint[];
}
export interface LocationAnalytics {
  location: string;
  returns: number;
  costRecovered: number;
  co2SavedKg: number;
  avgMatchScore: number;
}

// ---- Packages ----
export interface PackageDto {
  id: string;
  trackingNumber: string;
  senderName: string;
  recipientName: string;
  status: string;
  weight: number;
  isReturnable: boolean;
}

// ---- Local buyers (hyperlocal demand) ----
export interface BuyerDto {
  name: string;
  zone: string;
  distance: string;
  delivery: string;
  score: number;
}

// ---- Hub buyers directory (Buyers page) ----
export interface HubBuyerDto {
  buyerId: string;
  buyerName: string;
  hub: string;
  zone: string;
  distanceKm: number;
  estimatedDeliveryHours: number;
  demandScore: number;
  preferredCategory: string;
  recommendation: string;
}
export interface BuyerListResponse {
  hub: string;
  buyers: HubBuyerDto[];
}

// ---- Dashboard trend (Trends page) ----
export interface DashboardTrendPoint {
  date: string;
  returns: number;
  localMatches: number;
  costSaved: number;
  distanceSavedKm: number;
  co2SavedKg: number;
}

// ---- Agent telemetry (Agent Performance page) ----
export interface AgentTelemetry {
  agentName: string;
  totalRuns: number;
  successfulRuns: number;
  precisionRate: number;
  escalationRate: number;
  averageResponseTime: number;
}

/**
 * Single gateway to the UPS ReLoop Nexus API.
 * Every method unwraps the ApiResponse envelope and returns the payload,
 * so components deal only with domain data. Callers add catchError to fall
 * back to demo data when the backend is offline.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiBase;

  private unwrap<T>(obs: Observable<ApiResponse<T>>): Observable<T> {
    return obs.pipe(map((r) => r.data as T));
  }

  // Dashboard
  getDashboardMetrics(): Observable<DashboardMetrics> {
    return this.unwrap(this.http.get<ApiResponse<DashboardMetrics>>(`${this.base}/dashboard/metrics`));
  }

  // Debug data tables
  getReturns(): Observable<DebugDataResult<DebugReturn>> {
    return this.unwrap(this.http.get<ApiResponse<DebugDataResult<DebugReturn>>>(`${this.base}/debug/returns`));
  }
  getMatches(): Observable<DebugDataResult<DebugMatch>> {
    return this.unwrap(this.http.get<ApiResponse<DebugDataResult<DebugMatch>>>(`${this.base}/debug/matches`));
  }
  getInventory(): Observable<DebugDataResult<DebugInventory>> {
    return this.unwrap(this.http.get<ApiResponse<DebugDataResult<DebugInventory>>>(`${this.base}/debug/inventory`));
  }
  getPackages(): Observable<PackageDto[]> {
    return this.unwrap(this.http.get<ApiResponse<PackageDto[]>>(`${this.base}/packages`));
  }

  /** Hyperlocal buyers near a hub. Backend endpoint pending — callers fall back to seed data. */
  getBuyers(hub: string): Observable<BuyerDto[]> {
    return this.unwrap(
      this.http.get<ApiResponse<BuyerDto[]>>(`${this.base}/buyers`, { params: { hub } }),
    );
  }

  // Agents
  findMatch(req: MatchAgentRequest): Observable<MatchAgentResponse> {
    return this.unwrap(this.http.post<ApiResponse<MatchAgentResponse>>(`${this.base}/matchagent/find-match`, req));
  }
  processReturn(req: ReturnProcessingRequest): Observable<ReturnProcessingResponse> {
    return this.unwrap(
      this.http.post<ApiResponse<ReturnProcessingResponse>>(`${this.base}/integration/process-return`, req),
    );
  }
  clusterReturns(returns: ClusterReturnItem[]): Observable<ReturnClusterResult> {
    return this.unwrap(
      this.http.post<ApiResponse<ReturnClusterResult>>(`${this.base}/rootcauseagent/cluster`, { returns }),
    );
  }
  explainBusiness(req: BusinessExplanationRequest): Observable<BusinessExplanationResponse> {
    return this.unwrap(
      this.http.post<ApiResponse<BusinessExplanationResponse>>(`${this.base}/businessexplanation`, req),
    );
  }
  getFeedbackSummary(): Observable<FeedbackSummary> {
    return this.unwrap(this.http.get<ApiResponse<FeedbackSummary>>(`${this.base}/feedback/summary`));
  }
  submitFeedback(req: FeedbackRequest): Observable<any> {
    return this.unwrap(this.http.post<ApiResponse<any>>(`${this.base}/feedback`, req));
  }
  getSegments(): Observable<SegmentAnalytics[]> {
    return this.unwrap(this.http.get<ApiResponse<SegmentAnalytics[]>>(`${this.base}/dashboard/segments`));
  }
  getLocations(): Observable<LocationAnalytics[]> {
    return this.unwrap(this.http.get<ApiResponse<LocationAnalytics[]>>(`${this.base}/dashboard/locations`));
  }
  getHubBuyers(hub: string): Observable<BuyerListResponse> {
    return this.unwrap(this.http.get<ApiResponse<BuyerListResponse>>(`${this.base}/buyers?hub=${encodeURIComponent(hub)}`));
  }
  getDashboardTrend(days = 30): Observable<DashboardTrendPoint[]> {
    return this.unwrap(this.http.get<ApiResponse<DashboardTrendPoint[]>>(`${this.base}/dashboard/trend?days=${days}`));
  }
  getAgentTelemetry(): Observable<AgentTelemetry[]> {
    return this.unwrap(this.http.get<ApiResponse<AgentTelemetry[]>>(`${this.base}/dashboard/agent-telemetry`));
  }
}
