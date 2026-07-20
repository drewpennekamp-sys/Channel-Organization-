import { asc, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, dailyPlans } from '@/lib/db/schema';
import type { ChannelDTO, DailyPlanDTO, DashboardEntryDTO } from '@/lib/types';
import { DashboardScreen } from '@/components/DashboardScreen';

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

function toPlanDTO(row: typeof dailyPlans.$inferSelect): DailyPlanDTO {
  return {
    id: row.id,
    channelId: row.channelId,
    ideaTitle: row.ideaTitle,
    hook: row.hook,
    videoPrompt: row.videoPrompt,
    voiceoverScript: row.voiceoverScript,
    postStatus: row.postStatus,
    postedAt: row.postedAt ? row.postedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function getInitialEntries(): Promise<DashboardEntryDTO[]> {
  const allChannels = await db.select().from(channels).orderBy(asc(channels.createdAt));
  const allPlans = await db.select().from(dailyPlans).orderBy(desc(dailyPlans.createdAt));

  const latestPlanByChannel = new Map<string, typeof allPlans[number]>();
  for (const plan of allPlans) {
    if (!latestPlanByChannel.has(plan.channelId)) {
      latestPlanByChannel.set(plan.channelId, plan);
    }
  }

  return allChannels.map((channel) => {
    const plan = latestPlanByChannel.get(channel.id);
    return {
      channel: toChannelDTO(channel),
      plan: plan ? toPlanDTO(plan) : null,
    };
  });
}

export default async function Page() {
  const entries = await getInitialEntries();
  return <DashboardScreen initialEntries={entries} />;
}
