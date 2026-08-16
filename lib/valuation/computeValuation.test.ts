import { describe, expect, it } from 'vitest';
import { computeValuation, SCORING_METHOD } from './computeValuation';
import type { ScoringSale } from './types';

const NOW = new Date('2026-08-16T00:00:00.000Z');

function daysBefore(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function sale(id: string, price: number, daysAgo: number, grade = 'RAW'): ScoringSale {
  return { id, price, saleDate: daysBefore(daysAgo), grade };
}

describe('computeValuation', () => {
  describe('insufficient data (n < 3)', () => {
    it('returns sufficient: false and null value for a two-sale thin market', () => {
      const sales = [sale('s1', 100, 10), sale('s2', 120, 20)];

      const result = computeValuation(sales, 'RAW', NOW);

      expect(result.sufficient).toBe(false);
      expect(result.value).toBeNull();
      expect(result.low).toBeNull();
      expect(result.high).toBeNull();
      expect(result.sampleSize).toBe(2);
      // Raw sales are still surfaced for the UI even though no number is computed.
      expect(result.saleIdsUsed.sort()).toEqual(['s1', 's2']);
      expect(result.method).toBe(SCORING_METHOD);
    });

    it('returns sufficient: false with zero sales', () => {
      const result = computeValuation([], 'RAW', NOW);

      expect(result.sufficient).toBe(false);
      expect(result.value).toBeNull();
      expect(result.sampleSize).toBe(0);
      expect(result.saleIdsUsed).toEqual([]);
    });

    it('never falls back to a mean or any other estimate when insufficient', () => {
      // A naive implementation might average what little it has. Assert
      // explicitly that this never happens: value must stay null.
      const sales = [sale('s1', 100, 10), sale('s2', 100000, 20)];
      const result = computeValuation(sales, 'RAW', NOW);
      expect(result.value).toBeNull();
    });
  });

  describe('single shill sale at 10x', () => {
    it('resists a 10x outlier via the median even when n < 8 (no trim applies)', () => {
      // n=5, below the trim threshold — the median itself must be the
      // thing protecting against the shill sale, not trimming.
      const sales = [
        sale('s1', 95, 5),
        sale('s2', 100, 5),
        sale('s3', 105, 5),
        sale('s4', 110, 5),
        sale('shill', 1050, 5), // 10x a normal ~$105 sale
      ];

      const result = computeValuation(sales, 'RAW', NOW);

      expect(result.sufficient).toBe(true);
      expect(result.sampleSize).toBe(5);
      // A mean here would be ~292, wildly inflated by the shill sale.
      expect(result.value).toBe(105);
      expect(result.value).toBeLessThan(200);
      // The shill sale is real and was found, so it still counts toward
      // sampleSize/saleIdsUsed — the median just isn't dragged by it.
      expect(result.saleIdsUsed).toContain('shill');
    });

    it('trims a 10x outlier out of saleIdsUsed once n >= 8', () => {
      const sales = [
        sale('s1', 95, 5),
        sale('s2', 98, 5),
        sale('s3', 100, 5),
        sale('s4', 102, 5),
        sale('s5', 103, 5),
        sale('s6', 105, 5),
        sale('s7', 107, 5),
        sale('s8', 110, 5),
        sale('s9', 112, 5),
        sale('shill', 1000, 5), // 10x, will land at the very top by price
      ];

      const result = computeValuation(sales, 'RAW', NOW);

      expect(result.sufficient).toBe(true);
      // Full pool found, including the shill sale.
      expect(result.sampleSize).toBe(10);
      // 10% of 10 = 1 trimmed from each end -> shill (highest price) and
      // s1 (lowest price) are excluded from the computation set.
      expect(result.saleIdsUsed).not.toContain('shill');
      expect(result.saleIdsUsed).not.toContain('s1');
      expect(result.saleIdsUsed).toHaveLength(8);
      expect(result.value).toBeLessThan(150);
    });
  });

  describe('clean twelve-sale set', () => {
    // Same saleDate for every sale isolates the trim + percentile logic
    // from recency weighting (covered separately below).
    const sales: ScoringSale[] = Array.from({ length: 12 }, (_, i) =>
      sale(`s${i + 1}`, (i + 1) * 100, 5), // 100, 200, ..., 1200
    );

    it('trims the top and bottom 10% (n=12 -> 1 trimmed each side)', () => {
      const result = computeValuation(sales, 'RAW', NOW);

      expect(result.sufficient).toBe(true);
      expect(result.sampleSize).toBe(12);
      expect(result.saleIdsUsed).toHaveLength(10);
      expect(result.saleIdsUsed).not.toContain('s1'); // lowest price, 100
      expect(result.saleIdsUsed).not.toContain('s12'); // highest price, 1200
    });

    it('computes the weighted median/25th/75th on the trimmed, equally-weighted set', () => {
      const result = computeValuation(sales, 'RAW', NOW);

      // Trimmed set (equal weights, all same saleDate): 200..1100 step 100.
      // Inverse-CDF walk over 10 equally-weighted items (each 10% of
      // total): median lands on the 5th item, 25th on the 3rd, 75th on
      // the 8th.
      expect(result.value).toBe(600);
      expect(result.low).toBe(400);
      expect(result.high).toBe(900);
      expect(result.low).toBeLessThan(result.value as number);
      expect(result.value).toBeLessThan(result.high as number);
    });
  });

  describe('trim threshold boundary', () => {
    it('does not trim below n=8', () => {
      const sales = Array.from({ length: 7 }, (_, i) => sale(`s${i + 1}`, (i + 1) * 100, 5));
      const result = computeValuation(sales, 'RAW', NOW);
      expect(result.saleIdsUsed).toHaveLength(7);
    });

    it('at n=8, 10% floors to 0 so nothing is actually trimmed', () => {
      const sales = Array.from({ length: 8 }, (_, i) => sale(`s${i + 1}`, (i + 1) * 100, 5));
      const result = computeValuation(sales, 'RAW', NOW);
      expect(result.sampleSize).toBe(8);
      expect(result.saleIdsUsed).toHaveLength(8);
    });

    it('at n=10, trims exactly 1 from each end', () => {
      const sales = Array.from({ length: 10 }, (_, i) => sale(`s${i + 1}`, (i + 1) * 100, 5));
      const result = computeValuation(sales, 'RAW', NOW);
      expect(result.saleIdsUsed).toHaveLength(8);
    });
  });

  describe('grade filtering', () => {
    it('excludes sales with a different grade, even at the same price/date', () => {
      const sales = [
        sale('psa10-1', 500, 5, 'PSA 10'),
        sale('psa10-2', 520, 10, 'PSA 10'),
        sale('psa10-3', 510, 15, 'PSA 10'),
        sale('raw-1', 50, 5, 'RAW'),
        sale('raw-2', 55, 10, 'RAW'),
      ];

      const result = computeValuation(sales, 'RAW', NOW);

      // Only 2 RAW sales exist -> insufficient, regardless of the 3
      // PSA 10 sales sitting right there. A PSA 10 sale is never a comp
      // for a raw card.
      expect(result.sufficient).toBe(false);
      expect(result.sampleSize).toBe(2);
      expect(result.saleIdsUsed.sort()).toEqual(['raw-1', 'raw-2']);
    });
  });

  describe('180-day window', () => {
    it('excludes a sale older than 180 days', () => {
      const sales = [sale('s1', 100, 10), sale('s2', 105, 20), sale('s3', 110, 181)];
      const result = computeValuation(sales, 'RAW', NOW);
      expect(result.sampleSize).toBe(2);
      expect(result.saleIdsUsed).not.toContain('s3');
    });

    it('includes a sale exactly at the 180-day boundary', () => {
      const sales = [sale('s1', 100, 10), sale('s2', 105, 20), sale('s3', 110, 180)];
      const result = computeValuation(sales, 'RAW', NOW);
      expect(result.sampleSize).toBe(3);
      expect(result.saleIdsUsed).toContain('s3');
    });

    it('excludes a sale dated in the future relative to now', () => {
      const sales = [sale('s1', 100, 10), sale('s2', 105, 20), sale('s3', 110, -5)];
      const result = computeValuation(sales, 'RAW', NOW);
      expect(result.sampleSize).toBe(2);
      expect(result.saleIdsUsed).not.toContain('s3');
    });
  });

  describe('recency weighting', () => {
    it('weights more recent sales higher, shifting the median toward them', () => {
      // n=3, no trim. Unweighted median would be the middle-priced sale
      // (100). Recency weighting (30-day half-life) should pull the
      // result toward the most recent sale (150) instead.
      const sales = [
        sale('old', 50, 90), // weight = 0.5^3 = 0.125
        sale('mid', 100, 30), // weight = 0.5^1 = 0.5
        sale('recent', 150, 0), // weight = 0.5^0 = 1
      ];

      const result = computeValuation(sales, 'RAW', NOW);

      expect(result.value).toBe(150);
      expect(result.low).toBe(100);
      expect(result.high).toBe(150);
    });
  });

  describe('reproducibility', () => {
    it('is a pure function: identical inputs always produce identical output', () => {
      const sales = Array.from({ length: 12 }, (_, i) => sale(`s${i + 1}`, (i + 1) * 100, 5));

      const first = computeValuation(sales, 'RAW', NOW);
      const second = computeValuation(sales, 'RAW', NOW);

      expect(second).toEqual(first);
    });

    it('reproduces the same Valuation when re-run against only the sales it used', () => {
      const sales = [
        sale('old', 50, 90),
        sale('mid', 100, 30),
        sale('recent', 150, 0),
      ];

      const full = computeValuation(sales, 'RAW', NOW);
      const usedOnly = sales.filter((s) => full.saleIdsUsed.includes(s.id));
      const replay = computeValuation(usedOnly, 'RAW', NOW);

      expect(replay.value).toBe(full.value);
      expect(replay.low).toBe(full.low);
      expect(replay.high).toBe(full.high);
    });
  });
});
