import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, insights, postedVideos } from '@/lib/db/schema';
import { generateChannelAnalysis } from '@/lib/anthropic';
import { toInsightDTO } from '@/lib/insights';

const MIN_VIDEOS_TO_ANALYZE = 3;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const channel = await db.select().from(channels).where(eq(channels.id, params.id)).get();
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  const videos = await db
    .select()
    .from(postedVideos)
    .where(eq(postedVideos.channelId, channel.id))
    .orderBy(desc(postedVideos.postedAt));

  if (videos.length < MIN_VIDEOS_TO_ANALYZE) {
    return NextResponse.json(
      { error: `Need at least ${MIN_VIDEOS_TO_ANALYZE} posted videos to analyze` },
      { status: 422 }
    );
  }

  let analysis;
  try {
    analysis = await generateChannelAnalysis(
      channel.niche,
      videos.map((v) => ({
        id: v.id,
        channelId: v.channelId,
        dailyPlanId: v.dailyPlanId,
        ideaTitle: v.ideaTitle,
        platformVideoId: v.platformVideoId,
        postedAt: v.postedAt.toISOString(),
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        shares: v.shares,
        avgViewDuration: v.avgViewDuration,
        retentionNote: v.retentionNote,
        lastSyncedAt: v.lastSyncedAt ? v.lastSyncedAt.toISOString() : null,
      }))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed. Try again.';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const id = randomUUID();
  await db.insert(insights).values({
    id,
    channelId: channel.id,
    summary: analysis.summary,
    recommendations: JSON.stringify(analysis.recommendations),
    source: 'claude',
  });

  const insight = await db.select().from(insights).where(eq(insights.id, id)).get();
  if (!insight) {
    return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 });
  }

  return NextResponse.json({ insight: toInsightDTO(insight) });
}
