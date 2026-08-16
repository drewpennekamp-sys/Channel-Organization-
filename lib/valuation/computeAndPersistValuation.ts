import { prisma } from '@/lib/db';
import { computeValuation } from './computeValuation';
import { toScoringSale } from './fromPrisma';
import type { ScoringResult } from './types';

/**
 * Runs the deterministic scorer against every Sale on record for a card
 * (not just a single retrieval batch) and persists the result as a new
 * Valuation row — never mutating a prior one, so value history is kept.
 * The exact Sale rows behind the number are recorded via
 * ValuationSaleUsed, so any past Valuation is reproducible from the data
 * that existed at computedAt.
 *
 * Shared by scripts/comp.ts and the in-app "Search comps" route, so a
 * scan run from the CLI and one run from a button press leave identical
 * records behind.
 */
export async function computeAndPersistValuation(
  copyOwnedId: string,
  cardId: string,
  grade: string,
): Promise<ScoringResult> {
  const sales = await prisma.sale.findMany({ where: { cardId } });
  const result = computeValuation(sales.map(toScoringSale), grade);

  await prisma.valuation.create({
    data: {
      copyOwnedId,
      value: result.value,
      low: result.low,
      high: result.high,
      sampleSize: result.sampleSize,
      sufficient: result.sufficient,
      method: result.method,
      salesUsed: {
        create: result.saleIdsUsed.map((saleId) => ({ saleId })),
      },
    },
  });

  return result;
}
