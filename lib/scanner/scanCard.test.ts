import { describe, expect, it, vi, beforeEach } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { CatalogParallel } from '@prisma/client';
import type { CatalogCardWithParallels } from './catalogResolve';

// Mock the DB before importing anything that transitively imports it, so
// catalogResolve.ts's `prisma.catalogCard.findMany` calls are controllable
// per test instead of hitting a real database — these are pipeline-logic
// tests, not integration tests.
const findManyMock = vi.fn();
vi.mock('@/lib/db', () => ({
  prisma: { catalogCard: { findMany: findManyMock } },
}));

// Import after the mock is registered.
const { scanCard } = await import('./scanCard');

/**
 * Mocked regression suite for the scanner pipeline. Per the M4 spec: no
 * real photos, no live API calls — every fixture below stubs what each
 * pass's model call *would* return and asserts on the deterministic logic
 * downstream (catalog resolution, confidence assignment, closed-list
 * validation). This is fast, free, and deterministic, at the honest cost
 * of not testing whether the model can actually read a real photo — that
 * needs real fixture photos this environment doesn't have.
 *
 * Every test asserts on `confidence` AND field values — a right answer at
 * the wrong confidence level is a failing test here, per the spec.
 */

function fakeImage() {
  return { base64: 'ZmFrZQ==', mediaType: 'image/jpeg' as const };
}

function fakeResponse(payload: unknown): Anthropic.Message {
  return {
    id: 'msg_test',
    model: 'claude-sonnet-5',
    role: 'assistant',
    stop_reason: 'end_turn',
    stop_sequence: null,
    type: 'message',
    usage: { input_tokens: 100, output_tokens: 50 },
    content: [{ type: 'text', text: JSON.stringify(payload), citations: [] }],
  } as unknown as Anthropic.Message;
}

/** A mock Anthropic client whose messages.create() returns each payload in order, one per pass invoked. */
function mockClient(...payloads: unknown[]): Anthropic {
  const create = vi.fn();
  for (const p of payloads) {
    create.mockResolvedValueOnce(fakeResponse(p));
  }
  return { messages: { create } } as unknown as Anthropic;
}

