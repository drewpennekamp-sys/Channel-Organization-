import type {
  ChannelDTO,
  DailyPlanDTO,
  InsightDTO,
  PostedVideoDTO,
  SettingsDTO,
} from './types';
import type { ImportDataInput } from './validation';
import { db } from './db/client';
import { channels, dailyPlans, insights, postedVideos } from './db/schema';
import { updateSettings } from './settings';

export interface ExportDataDTO {
  exportedAt: string;
  channels: ChannelDTO[];
  insights: InsightDTO[];
  dailyPlans: DailyPlanDTO[];
  postedVideos: PostedVideoDTO[];
  settings: SettingsDTO;
}

export interface TodayPromptEntry {
  channel: ChannelDTO;
  plan: DailyPlanDTO | null;
}

export function buildTodayMarkdown(entries: TodayPromptEntry[], now: Date = new Date()): string {
  const dateLabel = now.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sections = entries.map(({ channel, plan }) => {
    const lines = [`## ${channel.name}`];

    if (!plan) {
      lines.push('_No idea generated yet._');
    } else if (plan.postStatus === 'posted') {
      lines.push("_Already posted today's idea — nothing pending._");
    } else {
      lines.push(`**Idea:** ${plan.ideaTitle}`);
      if (plan.hook) lines.push(`**Hook:** ${plan.hook}`);
      if (plan.videoPrompt) lines.push(`**Video prompt:**\n${plan.videoPrompt}`);
      if (channel.needsVoiceover && plan.voiceoverScript) {
        lines.push(`**Voiceover script:**\n${plan.voiceoverScript}`);
      }
    }

    return lines.join('\n\n');
  });

  return [`# Shorts Factory — Today's Prompts (${dateLabel})`, ...sections].join('\n\n---\n\n');
}

export interface ImportCounts {
  channels: number;
  insights: number;
  dailyPlans: number;
  postedVideos: number;
}

/**
 * Wipes and reloads every table from a validated backup. Shared by the
 * in-app "Import data" route and the one-time `scripts/import-backup.ts`
 * migration script so the two entry points can never drift apart.
 */
export async function applyImport(data: ImportDataInput): Promise<ImportCounts> {
  // Deleting channels cascades to insights/daily_plans/posted_videos, so
  // this alone clears every table the import is about to repopulate.
  await db.delete(channels);

  if (data.channels.length > 0) {
    await db.insert(channels).values(
      data.channels.map((c) => ({
        id: c.id,
        name: c.name,
        niche: c.niche,
        owner: c.owner,
        platformHandle: c.platformHandle,
        videoGenTool: c.videoGenTool,
        needsVoiceover: c.needsVoiceover,
        voiceStyle: c.voiceStyle,
        accentColor: c.accentColor,
        createdAt: new Date(c.createdAt),
      }))
    );
  }

  if (data.insights.length > 0) {
    await db.insert(insights).values(
      data.insights.map((i) => ({
        id: i.id,
        channelId: i.channelId,
        date: new Date(i.date),
        summary: i.summary,
        recommendations: JSON.stringify(i.recommendations),
        source: i.source,
        createdAt: new Date(i.createdAt),
      }))
    );
  }

  if (data.dailyPlans.length > 0) {
    await db.insert(dailyPlans).values(
      data.dailyPlans.map((p) => ({
        id: p.id,
        channelId: p.channelId,
        ideaTitle: p.ideaTitle,
        hook: p.hook,
        videoPrompt: p.videoPrompt,
        voiceoverScript: p.voiceoverScript,
        postStatus: p.postStatus,
        postedAt: p.postedAt ? new Date(p.postedAt) : null,
        informedByInsightId: p.informedByInsightId,
        createdAt: new Date(p.createdAt),
      }))
    );
  }

  if (data.postedVideos.length > 0) {
    await db.insert(postedVideos).values(
      data.postedVideos.map((v) => ({
        id: v.id,
        channelId: v.channelId,
        dailyPlanId: v.dailyPlanId,
        ideaTitle: v.ideaTitle,
        platformVideoId: v.platformVideoId,
        postedAt: new Date(v.postedAt),
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        shares: v.shares,
        avgViewDuration: v.avgViewDuration,
        retentionNote: v.retentionNote,
        lastSyncedAt: v.lastSyncedAt ? new Date(v.lastSyncedAt) : null,
      }))
    );
  }

  await updateSettings(data.settings);

  return {
    channels: data.channels.length,
    insights: data.insights.length,
    dailyPlans: data.dailyPlans.length,
    postedVideos: data.postedVideos.length,
  };
}
