export type Owner = 'you' | 'friend';

export type PostStatus = 'idea' | 'scripted' | 'rendering' | 'scheduled' | 'posted';

export interface ChannelDTO {
  id: string;
  name: string;
  niche: string;
  owner: Owner;
  platformHandle: string | null;
  videoGenTool: string;
  needsVoiceover: boolean;
  voiceStyle: string | null;
  accentColor: string;
  createdAt: string;
}

export interface DailyPlanDTO {
  id: string;
  channelId: string;
  ideaTitle: string;
  hook: string | null;
  videoPrompt: string | null;
  voiceoverScript: string | null;
  postStatus: PostStatus;
  postedAt: string | null;
  createdAt: string;
}

export interface PostedVideoDTO {
  id: string;
  dailyPlanId: string;
  channelId: string;
  views: number;
  likes: number;
  comments: number;
  postedAt: string;
}

export interface InsightDTO {
  id: string;
  channelId: string;
  summary: string;
  createdAt: string;
}

export interface ChannelActivity {
  recentPlans: DailyPlanDTO[];
  latestInsight: InsightDTO | null;
}

export type DashboardCardState = 'no-idea' | 'idea' | 'posted';

export interface DashboardEntryDTO {
  channel: ChannelDTO;
  plan: DailyPlanDTO | null;
}

export interface ChannelFormValues {
  name: string;
  niche: string;
  owner: Owner;
  platformHandle: string;
  videoGenTool: string;
  needsVoiceover: boolean;
  voiceStyle: string;
}
