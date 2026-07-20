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
  channelId: string;
  dailyPlanId: string | null;
  ideaTitle: string;
  platformVideoId: string | null;
  postedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number | null;
  avgViewDuration: number | null;
  retentionNote: string | null;
  lastSyncedAt: string | null;
}

export interface VideoFormValues {
  ideaTitle: string;
  postedAt: string;
  views: string;
  likes: string;
  comments: string;
  shares: string;
  avgViewDuration: string;
  retentionNote: string;
}

export interface VideoPayload {
  ideaTitle: string;
  postedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number | null;
  avgViewDuration: number | null;
  retentionNote: string | null;
}

export interface VideoLogEntryDTO {
  channel: ChannelDTO;
  videos: PostedVideoDTO[];
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
