import { prisma } from '@/lib/db';

/**
 * Shared read model for the Dashboard / Collection / Value / Comps pages —
 * one query shape, one set of derived numbers, so the four views can never
 * disagree about what a card is "worth" today.
 *
 * The honesty rule from computeValuation.ts carries through here: a card's
 * "current value" is the latest *sufficient* Valuation, or — failing that —
 * its purchase price, clearly labeled "at cost" by every caller. Never an
 * average, never an estimate, never the low/high band presented as a point
 * value.
 */

export interface PortfolioCard {
  id: string;
  year: number;
  brand: string;
  set: string;
  subset: string;
  player: string;
  cardNumber: string;
  parallel: string;
  serialNumbering: string;
  isAuto: boolean;
  isRelic: boolean;
  sport: string;
}

export interface PortfolioValuation {
  value: number | null;
  low: number | null;
  high: number | null;
  sampleSize: number;
  sufficient: boolean;
  computedAt: Date;
}

export interface PortfolioCopy {
  id: string;
  grade: string;
  certNumber: string | null;
  purchasePrice: number | null;
  purchaseDate: Date | null;
  frontImagePath: string | null;
  notes: string | null;
  createdAt: Date;
  card: PortfolioCard;
  latestValuation: PortfolioValuation | null;
}

