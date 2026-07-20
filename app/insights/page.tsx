import { asc, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, insights, postedVideos } from '@/lib/db/schema';
import { toInsightDTO } from '@/lib/insights';
import { computePortfolioSummary } from '@/lib/portfolio';
import { anthropicKeyStatus } from '@/lib/envKeys';
import type { ChannelDTO, InsightEntryDTO, OwnerView, PortfolioSummaryDTO, PostedVideoDTO } from '@/lib/types';
import { InsightsScreen } from '@/components/InsightsScreen';

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

async function getInitialData() {
  const allChannels = await db.select().from(channels).orderBy(asc(channels.createdAt));
  const allVideos = await db.select().from(postedVideos).orderBy(desc(postedVideos.postedAt));
  const allInsights = await db.select().from(insights).orderBy(desc(insights.date));

  const videosByChannel = new Map<string, PostedVideoDTO[]>();
  for (const video of allVideos) {
    const dto = toVideoDTO(video);
    const list = videosByChannel.get(dto.channelId);
    if (list) list.push(dto);
    else videosByChannel.set(dto.channelId, [dto]);
  }

  const insightsByChannel = new Map<string, ReturnType<typeof toInsightDTO>[]>();
  for (const row of allInsights) {
    const dto = toInsightDTO(row);
    const list = insightsByChannel.get(dto.channelId);
    if (list) list.push(dto);
    else insightsByChannel.set(dto.channelId, [dto]);
  }

  const entries: InsightEntryDTO[] = allChannels.map((channel) => {
    const videos = videosByChannel.get(channel.id) ?? [];
    const history = insightsByChannel.get(channel.id) ?? [];
    return {
      channel: toChannelDTO(channel),
      videoCount: videos.length,
      latest: history[0] ?? null,
      history,
    };
  });

  const channelDataForPortfolio = allChannels.map((channel) => ({
    channel: toChannelDTO(channel),
    videos: videosByChannel.get(channel.id) ?? [],
  }));

  const portfolioByView: Record<OwnerView, PortfolioSummaryDTO> = {
    all: computePortfolioSummary(channelDataForPortfolio),
    you: computePortfolioSummary(channelDataForPortfolio.filter((c) => c.channel.owner === 'you')),
    friend: computePortfolioSummary(
      channelDataForPortfolio.filter((c) => c.channel.owner === 'friend')
    ),
  };

  return { entries, portfolioByView };
}

export default async function Page() {
  const { entries, portfolioByView } = await getInitialData();
  return (
    <InsightsScreen
      initialEntries={entries}
      portfolioByView={portfolioByView}
      anthropicKeyPresent={anthropicKeyStatus().present}
    />
  );
}
