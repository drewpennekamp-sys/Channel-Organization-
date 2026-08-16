import { prisma } from '@/lib/db';
import { extractCardNumberPrefix } from '@/lib/scanner/catalogResolve';

export interface ConfirmedCardData {
  year: number;
  brand: string;
  set: string;
  subset: string;
  cardNumber: string;
  player: string;
  sport: string;
  parallel: string;
  serialNumbering: string;
  isAuto: boolean;
  isRelic: boolean;
  /** The raw copyright year Pass 1 read, if this save came from a scan. */
  copyrightYear?: number | null;
}

/**
 * The catalog isn't bulk-seeded (see prisma/schema.prisma) — it grows one
 * entry at a time from every confirmed save, scanned or hand-typed alike,
 * since a confirmed save is by definition data the owner has verified.
 * Best-effort and never blocks the actual card save: a catalog-growth
 * failure shouldn't lose the card the user is trying to add.
 */
export async function growCatalogFromConfirmedCard(data: ConfirmedCardData): Promise<void> {
  if (!data.brand || !data.set || !data.cardNumber || !data.player || !data.sport) {
    // Not enough identity to make a useful catalog entry (e.g. a bare
    // manual entry with blank brand/set) — skip rather than seed the
    // catalog with an unresolvable stub that later matches nothing.
    return;
  }

  try {
    const catalogCard = await prisma.catalogCard.upsert({
      where: {
        catalogIdentity: {
          brand: data.brand,
          year: data.year,
          set: data.set,
          subset: data.subset,
          cardNumber: data.cardNumber,
        },
      },
      update: {
        // Keep the freshest observed copyright year, when this save has one.
        ...(data.copyrightYear ? { copyrightYear: data.copyrightYear } : {}),
      },
      create: {
        brand: data.brand,
        year: data.year,
        set: data.set,
        subset: data.subset,
        cardNumber: data.cardNumber,
        cardNumberPrefix: extractCardNumberPrefix(data.cardNumber),
        player: data.player,
        sport: data.sport,
        isAuto: data.isAuto,
        isRelic: data.isRelic,
        copyrightYear: data.copyrightYear ?? null,
      },
    });

    const parallelName = data.parallel || 'Base';
    const existing = await prisma.catalogParallel.findUnique({
      where: { catalogCardId_name: { catalogCardId: catalogCard.id, name: parallelName } },
    });
    if (!existing) {
      const printRunMatch = data.serialNumbering.match(/\/(\d+)/);
      const isOneOfOne = /1\s*\/\s*1\b/.test(data.serialNumbering);
      const maxOrder = await prisma.catalogParallel.aggregate({
        where: { catalogCardId: catalogCard.id },
        _max: { rarityOrder: true },
      });
      await prisma.catalogParallel.create({
        data: {
          catalogCardId: catalogCard.id,
          name: parallelName,
          printRun: printRunMatch ? Number(printRunMatch[1]) : null,
          oneOfOne: isOneOfOne,
          rarityOrder: (maxOrder._max.rarityOrder ?? -1) + 1,
        },
      });
    }
  } catch (err: unknown) {
    console.error('[growCatalog] Failed to grow catalog from confirmed card (non-fatal):', err);
  }
}
