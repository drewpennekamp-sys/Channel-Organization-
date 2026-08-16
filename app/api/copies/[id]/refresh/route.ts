import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AgentSource } from '@/lib/sources/AgentSource';
import { persistSales } from '@/lib/valuation/persistSales';
import { computeAndPersistValuation } from '@/lib/valuation/computeAndPersistValuation';

/**
 * "Search comps" button. Bounded to fit inside a serverless request:
 * unlike the CLI's thorough default (up to 8 rounds of web search, ~13-15
 * min observed), this uses a much smaller search budget so it reliably
 * finishes within the function timeout below. Sale rows are append-only
 * and deduped on sourceUrl, so nothing is lost between clicks — searching
 * again later adds to what's already on record rather than starting over,
 * and the valuation gets more accurate as more sales accumulate.
 */
const INTERACTIVE_MAX_SEARCHES = 3;

// Vercel kills a function after this many seconds. 60s is safe on every
// plan tier; raise it if the account supports more and searches are still
// timing out in practice.
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const copy = await prisma.copyOwned.findUnique({
    where: { id: params.id },
    include: { card: true },
  });

  if (!copy) {
    return NextResponse.json({ error: 'Card not found.' }, { status: 404 });
  }

  const source = new AgentSource(undefined, INTERACTIVE_MAX_SEARCHES);
  const rawSales = await source.fetchSales(copy.card, copy.grade);

  const { inserted, duplicates } = await persistSales(copy.cardId, rawSales);

  const valuation = await computeAndPersistValuation(copy.id, copy.cardId, copy.grade);

  return NextResponse.json({
    inserted,
    duplicates,
    valuation: {
      value: valuation.value,
      low: valuation.low,
      high: valuation.high,
      sampleSize: valuation.sampleSize,
      sufficient: valuation.sufficient,
      method: valuation.method,
    },
  });
}
