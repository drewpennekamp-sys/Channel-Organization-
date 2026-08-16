/**
 * Minimal shape the scorer needs from a Sale row. Deliberately not the
 * Prisma `Sale` model itself, so this pure function stays independent of
 * the DB layer and is trivial to feed fixtures into from tests.
 */
export interface ScoringSale {
  id: string;
  price: number;
  saleDate: Date;
  grade: string;
}

/**
 * Output of `computeValuation`. Mirrors the fields the Prisma `Valuation`
 * model stores, minus the DB-assigned id/copyOwnedId/computedAt.
 */
export interface ScoringResult {
  value: number | null;
  low: number | null;
  high: number | null;
  /**
   * Count of sales that passed the 180-day + exact-grade filter — the
   * number the UI shows as "n=X", including any later trimmed as
   * outliers. This is "how many confirmed comps exist", not "how many
   * fed the final number" (see `saleIdsUsed` for that).
   */
  sampleSize: number;
  sufficient: boolean;
  /** Scoring algorithm version tag, stored so future changes are visible in history. */
  method: string;
  /**
   * IDs of the sales that actually fed value/low/high — i.e. post-trim.
   * This is the reproducibility record: re-running the scorer against
   * exactly these Sale rows must reproduce this Valuation.
   */
  saleIdsUsed: string[];
}
