import Anthropic from '@anthropic-ai/sdk';
import { checkSlab } from '@/lib/scanner/slabCheck';
import { readBack } from '@/lib/scanner/backRead';
import { resolveCatalog, resolveParallelFromSerial } from '@/lib/scanner/catalogResolve';
import { readParallel } from '@/lib/scanner/parallelRead';
import type { CardImage, ScanResult } from '@/lib/scanner/types';

/**
 * The scanner pipeline: Pass 0 (slab short-circuit) → Pass 1 (back read) →
 * Pass 2 (catalog resolution, deterministic) → Pass 3 (parallel, closed
 * list). Pass 4 (confirmation) is the UI — nothing here ever touches the
 * database; this only produces the result the confirm form pre-fills.
 *
 * Replaces the old lib/vision/identifyCard.ts holistic guess entirely: an
 * unresolved scan returns exactly what Pass 1 actually read, never a
 * confident-looking full record assembled from what a similar card
 * "usually" has.
 */

function emptyResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    confidence: 'unresolved',
    method: 'unresolved',
    year: null,
    brand: null,
    set: null,
    subset: null,
    player: null,
    cardNumber: null,
    parallel: null,
    parallelCandidates: [],
    serialNumbering: null,
    isAuto: null,
    isRelic: null,
    sport: null,
    grade: 'RAW',
    certNumber: null,
    catalogCardId: null,
    rawCopyrightYear: null,
    rawBrandLine: null,
    rawSetName: null,
    ...overrides,
  };
}

export async function scanCard(
  front: CardImage,
  back: CardImage,
  client: Anthropic = new Anthropic(),
): Promise<ScanResult> {
  // Pass 0 — slab short-circuit. Checked against the front photo, where a
  // slab's label is visible in the same shot as the card itself.
  const slab = await checkSlab(front, client);
  if (slab?.isSlab) {
    if (slab.certNumber && slab.grade) {
      return emptyResult({
        confidence: 'exact',
        method: 'cert',
        certNumber: slab.certNumber,
        grade: slab.grade,
      });
    }
    // It's definitely a slab, but the cert/grade didn't read cleanly —
    // don't claim "exact" on a guess. Ask for a retake rather than
    // silently falling through to the catalog pipeline, which can't help
    // here anyway (a slab's back is sealed under the same label).
    console.log('[scanCard] Slab detected but cert/grade did not read cleanly — needs a retake.');
    return emptyResult({
      confidence: 'unresolved',
      method: 'unresolved',
      grade: slab.grade ?? null,
      certNumber: slab.certNumber,
    });
  }

  // Pass 1 — read the identifiers off the back.
  const backRead = await readBack(back, client);
  if (!backRead) {
    console.log('[scanCard] Pass 1 (backRead) failed entirely — unresolved.');
    return emptyResult();
  }

  const rawHints = {
    rawCopyrightYear: backRead.copyrightYear,
    rawBrandLine: backRead.brandLine,
    rawSetName: backRead.setName,
  };

  // Pass 2 — resolve against the catalog. Deterministic; no model call.
  const { catalogCard, method } = await resolveCatalog(backRead);
  if (!catalogCard) {
    return emptyResult({
      method,
      player: backRead.player,
      cardNumber: backRead.cardNumber,
      serialNumbering: backRead.serialNumbering,
      sport: backRead.sport,
      ...rawHints,
    });
  }

  const resolvedBase: Partial<ScanResult> = {
    method,
    year: catalogCard.year,
    brand: catalogCard.brand,
    set: catalogCard.set,
    subset: catalogCard.subset || null,
    player: catalogCard.player,
    cardNumber: catalogCard.cardNumber,
    serialNumbering: backRead.serialNumbering,
    isAuto: catalogCard.isAuto,
    isRelic: catalogCard.isRelic,
    sport: catalogCard.sport,
    grade: 'RAW',
    catalogCardId: catalogCard.id,
    ...rawHints,
  };

  // Try the deterministic serial-stamp resolution before ever calling
  // Pass 3 — a print run that uniquely identifies a parallel is decisive
  // and doesn't need a model to judge color under uncertain lighting.
  const bySerial = resolveParallelFromSerial(backRead.serialNumbering, catalogCard.parallels);
  if (bySerial) {
    console.log(`[scanCard] Parallel resolved deterministically from serial stamp: ${bySerial.name}`);
    return emptyResult({ ...resolvedBase, confidence: 'high', parallel: bySerial.name });
  }

  // Pass 3 — parallel from the front, closed list.
  const parallelResult = await readParallel(front, back, catalogCard, client);
  if (!parallelResult || parallelResult.parallel === 'uncertain') {
    return emptyResult({
      ...resolvedBase,
      confidence: 'low',
      parallel: null,
      parallelCandidates: parallelResult?.candidates ?? [],
    });
  }

  return emptyResult({ ...resolvedBase, confidence: 'high', parallel: parallelResult.parallel });
}