export async function getPortfolio(): Promise<PortfolioCopy[]> {
  const copies = await prisma.copyOwned.findMany({
    include: {
      card: true,
      // Only the latest snapshot per copy — full Valuation history exists
      // in the DB (see prisma/schema.prisma) but every view here shows
      // current status only.
      valuations: { orderBy: { computedAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  return copies.map((copy) => ({
    id: copy.id,
    grade: copy.grade,
    certNumber: copy.certNumber,
    purchasePrice: copy.purchasePrice,
    purchaseDate: copy.purchaseDate,
    frontImagePath: copy.frontImagePath,
    notes: copy.notes,
    createdAt: copy.createdAt,
    card: copy.card,
    latestValuation: copy.valuations[0] ?? null,
  }));
}

const SPORT_EMOJI: Record<string, string> = {
  basketball: '🏀',
  baseball: '⚾',
  football: '🏈',
  hockey: '🏒',
  soccer: '⚽',
  golf: '⛳',
};

export function cardEmoji(card: PortfolioCard): string {
  return SPORT_EMOJI[card.sport.trim().toLowerCase()] ?? '🃏';
}

/** Player name — the title used on card tiles and list rows. */
export function cardTitle(card: PortfolioCard): string {
  return card.player;
}

/** Everything else: year/brand/set/number/parallel/tags. */
export function cardSubtitle(card: PortfolioCard): string {
  const parts = [`${card.year} ${card.brand} ${card.set}`.trim()];
  if (card.subset) parts.push(card.subset);
  parts.push(`#${card.cardNumber || '—'}`);
  const tags = [card.parallel, card.serialNumbering, card.isAuto ? 'AUTO' : '', card.isRelic ? 'RELIC' : '']
    .filter(Boolean)
    .join(' ');
  if (tags) parts.push(tags);
  return parts.join(' · ');
}

/** True when this copy has no valuation yet, or its last search came back insufficient. */
export function needsSearch(copy: PortfolioCopy): boolean {
  return !copy.latestValuation || !copy.latestValuation.sufficient;
}

/**
 * "Current value" for display: the latest sufficient Valuation if there is
 * one, else the purchase price as a fallback — callers must label which one
 * they got via `isPriced`, never present the fallback as a real value.
 */
export function currentValue(copy: PortfolioCopy): { amount: number | null; isPriced: boolean } {
  if (copy.latestValuation?.sufficient && copy.latestValuation.value !== null) {
    return { amount: copy.latestValuation.value, isPriced: true };
  }
  return { amount: copy.purchasePrice, isPriced: false };
}

/** Gain in dollars and percent — only defined when both a real valuation and a purchase price exist. */
export function gain(copy: PortfolioCopy): { amount: number; pct: number } | null {
  if (!copy.latestValuation?.sufficient || copy.latestValuation.value === null) return null;
  if (copy.purchasePrice === null || copy.purchasePrice === 0) return null;
  const amount = copy.latestValuation.value - copy.purchasePrice;
  return { amount, pct: (amount / copy.purchasePrice) * 100 };
}

export interface PortfolioStats {
  cardCount: number;
  setCount: number;
  totalValue: number;
  valuedSubtotal: number;
  valuedCount: number;
  atCostSubtotal: number;
  atCostCount: number;
  totalPaid: number;
  /** Sum of gain$ across copies that have both a valuation and a purchase price. Null if none qualify. */
  gainOnValued: number | null;
  gainPctOnValued: number | null;
  needsSearchCount: number;
  bestPerformer: { copy: PortfolioCopy; pct: number } | null;
  worstPerformer: { copy: PortfolioCopy; pct: number } | null;
}

export function computePortfolioStats(copies: PortfolioCopy[]): PortfolioStats {
  let valuedSubtotal = 0;
  let valuedCount = 0;
  let atCostSubtotal = 0;
  let atCostCount = 0;
  let totalPaid = 0;
  let gainBasis = 0;
  let gainNow = 0;
  let hasGainData = false;
  let needsSearchCount = 0;
  let bestPerformer: { copy: PortfolioCopy; pct: number } | null = null;
  let worstPerformer: { copy: PortfolioCopy; pct: number } | null = null;

  for (const copy of copies) {
    if (copy.purchasePrice !== null) totalPaid += copy.purchasePrice;
    if (needsSearch(copy)) needsSearchCount++;

    const { amount, isPriced } = currentValue(copy);
    if (isPriced && amount !== null) {
      valuedSubtotal += amount;
      valuedCount++;
    } else if (amount !== null) {
      atCostSubtotal += amount;
      atCostCount++;
    }

    const g = gain(copy);
    if (g !== null && copy.purchasePrice !== null) {
      hasGainData = true;
      gainBasis += copy.purchasePrice;
      gainNow += copy.latestValuation!.value!;
      if (bestPerformer === null || g.pct > bestPerformer.pct) bestPerformer = { copy, pct: g.pct };
      if (worstPerformer === null || g.pct < worstPerformer.pct) worstPerformer = { copy, pct: g.pct };
    }
  }

  const setCount = new Set(copies.map((c) => `${c.card.year}|${c.card.brand}|${c.card.set}`)).size;

  return {
    cardCount: copies.length,
    setCount,
    totalValue: valuedSubtotal + atCostSubtotal,
    valuedSubtotal,
    valuedCount,
    atCostSubtotal,
    atCostCount,
    totalPaid,
    gainOnValued: hasGainData ? gainNow - gainBasis : null,
    gainPctOnValued: hasGainData && gainBasis > 0 ? ((gainNow - gainBasis) / gainBasis) * 100 : null,
    needsSearchCount,
    bestPerformer,
    worstPerformer,
  };
}

export interface ActivityEvent {
  id: string;
  kind: 'added' | 'valued' | 'insufficient';
  copy: PortfolioCopy;
  at: Date;
}

/**
 * Real activity feed — no separate log table exists (there's nothing to
 * fabricate here either), so this is derived directly from timestamps
 * already on record: when a copy was added, and when its valuations were
 * last computed.
 */
export function buildActivityFeed(copies: PortfolioCopy[], limit = 6): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const copy of copies) {
    events.push({ id: `added-${copy.id}`, kind: 'added', copy, at: copy.createdAt });
    if (copy.latestValuation) {
      events.push({
        id: `valued-${copy.id}`,
        kind: copy.latestValuation.sufficient ? 'valued' : 'insufficient',
        copy,
        at: copy.latestValuation.computedAt,
      });
    }
  }
  events.sort((a, b) => b.at.getTime() - a.at.getTime());
  return events.slice(0, limit);
}
