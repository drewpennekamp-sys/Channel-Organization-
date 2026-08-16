import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { RawSale } from '@/lib/sources/types';

export interface PersistSalesResult {
  inserted: number;
  duplicates: number;
}

function isUniqueConstraintViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * Inserts retrieved sales as append-only Sale rows for a card, deduping on
 * the Sale.sourceUrl unique constraint — a sale already on record (from an
 * earlier CLI run or a previous "Search comps" click) is silently skipped,
 * not overwritten. Shared by scripts/comp.ts and the in-app refresh route
 * so both paths persist identically.
 */
export async function persistSales(cardId: string, sales: readonly RawSale[]): Promise<PersistSalesResult> {
  let inserted = 0;
  let duplicates = 0;

  for (const sale of sales) {
    try {
      await prisma.sale.create({
        data: {
          cardId,
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
        console.error(`[persistSales] Failed to store sale (${sale.url}):`, err);
      }
    }
  }

  return { inserted, duplicates };
}
