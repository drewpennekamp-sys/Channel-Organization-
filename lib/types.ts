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
  postStatus: PostStatus;
  createdAt: string;
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

export interface ChannelFormValues {
  name: string;
  niche: string;
  owner: Owner;
  platformHandle: string;
  videoGenTool: string;
  needsVoiceover: boolean;
  voiceStyle: string;
}
