import { NextResponse } from 'next/server';
import { asc, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, dailyPlans } from '@/lib/db/schema';
import { buildTodayMarkdown, type TodayPromptEntry } from '@/lib/exportImport';
import type { ChannelDTO, DailyPlanDTO } from '@/lib/types';

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
    informedByInsightId: row.informedByInsightId,
    informedByInsightDate: null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET() {
  const allChannels = await db.select().from(channels).orderBy(asc(channels.createdAt));
  const allPlans = await db.select().from(dailyPlans).orderBy(desc(dailyPlans.createdAt));

  const latestPlanByChannel = new Map<string, typeof allPlans[number]>();
  for (const plan of allPlans) {
    if (!latestPlanByChannel.has(plan.channelId)) {
      latestPlanByChannel.set(plan.channelId, plan);
    }
  }

  const entries: TodayPromptEntry[] = allChannels.map((channel) => {
    const plan = latestPlanByChannel.get(channel.id);
    return { channel: toChannelDTO(channel), plan: plan ? toPlanDTO(plan) : null };
  });

  const markdown = buildTodayMarkdown(entries);
  const filename = `shorts-factory-today-${new Date().toISOString().slice(0, 10)}.md`;

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
