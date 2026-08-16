import { prisma } from '@/lib/db';
import type { CatalogCard, CatalogParallel } from '@prisma/client';
import type { BackReadResult } from '@/lib/scanner/backRead';
import type { ScanMethod } from '@/lib/scanner/types';

/**
 * Pass 2 — resolve Pass 1's raw identifiers against the catalog. Pure
 * lookup, no model call: this is deterministic code on purpose, per the
 * app's core rule (the model reads facts, code decides). The catalog isn't
 * bulk-seeded — it grows one CatalogCard at a time from confirmed scans
 * (see app/api/cards/route.ts), so "no match" is the expected outcome for
 * a set that hasn't been scanned before, not a failure.
 *
 * Split into a DB-fetching half (resolveCatalog) and a pure matching half
 * (pickCatalogResolution) so the actual resolution-order logic is testable
 * without a database — see catalogResolve.test.ts.
 */

export type CatalogCardWithParallels = CatalogCard & { parallels: CatalogParallel[] };

export interface CatalogResolution {
  catalogCard: CatalogCardWithParallels | null;
  method: ScanMethod;
}

/** "EA-BB" -> "EA", "BDC-42" -> "BDC", "159" -> "" (no prefix). */
export function extractCardNumberPrefix(cardNumber: string): string {
  const match = cardNumber.match(/^([A-Za-z]+)-/);
  return match ? match[1] : '';
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * The resolution order itself, over an already-fetched candidate pool —
 * pure and DB-free. `exactNumberCandidates` should be every CatalogCard
 * whose cardNumber matches Pass 1's reading exactly; `prefixCandidates`
 * every CatalogCard sharing its cardNumberPrefix. Tried in order; the
 * first rule to find a unique match wins.
 */
export function pickCatalogResolution(
  backRead: BackReadResult,
  exactNumberCandidates: CatalogCardWithParallels[],
  prefixCandidates: CatalogCardWithParallels[],
): CatalogResolution {
  // Rule 1: exact match on (brand, year, set, cardNumber).
  if (backRead.brandLine && backRead.setName && backRead.copyrightYear) {
    const exact = exactNumberCandidates.find(
      (c) => sameText(c.brand, backRead.brandLine!) && sameText(c.set, backRead.setName!) && c.year === backRead.copyrightYear,
    );
    if (exact) {
      console.log(`[catalogResolve] Resolved via catalog-exact: ${exact.id}`);
      return { catalogCard: exact, method: 'catalog-exact' };
    }
  }

  // Rule 2: (cardNumber, player, year ± 1) — resolves the copyright-year offset.
  if (backRead.player && backRead.copyrightYear) {
    const candidates = exactNumberCandidates.filter(
      (c) => sameText(c.player, backRead.player!) && Math.abs(c.year - backRead.copyrightYear!) <= 1,
    );
    if (candidates.length === 1) {
      console.log(`[catalogResolve] Resolved via catalog-year-offset: ${candidates[0].id}`);
      return { catalogCard: candidates[0], method: 'catalog-year-offset' };
    }
    if (candidates.length > 1) {
      console.log(`[catalogResolve] catalog-year-offset ambiguous (${candidates.length} candidates) — falling through.`);
    }
  }

  // Rule 3: (cardNumberPrefix, player) — the prefix usually pins the insert set.
  if (backRead.player) {
    const candidates = prefixCandidates.filter((c) => sameText(c.player, backRead.player!));
    if (candidates.length === 1) {
      console.log(`[catalogResolve] Resolved via catalog-prefix: ${candidates[0].id}`);
      return { catalogCard: candidates[0], method: 'catalog-prefix' };
    }
    if (candidates.length > 1) {
      console.log(`[catalogResolve] catalog-prefix ambiguous (${candidates.length} candidates) — falling through.`);
    }
  }

  console.log(`[catalogResolve] No catalog match for cardNumber="${backRead.cardNumber}" — unresolved.`);
  return { catalogCard: null, method: 'unresolved' };
}

const includeParallelsOrdered = { parallels: { orderBy: { rarityOrder: 'asc' as const } } };

export async function resolveCatalog(backRead: BackReadResult): Promise<CatalogResolution> {
  const cardNumber = backRead.cardNumber?.trim();
  if (!cardNumber) {
    console.log('[catalogResolve] No cardNumber from Pass 1 — cannot resolve.');
    return { catalogCard: null, method: 'unresolved' };
  }

  const prefix = extractCardNumberPrefix(cardNumber);
  const [exactNumberCandidates, prefixCandidates] = await Promise.all([
    prisma.catalogCard.findMany({ where: { cardNumber }, include: includeParallelsOrdered }),
    prefix
      ? prisma.catalogCard.findMany({ where: { cardNumberPrefix: prefix }, include: includeParallelsOrdered })
      : Promise.resolve([]),
  ]);

  return pickCatalogResolution(backRead, exactNumberCandidates, prefixCandidates);
}

/**
 * Deterministic parallel resolution from a serial-numbering stamp, tried
 * before ever invoking Pass 3's vision call. If Pass 1 already read a
 * print run (e.g. "12/99") and exactly one of the catalog's known
 * parallels for this card carries that print run, that's decisive — no
 * need to ask a model to judge color under uncertain lighting.
 */
export function resolveParallelFromSerial(
  serialNumbering: string | null,
  parallels: CatalogParallel[],
): CatalogParallel | null {
  if (!serialNumbering) return null;
  const match = serialNumbering.match(/\/(\d+)/);
  if (!match) return null;
  const printRun = Number(match[1]);
  const candidates = parallels.filter((p) => p.printRun === printRun);
  return candidates.length === 1 ? candidates[0] : null;
}
