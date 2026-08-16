/**
 * CLI: retrieve sold comps for a card + grade, store them, and print the
 * deterministic valuation computed from every Sale on record for that
 * card + grade — not just what this run retrieved.
 *
 * Usage:
 *   npm run comp -- --player "Brayden Burries" --year 2025 --grade RAW \
 *     --brand Topps --set "Chrome McDonald's All American" \
 *     --cardNumber EA-BB --isAuto --sport Basketball
 *
 * Flags: --player --year --grade are required. --brand --set --subset
 * --cardNumber --parallel --serialNumbering --sport are optional (default
 * to "" / "Unknown"). --isAuto / --isRelic are boolean presence flags.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AgentSource } from '@/lib/sources/AgentSource';
import { computeValuation } from '@/lib/valuation/computeValuation';
import { toScoringSale } from '@/lib/valuation/fromPrisma';
import type { RawSale } from '@/lib/sources/types';

interface CliArgs {
  player: string;
  year: number;
  grade: string;
  brand: string;
  set: string;
  subset: string;
  cardNumber: string;
  parallel: string;
  serialNumbering: string;
  sport: string;
  isAuto: boolean;
  isRelic: boolean;
}

function parseRawArgs(argv: string[]): Map<string, string | true> {
  const out = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out.set(key, true);
      continue;
    }
    out.set(key, next);
    i++;
  }
  return out;
}

function requireString(raw: Map<string, string | true>, key: string): string {
  const value = raw.get(key);
  if (typeof value !== 'string' || value.trim() === '') {
    console.error(`Missing required flag: --${key}`);
    process.exit(1);
  }
  return value;
}

function optionalString(raw: Map<string, string | true>, key: string, fallback: string): string {
  const value = raw.get(key);
  return typeof value === 'string' ? value : fallback;
}

function parseCliArgs(argv: string[]): CliArgs {
  const raw = parseRawArgs(argv);

  const player = requireString(raw, 'player');
  const yearStr = requireString(raw, 'year');
  const year = Number(yearStr);
  if (!Number.isInteger(year)) {
    console.error(`--year must be an integer, got "${yearStr}"`);
    process.exit(1);
  }
  const grade = requireString(raw, 'grade');

  return {
    player,
    year,
    grade,
    brand: optionalString(raw, 'brand', ''),
    set: optionalString(raw, 'set', ''),
    subset: optionalString(raw, 'subset', ''),
    cardNumber: optionalString(raw, 'cardNumber', ''),
    parallel: optionalString(raw, 'parallel', ''),
    serialNumbering: optionalString(raw, 'serialNumbering', ''),
    sport: optionalString(raw, 'sport', 'Unknown'),
    isAuto: raw.get('isAuto') === true,
    isRelic: raw.get('isRelic') === true,
  };
}

function isUniqueConstraintViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function formatMoney(value: number | null): string {
  return value === null ? '—' : `$${value.toFixed(2)}`;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));

  const card = await prisma.card.upsert({
    where: {
      cardIdentity: {
        year: args.year,
        brand: args.brand,
        set: args.set,
        subset: args.subset,
        player: args.player,
        cardNumber: args.cardNumber,
        parallel: args.parallel,
        serialNumbering: args.serialNumbering,
        isAuto: args.isAuto,
        isRelic: args.isRelic,
        sport: args.sport,
      },
    },
    update: {},
    create: {
      year: args.year,
      brand: args.brand,
      set: args.set,
      subset: args.subset,
      player: args.player,
      cardNumber: args.cardNumber,
      parallel: args.parallel,
      serialNumbering: args.serialNumbering,
      isAuto: args.isAuto,
      isRelic: args.isRelic,
      sport: args.sport,
    },
  });

  console.log(
    `\nCard: ${card.year} ${card.brand} ${card.set}${card.subset ? ' ' + card.subset : ''} — ${card.player} #${card.cardNumber}` +
      `${card.parallel ? ' ' + card.parallel : ''}${card.serialNumbering ? ' ' + card.serialNumbering : ''}` +
      `${card.isAuto ? ' AUTO' : ''}${card.isRelic ? ' RELIC' : ''} (${card.sport})`,
  );
  console.log(`Grade: ${args.grade}`);
  console.log('\nRetrieving sold comps via AgentSource (Claude + web search)...\n');

  const source = new AgentSource();
  const rawSales: RawSale[] = await source.fetchSales(card, args.grade);

  console.log(`Retrieved ${rawSales.length} sale(s) with a sourceUrl this run:\n`);
  for (const sale of rawSales) {
    console.log(`  ${sale.date}  ${formatMoney(sale.price)}  [${sale.marketplace}]  ${sale.title}`);
    console.log(`    ${sale.url}${sale.notes ? `  (${sale.notes})` : ''}`);
  }

  let inserted = 0;
  let duplicates = 0;
  for (const sale of rawSales) {
    try {
      await prisma.sale.create({
        data: {
          cardId: card.id,
          grade: sale.grade,
          price: sale.price,
          saleDate: new Date(sale.date),
          marketplace: sale.marketplace,
          listingTitle: sale.title,
          sourceUrl: sale.url,
          sourceType: 'agent',
          notes: sale.notes,
        },
      });
      inserted++;
    } catch (err: unknown) {
      if (isUniqueConstraintViolation(err)) {
        duplicates++;
      } else {
        console.error(`\nFailed to store sale (${sale.url}):`, err);
      }
    }
  }
  console.log(`\nStored ${inserted} new sale(s); ${duplicates} already on record (deduped by sourceUrl).`);

  // Score against every Sale on record for this card, not just this run's
  // batch — that's the whole point of the append-only Sale table.
  const allSales = await prisma.sale.findMany({ where: { cardId: card.id } });
  const valuation = computeValuation(allSales.map(toScoringSale), args.grade);

  console.log('\n--- Computed valuation ---');
  if (!valuation.sufficient) {
    console.log(`Insufficient comps (n=${valuation.sampleSize})`);
  } else {
    console.log(`Value: ${formatMoney(valuation.value)}  (range ${formatMoney(valuation.low)} – ${formatMoney(valuation.high)})`);
    console.log(`Based on ${valuation.sampleSize} sale(s) within the 180-day window; ${valuation.saleIdsUsed.length} used after outlier trimming.`);
  }
  console.log(`Method: ${valuation.method}\n`);

  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error('comp script failed:', err);
  process.exitCode = 1;
});
