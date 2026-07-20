import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, insights } from '@/lib/db/schema';
import { manualInsightSchema } from '@/lib/validation';
import { toInsightDTO } from '@/lib/insights';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const [channel] = await db.select().from(channels).where(eq(channels.id, params.id)).limit(1);
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = manualInsightSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const id = randomUUID();
  await db.insert(insights).values({
    id,
    channelId: channel.id,
    summary: parsed.data.summary,
    recommendations: JSON.stringify(parsed.data.recommendations),
    source: 'manual',
  });

  const [insight] = await db.select().from(insights).where(eq(insights.id, id)).limit(1);
  if (!insight) {
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
  }

  return NextResponse.json({ insight: toInsightDTO(insight) }, { status: 201 });
}
