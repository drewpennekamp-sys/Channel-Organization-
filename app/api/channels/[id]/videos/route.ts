import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, postedVideos } from '@/lib/db/schema';
import { videoInputSchema } from '@/lib/validation';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const channel = await db.select().from(channels).where(eq(channels.id, params.id)).get();
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = videoInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const id = randomUUID();

  await db.insert(postedVideos).values({
    id,
    channelId: channel.id,
    dailyPlanId: null,
    ideaTitle: data.ideaTitle,
    postedAt: new Date(data.postedAt),
    views: data.views,
    likes: data.likes,
    comments: data.comments,
    shares: data.shares ?? null,
    avgViewDuration: data.avgViewDuration ?? null,
    retentionNote: data.retentionNote || null,
  });

  const video = await db.select().from(postedVideos).where(eq(postedVideos.id, id)).get();

  return NextResponse.json({ video }, { status: 201 });
}
