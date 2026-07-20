import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, dailyPlans, postedVideos } from '@/lib/db/schema';
import { markPostedSchema } from '@/lib/validation';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const channel = await db.select().from(channels).where(eq(channels.id, params.id)).get();
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = markPostedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const currentPlan = await db
    .select()
    .from(dailyPlans)
    .where(and(eq(dailyPlans.channelId, channel.id), ne(dailyPlans.postStatus, 'posted')))
    .orderBy(desc(dailyPlans.createdAt))
    .get();

  if (!currentPlan) {
    return NextResponse.json({ error: 'No active idea to mark as posted' }, { status: 409 });
  }

  const { views, likes, comments } = parsed.data;
  const postedAt = new Date();

  await db
    .update(dailyPlans)
    .set({ postStatus: 'posted', postedAt })
    .where(eq(dailyPlans.id, currentPlan.id));

  const postedVideoId = randomUUID();
  await db.insert(postedVideos).values({
    id: postedVideoId,
    dailyPlanId: currentPlan.id,
    channelId: channel.id,
    views,
    likes,
    comments,
    postedAt,
  });

  const plan = await db.select().from(dailyPlans).where(eq(dailyPlans.id, currentPlan.id)).get();

  return NextResponse.json({ plan });
}
