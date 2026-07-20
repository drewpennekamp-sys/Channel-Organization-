import { NextResponse } from 'next/server';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, dailyPlans, insights } from '@/lib/db/schema';
import { channelInputSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const [channel] = await db.select().from(channels).where(eq(channels.id, params.id)).limit(1);
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  const recentPlans = await db
    .select()
    .from(dailyPlans)
    .where(eq(dailyPlans.channelId, params.id))
    .orderBy(desc(dailyPlans.createdAt))
    .limit(3);

  const [latestInsight] = await db
    .select()
    .from(insights)
    .where(eq(insights.channelId, params.id))
    .orderBy(desc(insights.createdAt))
    .limit(1);

  return NextResponse.json({
    channel,
    activity: {
      recentPlans,
      latestInsight: latestInsight ?? null,
    },
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const [existing] = await db.select().from(channels).where(eq(channels.id, params.id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = channelInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const data = parsed.data;

  const [nameClash] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(sql`lower(${channels.name}) = lower(${data.name})`, ne(channels.id, params.id)))
    .limit(1);

  if (nameClash) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: { name: ['A channel with this name already exists'] } },
      { status: 409 }
    );
  }

  await db
    .update(channels)
    .set({
      name: data.name,
      niche: data.niche,
      owner: data.owner,
      platformHandle: data.platformHandle || null,
      videoGenTool: data.videoGenTool,
      needsVoiceover: data.needsVoiceover,
      voiceStyle: data.needsVoiceover ? data.voiceStyle || null : null,
    })
    .where(eq(channels.id, params.id));

  const [updated] = await db.select().from(channels).where(eq(channels.id, params.id)).limit(1);

  return NextResponse.json({ channel: updated });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const [existing] = await db.select().from(channels).where(eq(channels.id, params.id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  await db.delete(channels).where(eq(channels.id, params.id));

  return NextResponse.json({ ok: true });
}
