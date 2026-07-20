import type {
  ChannelDTO,
  DailyPlanDTO,
  InsightDTO,
  PostedVideoDTO,
  SettingsDTO,
} from './types';

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
