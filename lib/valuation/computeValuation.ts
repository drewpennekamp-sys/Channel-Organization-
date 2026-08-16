import type { ScoringResult, ScoringSale } from './types';

/**
 * Deterministic comp scoring. Given every known Sale for a card, produce a
 * point estimate + range for one grade. This is a pure function — same
 * inputs (including `now`) always produce the same output — so it must
 * never call an LLM, the network, or Date.now() internally. The caller
 * (API route / CLI script) is responsible for retrieving sales and
 * persisting the result.
 *
 * Algorithm (see build spec for rationale):
 *   1. Filter to sales within the last 180 days
 *   2. Filter to exact grade match
 *   3. n < 3 -> insufficient; never fabricate a number
 *   4. Trim top/bottom 10% by price, only once n >= 8
 *   5. Recency-weight each remaining sale: 0.5 ^ (daysAgo / 30)
 *   6. value = weighted median; low/high = weighted 25th/75th percentile
 */

export const SCORING_METHOD = 'weighted-median-180d-v1';

const WINDOW_DAYS = 180;
const MIN_SUFFICIENT_SAMPLE = 3;
const TRIM_MIN_SAMPLE = 8;
const TRIM_FRACTION = 0.1;
const RECENCY_HALF_LIFE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeValuation(
  sales: readonly ScoringSale[],
  targetGrade: string,
  now: Date = new Date(),
): ScoringResult {
  const windowMs = WINDOW_DAYS * MS_PER_DAY;

  // Steps 1-2: 180-day window + exact grade match. Grade comparison is
  // exact string equality on purpose — "PSA 10" and "PSA 9" are not
  // interchangeable, per the AgentSource hard rules.
  const filtered = sales.filter((sale) => {
    const ageMs = now.getTime() - sale.saleDate.getTime();
    return sale.grade === targetGrade && ageMs >= 0 && ageMs <= windowMs;
  });

  // Step 3: insufficient data. Raw (unfiltered-by-trim) sales are still
  // reported via sampleSize/saleIdsUsed so the UI can show what was found
  // even though no number is computed.
  if (filtered.length < MIN_SUFFICIENT_SAMPLE) {
    return {
      value: null,
      low: null,
      high: null,
      sampleSize: filtered.length,
      sufficient: false,
      method: SCORING_METHOD,
      saleIdsUsed: filtered.map((sale) => sale.id),
    };
  }

  // Step 4: trim top/bottom 10% by price, only once n >= 8.
  const sortedByPrice = [...filtered].sort((a, b) => a.price - b.price);
  const trimmed = trimOutliers(sortedByPrice);

  // Step 5: recency weights, computed off the trimmed set (still sorted
  // ascending by price, so weightedPercentile can walk it directly).
  const weighted = trimmed.map((sale) => ({
    sale,
    weight: recencyWeight(sale.saleDate, now),
  }));

  return {
    value: weightedPercentile(weighted, 0.5),
    low: weightedPercentile(weighted, 0.25),
    high: weightedPercentile(weighted, 0.75),
    sampleSize: filtered.length,
    sufficient: true,
    method: SCORING_METHOD,
    saleIdsUsed: trimmed.map((sale) => sale.id),
  };
}

function trimOutliers(sortedByPriceAsc: readonly ScoringSale[]): ScoringSale[] {
  if (sortedByPriceAsc.length < TRIM_MIN_SAMPLE) {
    return [...sortedByPriceAsc];
  }
  const trimCount = Math.floor(sortedByPriceAsc.length * TRIM_FRACTION);
  if (trimCount === 0) {
    return [...sortedByPriceAsc];
  }
  return sortedByPriceAsc.slice(trimCount, sortedByPriceAsc.length - trimCount);
}

function recencyWeight(saleDate: Date, now: Date): number {
  const daysAgo = (now.getTime() - saleDate.getTime()) / MS_PER_DAY;
  return Math.pow(0.5, daysAgo / RECENCY_HALF_LIFE_DAYS);
}

/**
 * Weighted percentile via the inverse-CDF method: walk items in ascending
 * price order accumulating normalized weight, and return the price of the
 * first item at which cumulative weight reaches `percentile`.
 *
 * `items` must already be sorted ascending by price.
 */
function weightedPercentile(
  items: readonly { sale: ScoringSale; weight: number }[],
  percentile: number,
): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  // Every sale within the 180-day window has daysAgo finite and >= 0, so
  // weight = 0.5^(daysAgo/30) is always > 0 — totalWeight === 0 is
  // unreachable in practice. Guarded anyway rather than risking a
  // divide-by-zero if this function is ever reused with different inputs.
  if (totalWeight === 0) {
    const fallbackIndex = Math.min(
      items.length - 1,
      Math.floor(items.length * percentile),
    );
    return items[fallbackIndex].sale.price;
  }

  let cumulative = 0;
  for (const item of items) {
    cumulative += item.weight;
    if (cumulative / totalWeight >= percentile) {
      return item.sale.price;
    }
  }
  // Floating-point edge case: cumulative/totalWeight might land at
  // 0.999999... on the last item. Fall through to it explicitly.
  return items[items.length - 1].sale.price;
}
