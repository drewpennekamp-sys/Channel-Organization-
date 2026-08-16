import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

/**
 * Creates (or reuses, via the Card identity unique constraint) a Card and
 * adds a CopyOwned for it. This is the only place a scanned/entered card
 * actually gets written to the database — the confirm-before-save form is
 * the gate; nothing upstream of this route touches Card/CopyOwned.
 */
const CreateCopyOwnedSchema = z.object({
  year: z.number().int(),
  brand: z.string(),
  set: z.string(),
  subset: z.string().default(''),
  player: z.string().min(1),
  cardNumber: z.string(),
  parallel: z.string().default(''),
  serialNumbering: z.string().default(''),
  isAuto: z.boolean().default(false),
  isRelic: z.boolean().default(false),
  sport: z.string().min(1),

  grade: z.string().min(1),
  certNumber: z.string().nullable().optional(),
  purchasePrice: z.number().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  frontImagePath: z.string().nullable().optional(),
  backImagePath: z.string().nullable().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (err: unknown) {
    console.error('[api/cards] Failed to parse request JSON:', err);
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = CreateCopyOwnedSchema.safeParse(body);
  if (!parsed.success) {
    console.error('[api/cards] Validation failed:', parsed.error.issues);
    return NextResponse.json({ error: 'Invalid card data.', issues: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const card = await prisma.card.upsert({
      where: {
        cardIdentity: {
          year: data.year,
          brand: data.brand,
          set: data.set,
          subset: data.subset,
          player: data.player,
          cardNumber: data.cardNumber,
          parallel: data.parallel,
          serialNumbering: data.serialNumbering,
          isAuto: data.isAuto,
          isRelic: data.isRelic,
          sport: data.sport,
        },
      },
      update: {},
      create: {
        year: data.year,
        brand: data.brand,
        set: data.set,
        subset: data.subset,
        player: data.player,
        cardNumber: data.cardNumber,
        parallel: data.parallel,
        serialNumbering: data.serialNumbering,
        isAuto: data.isAuto,
        isRelic: data.isRelic,
        sport: data.sport,
      },
    });

    const copyOwned = await prisma.copyOwned.create({
      data: {
        cardId: card.id,
        grade: data.grade,
        certNumber: data.certNumber ?? null,
        purchasePrice: data.purchasePrice ?? null,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        frontImagePath: data.frontImagePath ?? null,
        backImagePath: data.backImagePath ?? null,
        notes: data.notes ?? null,
      },
    });

    return NextResponse.json({ id: copyOwned.id, cardId: card.id }, { status: 201 });
  } catch (err: unknown) {
    console.error('[api/cards] Failed to save card:', err);
    return NextResponse.json({ error: 'Failed to save the card.' }, { status: 500 });
  }
}
