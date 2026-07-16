import { Injectable } from '@angular/core';

// ---- Public data shapes ----

/** Raw inputs for ESG score calculation. All values are raw API units. */
export interface EsgInput {
  /** Diversion rate as a percentage 0–100 (or fraction 0–1 — auto-normalised). */
  diversionRate: number;
  /** CO₂ avoided in kilograms. */
  co2SavedKg: number;
  /** Logistics distance avoided in kilometres. */
  distanceSavedKm: number;
  /** Net cost / revenue savings in INR. */
  costSaved: number;
}

/** Per-dimension sub-score (0–100) used for breakdown display. */
export interface EsgBreakdown {
  dimension: string;
  label: string;
  rawValue: string;
  score: number;        // 0–100
  weight: number;       // 0–1
  contribution: number; // score × weight
}

/** Full ESG result returned by the service. */
export interface EsgResult {
  score: number;        // 0–100 weighted composite
  grade: EsgGrade;
  label: string;
  color: string;        // CSS foreground colour
  bgColor: string;      // CSS background colour
  borderColor: string;  // CSS accent colour
  breakdown: EsgBreakdown[];
}

export type EsgGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

// ---- Normalisation benchmarks ----
// These are calibrated reference maxima. Scores beyond the benchmark
// are capped at 100 — a platform exceeding these is still A+.

const BENCHMARKS = {
  /** 100 % diversion rate = 100 pts */
  diversionRate: 100,
  /** 10 000 kg CO₂ saved = 100 pts */
  co2SavedKg: 10_000,
  /** 200 000 km distance saved = 100 pts */
  distanceSavedKm: 200_000,
  /** $ 2 000 000 cost saved = 100 pts */
  costSaved: 2_000_000,
} as const;

// ---- Dimension weights (must sum to 1.0) ----
const WEIGHTS = {
  diversionRate:  0.35,
  co2SavedKg:     0.30,
  distanceSavedKm: 0.20,
  costSaved:      0.15,
} as const;

@Injectable({ providedIn: 'root' })
export class EsgScoreService {

  /**
   * Compute the composite ESG score from four live metrics.
   *
   * Each dimension is normalised against a calibrated benchmark,
   * clamped to [0, 100] and multiplied by its weight.
   *
   * Grade rules (per spec):
   *   A+ ≥ 90 | A ≥ 80 | B ≥ 70 | C ≥ 60 | D < 60
   */
  calculate(input: EsgInput): EsgResult {
    // Auto-normalise fraction diversion rates (0-1 → 0-100)
    const divRate = input.diversionRate <= 1 && input.diversionRate >= 0
      ? input.diversionRate * 100
      : input.diversionRate;

    const dimensions: { key: keyof typeof BENCHMARKS; label: string; rawValue: string }[] = [
      {
        key: 'diversionRate',
        label: 'Diversion Rate',
        rawValue: `${divRate.toFixed(1)} %`,
      },
      {
        key: 'co2SavedKg',
        label: 'CO₂ Saved',
        rawValue: this.formatCo2(input.co2SavedKg),
      },
      {
        key: 'distanceSavedKm',
        label: 'Distance Saved',
        rawValue: `${Math.round(input.distanceSavedKm).toLocaleString()} km`,
      },
      {
        key: 'costSaved',
        label: 'Cost Saved',
        rawValue: this.formatMoney(input.costSaved),
      },
    ];

    const rawValues: Record<string, number> = {
      diversionRate:  divRate,
      co2SavedKg:     input.co2SavedKg,
      distanceSavedKm: input.distanceSavedKm,
      costSaved:      input.costSaved,
    };

    const breakdown: EsgBreakdown[] = dimensions.map(d => {
      const score = Math.min(100, Math.max(0, (rawValues[d.key] / BENCHMARKS[d.key]) * 100));
      const weight = WEIGHTS[d.key];
      return {
        dimension: d.key,
        label: d.label,
        rawValue: d.rawValue,
        score: Math.round(score * 10) / 10,
        weight,
        contribution: Math.round(score * weight * 10) / 10,
      };
    });

    const totalScore = Math.min(
      100,
      Math.round(breakdown.reduce((sum, b) => sum + b.contribution, 0) * 10) / 10,
    );

    const grade = this.toGrade(totalScore);

    return {
      score: totalScore,
      grade,
      label: this.toLabel(grade),
      color: this.toColor(grade),
      bgColor: this.toBgColor(grade),
      borderColor: this.toBorderColor(grade),
      breakdown,
    };
  }

  /** Map a numeric score to a grade letter. */
  toGrade(score: number): EsgGrade {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  }

  /** Human-readable label per grade. */
  toLabel(grade: EsgGrade): string {
    const labels: Record<EsgGrade, string> = {
      'A+': 'Exceptional',
      'A':  'Very Good',
      'B':  'Good',
      'C':  'Satisfactory',
      'D':  'Needs Improvement',
    };
    return labels[grade];
  }

  /** CSS foreground colour per grade. */
  toColor(grade: EsgGrade): string {
    const map: Record<EsgGrade, string> = {
      'A+': '#065F46',
      'A':  '#14532D',
      'B':  '#1D4ED8',
      'C':  '#92400E',
      'D':  '#991B1B',
    };
    return map[grade];
  }

  /** CSS background colour per grade. */
  toBgColor(grade: EsgGrade): string {
    const map: Record<EsgGrade, string> = {
      'A+': '#D1FAE5',
      'A':  '#DCFCE7',
      'B':  '#DBEAFE',
      'C':  '#FEF3C7',
      'D':  '#FEE2E2',
    };
    return map[grade];
  }

  /** CSS border/accent colour per grade. */
  toBorderColor(grade: EsgGrade): string {
    const map: Record<EsgGrade, string> = {
      'A+': '#6EE7B7',
      'A':  '#86EFAC',
      'B':  '#93C5FD',
      'C':  '#FCD34D',
      'D':  '#FCA5A5',
    };
    return map[grade];
  }

  // ---- Private formatting helpers ----

  private formatMoney(v: number): string {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)} M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)} K`;
    return `$${Math.round(v)}`;
  }

  private formatCo2(kg: number): string {
    return kg >= 1_000
      ? `${(kg / 1_000).toFixed(1)} t`
      : `${Math.round(kg)} kg`;
  }
}
