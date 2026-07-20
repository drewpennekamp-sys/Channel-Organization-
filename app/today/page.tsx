import { asc, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, dailyPlans, insights, postedVideos } from '@/lib/db/schema';
import { computePortfolioSummary } from '@/lib/portfolio';
import { getSettings } from '@/lib/settings';
import { anthropicKeyStatus } from '@/lib/envKeys';
import type {
  ChannelDTO,
  DailyPlanDTO,
  DashboardEntryDTO,
  OwnerView,
  PortfolioSummaryDTO,
  PostedVideoDTO,
} from '@/lib/types';
import { TodayScreen } from '@/components/TodayScreen';

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

async function getInitialData() {
  const allChannels = await db.select().from(channels).orderBy(asc(channels.createdAt));
  const allPlans = await db.select().from(dailyPlans).orderBy(desc(dailyPlans.createdAt));
  const allInsights = await db.select({ id: insights.id, date: insights.date }).from(insights);
  const allVideos = await db.select().from(postedVideos);
  const insightDateById = new Map(allInsights.map((i) => [i.id, i.date]));

  const latestPlanByChannel = new Map<string, typeof allPlans[number]>();
  for (const plan of allPlans) {
    if (!latestPlanByChannel.has(plan.channelId)) {
      latestPlanByChannel.set(plan.channelId, plan);
    }
  }

  const entries: DashboardEntryDTO[] = allChannels.map((channel) => {
    const plan = latestPlanByChannel.get(channel.id);
    return {
      channel: toChannelDTO(channel),
      plan: plan ? toPlanDTO(plan, insightDateById) : null,
    };
  });

  const videosByChannel = new Map<string, PostedVideoDTO[]>();
  for (const video of allVideos) {
    const dto = toVideoDTO(video);
    const list = videosByChannel.get(dto.channelId);
    if (list) list.push(dto);
    else videosByChannel.set(dto.channelId, [dto]);
  }
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
  const settings = await getSettings();

  return (
    <TodayScreen
      initialEntries={entries}
      portfolioByView={portfolioByView}
      settings={settings}
      anthropicKeyPresent={anthropicKeyStatus().present}
    />
  );
}
