/**
 * Unit tests for EsgScoreService.
 * Runner: Vitest (globals enabled via tsconfig.spec.json).
 *
 * Covers:
 *  - Grade boundaries (A+, A, B, C, D)
 *  - Normalisation capping at 100
 *  - Fraction diversion rate (0-1) auto-conversion
 *  - Zero inputs
 *  - Weighted contribution arithmetic
 *  - Label, colour, bgColor, borderColor mapping per grade
 *  - Breakdown dimension structure
 */

import { TestBed } from '@angular/core/testing';
import { EsgScoreService, EsgInput, EsgGrade } from './esg-score.service';

// ---- Test factory helpers ----

/** Build an EsgInput that targets a particular weighted composite score. */
function inputForScore(targetPercent: number): EsgInput {
  // Drive all four dimensions uniformly so the composite equals targetPercent.
  // Each benchmark × (targetPercent / 100) achieves a sub-score of targetPercent,
  // and the weighted sum of four identical sub-scores = targetPercent.
  return {
    diversionRate:   targetPercent,            // benchmark 100  → sub-score = targetPercent
    co2SavedKg:      10_000 * (targetPercent / 100),
    distanceSavedKm: 200_000 * (targetPercent / 100),
    costSaved:       2_000_000 * (targetPercent / 100),
  };
}

// ---- Service setup ----

