import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, dailyPlans, insights, postedVideos } from '@/lib/db/schema';
import { toInsightDTO } from '@/lib/insights';
import { getSettings } from '@/lib/settings';
import type { ExportDataDTO } from '@/lib/exportImport';
import type { ChannelDTO, DailyPlanDTO, PostedVideoDTO } from '@/lib/types';

function toChannelDTO(row: typeof channels.$inferSelect): ChannelDTO {
  return {
    id: row.id,
    name: row.name,
    niche: row.niche,
    owner: row.owner,
    platformHandle: row.platformHandle,
    videoGenTool: row.videoGenTool,
    needsVoiceover: row.needsVoiceover,
    voiceStyle: row.voiceStyle,
    accentColor: row.accentColor,
    createdAt: row.createdAt.toISOString(),
  };
}

function toPlanDTO(
  row: typeof dailyPlans.$inferSelect,
  insightDateById: Map<string, Date>
): DailyPlanDTO {
  const informedByInsightDate = row.informedByInsightId
    ? insightDateById.get(row.informedByInsightId) ?? null
    : null;
  return {
    id: row.id,
    channelId: row.channelId,
    ideaTitle: row.ideaTitle,
    hook: row.hook,
    videoPrompt: row.videoPrompt,
    voiceoverScript: row.voiceoverScript,
    postStatus: row.postStatus,
    postedAt: row.postedAt ? row.postedAt.toISOString() : null,
    informedByInsightId: row.informedByInsightId,
    informedByInsightDate: informedByInsightDate ? informedByInsightDate.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toVideoDTO(row: typeof postedVideos.$inferSelect): PostedVideoDTO {
  return {
    id: row.id,
    channelId: row.channelId,
    dailyPlanId: row.dailyPlanId,
    ideaTitle: row.ideaTitle,
    platformVideoId: row.platformVideoId,
    postedAt: row.postedAt.toISOString(),
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    avgViewDuration: row.avgViewDuration,
    retentionNote: row.retentionNote,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
  };
}

export async function GET() {
  const [allChannels, allInsights, allPlans, allVideos, settings] = await Promise.all([
    db.select().from(channels).orderBy(asc(channels.createdAt)),
    db.select().from(insights).orderBy(asc(insights.date)),
    db.select().from(dailyPlans).orderBy(asc(dailyPlans.createdAt)),
    db.select().from(postedVideos).orderBy(asc(postedVideos.postedAt)),
    getSettings(),
  ]);

  const insightDateById = new Map(allInsights.map((row) => [row.id, row.date]));

  const data: ExportDataDTO = {
    exportedAt: new Date().toISOString(),
    channels: allChannels.map(toChannelDTO),
    insights: allInsights.map(toInsightDTO),
    dailyPlans: allPlans.map((row) => toPlanDTO(row, insightDateById)),
    postedVideos: allVideos.map(toVideoDTO),
    settings,
  };

  const filename = `shorts-factory-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
