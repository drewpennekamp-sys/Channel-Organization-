import { NextResponse } from 'next/server';
import { asc, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, postedVideos } from '@/lib/db/schema';
import type { ChannelDTO, PostedVideoDTO, VideoLogEntryDTO } from '@/lib/types';

export const dynamic = 'force-dynamic';

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
  const allChannels = await db.select().from(channels).orderBy(asc(channels.createdAt));
  const allVideos = await db.select().from(postedVideos).orderBy(desc(postedVideos.postedAt));

  const videosByChannel = new Map<string, PostedVideoDTO[]>();
  for (const video of allVideos) {
    const dto = toVideoDTO(video);
    const list = videosByChannel.get(dto.channelId);
    if (list) list.push(dto);
    else videosByChannel.set(dto.channelId, [dto]);
  }

  const entries: VideoLogEntryDTO[] = allChannels.map((channel) => ({
    channel: toChannelDTO(channel),
    videos: videosByChannel.get(channel.id) ?? [],
  }));

  return NextResponse.json({ entries }, { headers: { 'Cache-Control': 'no-store' } });
}