describe('EsgScoreService', () => {
  let service: EsgScoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EsgScoreService);
  });

  // ========================
  // Grade boundary tests
  // ========================

  describe('toGrade()', () => {
    it('returns A+ when score is exactly 90', () => {
      expect(service.toGrade(90)).toBe('A+');
    });

    it('returns A+ when score is above 90', () => {
      expect(service.toGrade(97.5)).toBe('A+');
    });

    it('returns A when score is exactly 80', () => {
      expect(service.toGrade(80)).toBe('A');
    });

    it('returns A when score is 89.9', () => {
      expect(service.toGrade(89.9)).toBe('A');
    });

    it('returns B when score is exactly 70', () => {
      expect(service.toGrade(70)).toBe('B');
    });

    it('returns B when score is 79.9', () => {
      expect(service.toGrade(79.9)).toBe('B');
    });

    it('returns C when score is exactly 60', () => {
      expect(service.toGrade(60)).toBe('C');
    });

    it('returns C when score is 69.9', () => {
      expect(service.toGrade(69.9)).toBe('C');
    });

    it('returns D when score is 59.9', () => {
      expect(service.toGrade(59.9)).toBe('D');
    });

    it('returns D when score is 0', () => {
      expect(service.toGrade(0)).toBe('D');
    });
  });

  // ========================
  // Label mapping
  // ========================

  describe('toLabel()', () => {
    const cases: [EsgGrade, string][] = [
      ['A+', 'Exceptional'],
      ['A',  'Very Good'],
      ['B',  'Good'],
      ['C',  'Satisfactory'],
      ['D',  'Needs Improvement'],
    ];

    cases.forEach(([grade, expected]) => {
      it(`returns "${expected}" for grade ${grade}`, () => {
        expect(service.toLabel(grade)).toBe(expected);
      });
    });
  });

  // ========================
  // Colour mapping
  // ========================

  describe('toColor()', () => {
    it('returns the emerald foreground colour for A+', () => {
      expect(service.toColor('A+')).toBe('#065F46');
    });

    it('returns the dark-green foreground colour for A', () => {
      expect(service.toColor('A')).toBe('#14532D');
    });

    it('returns blue for B', () => {
      expect(service.toColor('B')).toBe('#1D4ED8');
    });

    it('returns amber for C', () => {
      expect(service.toColor('C')).toBe('#92400E');
    });

    it('returns red for D', () => {
      expect(service.toColor('D')).toBe('#991B1B');
    });
  });

  describe('toBgColor()', () => {
    it('returns emerald background for A+', () => {
      expect(service.toBgColor('A+')).toBe('#D1FAE5');
    });

    it('returns a light-red background for D', () => {
      expect(service.toBgColor('D')).toBe('#FEE2E2');
    });
  });

  describe('toBorderColor()', () => {
    it('returns teal border for A+', () => {
      expect(service.toBorderColor('A+')).toBe('#6EE7B7');
    });

    it('returns light-red border for D', () => {
      expect(service.toBorderColor('D')).toBe('#FCA5A5');
    });
  });

  // ========================
  // calculate() — composite
  // ========================

  describe('calculate()', () => {

    it('produces an A+ grade when all metrics are at benchmark', () => {
      const result = service.calculate(inputForScore(100));
      expect(result.grade).toBe('A+');
      expect(result.score).toBeGreaterThanOrEqual(90);
    });

    it('produces an A grade around the 85 % input level', () => {
      const result = service.calculate(inputForScore(85));
      expect(result.grade).toBe('A');
    });

    it('produces a B grade around the 75 % input level', () => {
      const result = service.calculate(inputForScore(75));
      expect(result.grade).toBe('B');
    });

    it('produces a C grade around the 65 % input level', () => {
      const result = service.calculate(inputForScore(65));
      expect(result.grade).toBe('C');
    });

    it('produces a D grade around the 50 % input level', () => {
      const result = service.calculate(inputForScore(50));
      expect(result.grade).toBe('D');
    });

    it('score is capped at 100 even when metrics exceed benchmarks', () => {
      const result = service.calculate({
        diversionRate:   200,      // 2× benchmark
        co2SavedKg:      100_000,  // 10× benchmark
        distanceSavedKm: 500_000,  // 2.5× benchmark
        costSaved:       5_000_000, // 2.5× benchmark
      });
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.grade).toBe('A+');
    });

    it('returns score 0 and grade D for all-zero inputs', () => {
      const result = service.calculate({
        diversionRate: 0,
        co2SavedKg: 0,
        distanceSavedKm: 0,
        costSaved: 0,
      });
      expect(result.score).toBe(0);
      expect(result.grade).toBe('D');
    });

    // ---- Fraction diversion rate auto-conversion ----

    it('auto-converts fraction diversionRate (0-1) to percentage', () => {
      const fraction = service.calculate({
        diversionRate: 0.85,  // should be treated as 85 %
        co2SavedKg: 0,
        distanceSavedKm: 0,
        costSaved: 0,
      });
      const percentage = service.calculate({
        diversionRate: 85,    // explicit 85 %
        co2SavedKg: 0,
        distanceSavedKm: 0,
        costSaved: 0,
      });
      expect(fraction.score).toBeCloseTo(percentage.score, 1);
    });

    // ---- Breakdown structure ----

    it('returns exactly 4 breakdown entries', () => {
      const result = service.calculate(inputForScore(80));
      expect(result.breakdown).toHaveLength(4);
    });

    it('breakdown weights sum to 1.0', () => {
      const result = service.calculate(inputForScore(80));
      const sumWeights = result.breakdown.reduce((s, b) => s + b.weight, 0);
      expect(sumWeights).toBeCloseTo(1.0, 5);
    });

    it('breakdown contributions sum approximately to the total score', () => {
      const result = service.calculate(inputForScore(80));
      const sumContribs = result.breakdown.reduce((s, b) => s + b.contribution, 0);
      expect(sumContribs).toBeCloseTo(result.score, 0);
    });

    it('each breakdown entry has required shape', () => {
      const result = service.calculate(inputForScore(90));
      result.breakdown.forEach(b => {
        expect(b).toHaveProperty('dimension');
        expect(b).toHaveProperty('label');
        expect(b).toHaveProperty('rawValue');
        expect(b).toHaveProperty('score');
        expect(b).toHaveProperty('weight');
        expect(b).toHaveProperty('contribution');
        expect(b.score).toBeGreaterThanOrEqual(0);
        expect(b.score).toBeLessThanOrEqual(100);
      });
    });

    // ---- Result shape ----

    it('result includes correct colour fields for its grade', () => {
      const result = service.calculate(inputForScore(95));
      expect(result.grade).toBe('A+');
      expect(result.color).toBe(service.toColor('A+'));
      expect(result.bgColor).toBe(service.toBgColor('A+'));
      expect(result.borderColor).toBe(service.toBorderColor('A+'));
    });

    it('result label matches toLabel output', () => {
      const result = service.calculate(inputForScore(60));
      expect(result.label).toBe(service.toLabel(result.grade));
    });

    // ---- Realistic API data ----

    it('handles realistic production metrics and returns a plausible grade', () => {
      const result = service.calculate({
        diversionRate:   71.6,     // 71.6 % diversion
        co2SavedKg:      428_000,  // 428 tons
        distanceSavedKm: 125_000,  // 125 000 km
        costSaved:       1_250_000, // ₹1.25 M
      });
      // All metrics are well above mid-point → expect at least B
      expect(['A+', 'A', 'B']).toContain(result.grade);
    });
  });
});
