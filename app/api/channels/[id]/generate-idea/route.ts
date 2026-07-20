import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, dailyPlans, insights } from '@/lib/db/schema';
import { generateIdea } from '@/lib/ideaGenerator';
import type { DailyPlanDTO } from '@/lib/types';

export const dynamic = 'force-dynamic';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const [channel] = await db.select().from(channels).where(eq(channels.id, params.id)).limit(1);
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  await delay(600 + Math.random() * 500);

  // The latest insight (AI-analyzed or manually noted) is genuinely folded
  // into generation here, not just displayed elsewhere — its first
  // recommendation is woven into the video prompt, and its id is recorded
  // on the plan so the Dashboard's "Informed by" indicator reflects real use.
  const [latestInsight] = await db
    .select()
    .from(insights)
    .where(eq(insights.channelId, channel.id))
    .orderBy(desc(insights.date))
    .limit(1);

  const generated = generateIdea(
    channel.niche,
    channel.needsVoiceover,
    channel.voiceStyle,
    latestInsight?.recommendations
      ? (JSON.parse(latestInsight.recommendations) as string[])[0]
      : null
  );

  await db
    .delete(dailyPlans)
    .where(and(eq(dailyPlans.channelId, channel.id), ne(dailyPlans.postStatus, 'posted')));

  const id = randomUUID();
  await db.insert(dailyPlans).values({
    id,
    channelId: channel.id,
    ideaTitle: generated.ideaTitle,
    hook: generated.hook,
    videoPrompt: generated.videoPrompt,
    voiceoverScript: generated.voiceoverScript,
    postStatus: 'idea',
    informedByInsightId: latestInsight?.id ?? null,
  });

  const [plan] = await db.select().from(dailyPlans).where(eq(dailyPlans.id, id)).limit(1);
  if (!plan) {
    return NextResponse.json({ error: 'Failed to generate idea' }, { status: 500 });
  }

  const dto: DailyPlanDTO = {
    id: plan.id,
    channelId: plan.channelId,
    ideaTitle: plan.ideaTitle,
    hook: plan.hook,
    videoPrompt: plan.videoPrompt,
    voiceoverScript: plan.voiceoverScript,
    postStatus: plan.postStatus,
    postedAt: plan.postedAt ? plan.postedAt.toISOString() : null,
    informedByInsightId: plan.informedByInsightId,
    informedByInsightDate: latestInsight ? latestInsight.date.toISOString() : null,
    createdAt: plan.createdAt.toISOString(),
  };

  return NextResponse.json({ plan: dto });
}
