import type { Card } from '@prisma/client';

/**
 * One sold listing as retrieved from a price source, before it's written to
 * the `Sale` table. Field names mirror the AgentSource JSON schema exactly
 * (see AgentSource.ts) — `url` rather than `sourceUrl`, `date` rather than
 * `saleDate` — so a source implementation can return the model's shape
 * unchanged; the CLI/API layer maps this onto the Prisma `Sale` fields when
 * persisting.
 */
export interface RawSale {
  /** ISO date string, YYYY-MM-DD. */
  date: string;
  /** Final sale price in USD, excluding shipping. */
  price: number;
  /** Exact listing title, as found. */
  title: string;
  /** "RAW" | "PSA 10" | "BGS 9.5" | "SGC 9" | etc — exact grade string. */
  grade: string;
  marketplace: string;
  /** The retrieved URL. Every RawSale a source returns must have one. */
  url: string;
  /** Optional caveats, e.g. "price includes bundled shipping". */
  notes?: string;
}

/**
 * A source of comp data for a Card + grade. Implementations retrieve sold
 * listings; they never compute a valuation — that's `computeValuation`'s
 * job (lib/valuation), applied deterministically to whatever `Sale` rows
 * exist in the database.
 */
export interface PriceSource {
  name: string;
  fetchSales(card: Card, grade: string): Promise<RawSale[]>;
}
