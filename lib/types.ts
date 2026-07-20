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
  informedByInsightId: string | null;
  informedByInsightDate: string | null;
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

export type InsightSource = 'claude' | 'manual';

export interface InsightDTO {
  id: string;
  channelId: string;
  date: string;
  summary: string;
  recommendations: string[];
  source: InsightSource;
  createdAt: string;
}

export interface ChannelActivity {
  recentPlans: DailyPlanDTO[];
  latestInsight: InsightDTO | null;
}

export interface InsightEntryDTO {
  channel: ChannelDTO;
  videoCount: number;
  latest: InsightDTO | null;
  history: InsightDTO[];
}

export interface ChannelGrowth {
  channelId: string;
  name: string;
  accentColor: string;
  thisWeekViews: number;
  lastWeekViews: number;
  delta: number;
}

export interface PortfolioSummaryDTO {
  totalViewsThisWeek: number;
  totalViewsLastWeek: number;
  totalViewsDelta: number;
  fastestGrowing: ChannelGrowth | null;
  lagging: ChannelGrowth | null;
  hasEnoughData: boolean;
}

export interface ManualInsightPayload {
  summary: string;
  recommendations: string[];
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
