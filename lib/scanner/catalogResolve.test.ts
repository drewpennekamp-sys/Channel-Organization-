import { describe, expect, it } from 'vitest';
import {
  extractCardNumberPrefix,
  pickCatalogResolution,
  resolveParallelFromSerial,
  type CatalogCardWithParallels,
} from './catalogResolve';
import type { BackReadResult } from './backRead';
import type { CatalogParallel } from '@prisma/client';

function makeCard(overrides: Partial<CatalogCardWithParallels> = {}): CatalogCardWithParallels {
  return {
    id: 'catalog-1',
    brand: 'Topps',
    year: 2024,
    set: 'Chrome',
    subset: '',
    cardNumber: '159',
    cardNumberPrefix: '',
    player: 'Paul Skenes',
    sport: 'Baseball',
    isAuto: false,
    isRelic: false,
    copyrightYear: 2024,
    createdAt: new Date(),
    updatedAt: new Date(),
    parallels: [],
    ...overrides,
  };
}

function makeParallel(overrides: Partial<CatalogParallel> = {}): CatalogParallel {
  return {
    id: 'parallel-1',
    catalogCardId: 'catalog-1',
    name: 'Base',
    printRun: null,
    oneOfOne: false,
    rarityOrder: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

function backRead(overrides: Partial<BackReadResult> = {}): BackReadResult {
  return {
    cardNumber: '159',
    copyrightYear: 2024,
    brandLine: 'Topps',
    setName: 'Chrome',
    serialNumbering: null,
    player: 'Paul Skenes',
    sport: 'Baseball',
    ...overrides,
  };
}

describe('extractCardNumberPrefix', () => {
  it('extracts a hyphenated prefix', () => {
    expect(extractCardNumberPrefix('EA-BB')).toBe('EA');
    expect(extractCardNumberPrefix('BDC-42')).toBe('BDC');
  });
  it('returns empty string when there is no prefix', () => {
    expect(extractCardNumberPrefix('159')).toBe('');
  });
});

describe('pickCatalogResolution', () => {
  it('rule 1: resolves via exact (brand, year, set, cardNumber) match', () => {
    const card = makeCard();
    const result = pickCatalogResolution(backRead(), [card], []);
    expect(result.method).toBe('catalog-exact');
    expect(result.catalogCard?.id).toBe('catalog-1');
  });

  it('rule 2: resolves via cardNumber+player when copyright year is off by one (late-release offset)', () => {
    // Product year 2025, but the printed copyright line says 2024 — the
    // classic late-year-release case the ±1 rule exists for.
    const card = makeCard({ year: 2025 });
    const read = backRead({ copyrightYear: 2024, brandLine: null, setName: null }); // rule 1 can't fire without brand/set
    const result = pickCatalogResolution(read, [card], []);
    expect(result.method).toBe('catalog-year-offset');
    expect(result.catalogCard?.year).toBe(2025);
  });

  it('rule 2: does not resolve when year is off by more than one', () => {
    const card = makeCard({ year: 2027 });
    const read = backRead({ copyrightYear: 2024, brandLine: null, setName: null });
    const result = pickCatalogResolution(read, [card], []);
    expect(result.method).toBe('unresolved');
    expect(result.catalogCard).toBeNull();
  });

  it('rule 2: falls through (not a false match) when year±1 is ambiguous between two cards', () => {
    const cardA = makeCard({ id: 'a', year: 2024 });
    const cardB = makeCard({ id: 'b', year: 2025 });
    const read = backRead({ copyrightYear: 2024, brandLine: null, setName: null });
    // Both share cardNumber+player and both fall in the ±1 window.
    const result = pickCatalogResolution(read, [cardA, cardB], []);
    expect(result.method).toBe('unresolved');
  });

  it('rule 3: resolves a prefixed insert card number via (prefix, player)', () => {
    const card = makeCard({
      brand: 'Topps',
      year: 2025,
      set: "Chrome McDonald's All American",
      cardNumber: 'EA-BB',
      cardNumberPrefix: 'EA',
      player: 'Brayden Burries',
      sport: 'Basketball',
      copyrightYear: null,
    });
    // No brand/set/year read, and no year at all — only rule 3 can fire.
    const read = backRead({
      cardNumber: 'EA-BB',
      copyrightYear: null,
      brandLine: null,
      setName: null,
      player: 'Brayden Burries',
    });
    const result = pickCatalogResolution(read, [], [card]);
    expect(result.method).toBe('catalog-prefix');
    expect(result.catalogCard?.cardNumber).toBe('EA-BB');
  });

  it('rule 3: falls through when the prefix matches two different players', () => {
    const cardA = makeCard({ id: 'a', cardNumberPrefix: 'EA', player: 'Player A' });
    const cardB = makeCard({ id: 'b', cardNumberPrefix: 'EA', player: 'Player B' });
    const read = backRead({ cardNumber: 'EA-99', copyrightYear: null, brandLine: null, setName: null, player: 'Player C' });
    const result = pickCatalogResolution(read, [], [cardA, cardB]);
    expect(result.method).toBe('unresolved');
  });

  it('returns unresolved, never a guess, for a vintage card with no card number', () => {
    const read = backRead({ cardNumber: null, copyrightYear: null, brandLine: 'Topps', setName: null, player: 'Old Timer' });
    const result = pickCatalogResolution(read, [], []);
    expect(result.method).toBe('unresolved');
    expect(result.catalogCard).toBeNull();
  });
});

describe('resolveParallelFromSerial', () => {
  it('resolves deterministically when exactly one parallel matches the print run', () => {
    const parallels = [makeParallel({ name: 'Base', printRun: null }), makeParallel({ id: 'p2', name: 'Green', printRun: 99 })];
    const result = resolveParallelFromSerial('12/99', parallels);
    expect(result?.name).toBe('Green');
  });

  it('does NOT conflate a serial-numbered parallel with Base', () => {
    const parallels = [makeParallel({ name: 'Base', printRun: null }), makeParallel({ id: 'p2', name: 'Green', printRun: 99 })];
    const result = resolveParallelFromSerial('12/99', parallels);
    expect(result?.name).not.toBe('Base');
  });

  it('returns null (defers to Pass 3) when two parallels share a print run', () => {
    const parallels = [
      makeParallel({ id: 'p1', name: 'Green', printRun: 99 }),
      makeParallel({ id: 'p2', name: 'Orange', printRun: 99 }),
    ];
    const result = resolveParallelFromSerial('5/99', parallels);
    expect(result).toBeNull();
  });

  it('returns null when there is no serial numbering', () => {
    const parallels = [makeParallel({ name: 'Base' })];
    expect(resolveParallelFromSerial(null, parallels)).toBeNull();
  });
});