function makeCatalogCard(overrides: Partial<CatalogCardWithParallels> = {}): CatalogCardWithParallels {
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

const NOT_A_SLAB = { isSlab: false, gradingCompany: null, certNumber: null, grade: null };

beforeEach(() => {
  findManyMock.mockReset();
  findManyMock.mockResolvedValue([]); // default: no catalog matches
});

describe('scanCard — fixture 1: slabbed PSA card', () => {
  it('resolves via cert with confidence exact, short-circuiting the rest of the pipeline', async () => {
    const client = mockClient({ isSlab: true, gradingCompany: 'PSA', certNumber: '84019283', grade: '10' });

    const result = await scanCard(fakeImage(), fakeImage(), client);

    expect(result.confidence).toBe('exact');
    expect(result.method).toBe('cert');
    expect(result.certNumber).toBe('84019283');
    expect(result.grade).toBe('10');
    // Only the slab check ran — backRead/parallelRead never fired.
    expect((client.messages.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

describe('scanCard — fixture 2: base card, clean back', () => {
  it('resolves via catalog-exact with confidence high', async () => {
    const card = makeCatalogCard({ parallels: [makeParallel({ name: 'Base' }), makeParallel({ id: 'p2', name: 'Refractor', rarityOrder: 1 })] });
    findManyMock.mockResolvedValueOnce([card]).mockResolvedValueOnce([]);

    const client = mockClient(
      NOT_A_SLAB,
      { cardNumber: '159', copyrightYear: 2024, brandLine: 'Topps', setName: 'Chrome', serialNumbering: null, player: 'Paul Skenes', sport: 'Baseball' },
      { parallel: 'Base', candidates: [], observedPrintRun: null, reasoning: 'plain border, no foil' },
    );

    const result = await scanCard(fakeImage(), fakeImage(), client);

    expect(result.confidence).toBe('high');
    expect(result.method).toBe('catalog-exact');
    expect(result.year).toBe(2024);
    expect(result.brand).toBe('Topps');
    expect(result.parallel).toBe('Base');
  });
});

describe('scanCard — fixture 3: prefixed insert card number', () => {
  it('resolves via catalog-prefix', async () => {
    const card = makeCatalogCard({
      brand: 'Topps',
      year: 2025,
      set: "Chrome McDonald's All American",
      cardNumber: 'EA-BB',
      cardNumberPrefix: 'EA',
      player: 'Brayden Burries',
      sport: 'Basketball',
      copyrightYear: null,
      parallels: [makeParallel({ name: 'Base' })],
    });
    // Exact-cardNumber lookup finds nothing; prefix lookup finds the card.
    findManyMock.mockResolvedValueOnce([]).mockResolvedValueOnce([card]);

    const client = mockClient(
      NOT_A_SLAB,
      { cardNumber: 'EA-BB', copyrightYear: null, brandLine: null, setName: null, serialNumbering: null, player: 'Brayden Burries', sport: 'Basketball' },
      { parallel: 'Base', candidates: [], observedPrintRun: null, reasoning: '' },
    );

    const result = await scanCard(fakeImage(), fakeImage(), client);

    expect(result.confidence).toBe('high');
    expect(result.method).toBe('catalog-prefix');
    expect(result.cardNumber).toBe('EA-BB');
    expect(result.player).toBe('Brayden Burries');
  });
});

describe('scanCard — fixture 4: copyright year differs from product year', () => {
  it('resolves via the ±1 rule and reports the correct product year, not the copyright year', async () => {
    const card = makeCatalogCard({ year: 2025, cardNumber: '201', player: 'Rookie Player', brand: 'Panini', set: 'Prizm', sport: 'Football', parallels: [makeParallel({ name: 'Base' })] });
    findManyMock.mockResolvedValueOnce([card]).mockResolvedValueOnce([]);

    const client = mockClient(
      NOT_A_SLAB,
      // Late-2024 print run of a 2025 product — copyright says 2024.
      { cardNumber: '201', copyrightYear: 2024, brandLine: null, setName: null, serialNumbering: null, player: 'Rookie Player', sport: 'Football' },
      { parallel: 'Base', candidates: [], observedPrintRun: null, reasoning: '' },
    );

    const result = await scanCard(fakeImage(), fakeImage(), client);

    expect(result.confidence).toBe('high');
    expect(result.method).toBe('catalog-year-offset');
    expect(result.year).toBe(2025); // the resolved product year, never the raw copyright year
  });
});

describe('scanCard — fixtures 5 & 6: parallels must not be conflated, serial stamp resolves deterministically', () => {
  it('resolves a Green /99 parallel from the serial stamp without ever calling Pass 3', async () => {
    const card = makeCatalogCard({
      parallels: [makeParallel({ name: 'Base' }), makeParallel({ id: 'p2', name: 'Green', printRun: 99, rarityOrder: 1 })],
    });
    findManyMock.mockResolvedValueOnce([card]).mockResolvedValueOnce([]);

    const client = mockClient(
      NOT_A_SLAB,
      { cardNumber: '159', copyrightYear: 2024, brandLine: 'Topps', setName: 'Chrome', serialNumbering: '12/99', player: 'Paul Skenes', sport: 'Baseball' },
      // No third payload — Pass 3 must not be called; deterministic serial resolution should short-circuit it.
    );

    const result = await scanCard(fakeImage(), fakeImage(), client);

    expect(result.confidence).toBe('high');
    expect(result.parallel).toBe('Green');
    expect(result.parallel).not.toBe('Base'); // the two parallels must not be conflated
    expect((client.messages.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2); // slab + back only
  });

  it('falls through to Pass 3 when the stamp is only visible on the front, and trusts its observedPrintRun', async () => {
    const card = makeCatalogCard({
      parallels: [makeParallel({ name: 'Base' }), makeParallel({ id: 'p2', name: 'Gold', printRun: 50, rarityOrder: 1 })],
    });
    findManyMock.mockResolvedValueOnce([card]).mockResolvedValueOnce([]);

    const client = mockClient(
      NOT_A_SLAB,
      // Back read doesn't see the stamp — it's only on the front.
      { cardNumber: '159', copyrightYear: 2024, brandLine: 'Topps', setName: 'Chrome', serialNumbering: null, player: 'Paul Skenes', sport: 'Baseball' },
      { parallel: 'Gold', candidates: [], observedPrintRun: 50, reasoning: 'stamp reads 23/50 on front' },
    );

    const result = await scanCard(fakeImage(), fakeImage(), client);

    expect(result.confidence).toBe('high');
    expect(result.parallel).toBe('Gold');
    expect((client.messages.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(3);
  });

  it('downgrades to low confidence with candidates when Pass 3 cannot distinguish two parallels', async () => {
    const card = makeCatalogCard({
      parallels: [
        makeParallel({ name: 'Base' }),
        makeParallel({ id: 'p2', name: 'Refractor', rarityOrder: 1 }),
        makeParallel({ id: 'p3', name: 'Prism Refractor', rarityOrder: 2 }),
      ],
    });
    findManyMock.mockResolvedValueOnce([card]).mockResolvedValueOnce([]);

    const client = mockClient(
      NOT_A_SLAB,
      { cardNumber: '159', copyrightYear: 2024, brandLine: 'Topps', setName: 'Chrome', serialNumbering: null, player: 'Paul Skenes', sport: 'Baseball' },
      { parallel: 'uncertain', candidates: ['Refractor', 'Prism Refractor'], observedPrintRun: null, reasoning: 'lighting makes these hard to tell apart' },
    );

    const result = await scanCard(fakeImage(), fakeImage(), client);

    expect(result.confidence).toBe('low');
    expect(result.parallel).toBeNull(); // never a guess between the two
    expect(result.parallelCandidates).toEqual(['Refractor', 'Prism Refractor']);
  });

  it('treats an off-list parallel response as uncertain (closed-list enforcement)', async () => {
    const card = makeCatalogCard({ parallels: [makeParallel({ name: 'Base' }), makeParallel({ id: 'p2', name: 'Refractor', rarityOrder: 1 })] });
    findManyMock.mockResolvedValueOnce([card]).mockResolvedValueOnce([]);

    const client = mockClient(
      NOT_A_SLAB,
      { cardNumber: '159', copyrightYear: 2024, brandLine: 'Topps', setName: 'Chrome', serialNumbering: null, player: 'Paul Skenes', sport: 'Baseball' },
      // Model free-forms a name that isn't on the catalog's list — must be rejected, not trusted.
      { parallel: 'Rainbow Foil', candidates: [], observedPrintRun: null, reasoning: 'looks shiny' },
    );

    const result = await scanCard(fakeImage(), fakeImage(), client);

    expect(result.confidence).toBe('low');
    expect(result.parallel).toBeNull();
  });
});

describe('scanCard — fixture 8: vintage card with no printed card number', () => {
  it('returns unresolved and never guesses a year, set, or parallel', async () => {
    const client = mockClient(
      NOT_A_SLAB,
      { cardNumber: null, copyrightYear: null, brandLine: 'Topps', setName: null, serialNumbering: null, player: 'Old Timer', sport: 'Baseball' },
    );

    const result = await scanCard(fakeImage(), fakeImage(), client);

    expect(result.confidence).toBe('unresolved');
    expect(result.method).toBe('unresolved');
    expect(result.cardNumber).toBeNull();
    expect(result.year).toBeNull();
    expect(result.set).toBeNull();
    expect(result.parallel).toBeNull();
    // The raw OCR fact is preserved as a starting point, just not promoted to a resolved field.
    expect(result.rawBrandLine).toBe('Topps');
    expect(findManyMock).not.toHaveBeenCalled(); // no cardNumber to look up at all
  });
});

describe('scanCard — total pipeline failure', () => {
  it('returns unresolved, not a crash, when Pass 1 itself fails to parse', async () => {
    const client = mockClient(NOT_A_SLAB, { totally: 'not the expected shape' });

    const result = await scanCard(fakeImage(), fakeImage(), client);

    expect(result.confidence).toBe('unresolved');
    expect(result.cardNumber).toBeNull();
  });
});
