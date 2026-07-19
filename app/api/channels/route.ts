import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels } from '@/lib/db/schema';
import { channelInputSchema } from '@/lib/validation';
import { nextAccentColor } from '@/lib/palette';

export async function GET() {
  const rows = await db.select().from(channels).orderBy(asc(channels.createdAt));
  return NextResponse.json({ channels: rows });
}

export async function POST(request: Request) {
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

  const existing = await db
    .select({ id: channels.id })
    .from(channels)
    .where(sql`lower(${channels.name}) = lower(${data.name})`)
    .get();

  if (existing) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: { name: ['A channel with this name already exists'] } },
      { status: 409 }
    );
  }

  const allChannels = await db.select({ accentColor: channels.accentColor }).from(channels);
  const accentColor = nextAccentColor(allChannels.map((c) => c.accentColor));

  const id = randomUUID();
  await db.insert(channels).values({
    id,
    name: data.name,
    niche: data.niche,
    owner: data.owner,
    platformHandle: data.platformHandle || null,
    videoGenTool: data.videoGenTool,
    needsVoiceover: data.needsVoiceover,
    voiceStyle: data.needsVoiceover ? data.voiceStyle || null : null,
    accentColor,
  });

  const created = await db.select().from(channels).where(eq(channels.id, id)).get();

  return NextResponse.json({ channel: created }, { status: 201 });
}
