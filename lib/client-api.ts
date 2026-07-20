import type {
  ChannelActivity,
  ChannelDTO,
  ChannelFormValues,
  DailyPlanDTO,
  DashboardEntryDTO,
  InsightDTO,
  ManualInsightPayload,
  PostedVideoDTO,
  VideoPayload,
} from './types';

export class ApiError extends Error {
  fieldErrors?: Record<string, string[]>;
  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Something went wrong', body.fieldErrors);
  }
  return body as T;
}

function toPayload(values: ChannelFormValues) {
  return {
    name: values.name,
    niche: values.niche,
    owner: values.owner,
    platformHandle: values.platformHandle || null,
    videoGenTool: values.videoGenTool,
    needsVoiceover: values.needsVoiceover,
    voiceStyle: values.needsVoiceover ? values.voiceStyle || null : null,
  };
}

export async function fetchChannels(): Promise<ChannelDTO[]> {
  const res = await fetch('/api/channels');
  const data = await handle<{ channels: ChannelDTO[] }>(res);
  return data.channels;
}

export async function fetchChannelDetail(
  id: string
): Promise<{ channel: ChannelDTO; activity: ChannelActivity }> {
  const res = await fetch(`/api/channels/${id}`);
  return handle(res);
}

export async function createChannel(values: ChannelFormValues): Promise<ChannelDTO> {
  const res = await fetch('/api/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toPayload(values)),
  });
  const data = await handle<{ channel: ChannelDTO }>(res);
  return data.channel;
}

export async function updateChannel(id: string, values: ChannelFormValues): Promise<ChannelDTO> {
  const res = await fetch(`/api/channels/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toPayload(values)),
  });
  const data = await handle<{ channel: ChannelDTO }>(res);
  return data.channel;
}

export async function deleteChannel(id: string): Promise<void> {
  const res = await fetch(`/api/channels/${id}`, { method: 'DELETE' });
  await handle(res);
}

export async function fetchDashboard(): Promise<DashboardEntryDTO[]> {
  const res = await fetch('/api/dashboard');
  const data = await handle<{ entries: DashboardEntryDTO[] }>(res);
  return data.entries;
}

export async function generateIdeaForChannel(channelId: string): Promise<DailyPlanDTO> {
  const res = await fetch(`/api/channels/${channelId}/generate-idea`, { method: 'POST' });
  const data = await handle<{ plan: DailyPlanDTO }>(res);
  return data.plan;
}

export async function markChannelPosted(
  channelId: string,
  stats: { views: number; likes: number; comments: number }
): Promise<DailyPlanDTO> {
  const res = await fetch(`/api/channels/${channelId}/mark-posted`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stats),
  });
  const data = await handle<{ plan: DailyPlanDTO }>(res);
  return data.plan;
}

export async function createVideoForChannel(
  channelId: string,
  payload: VideoPayload
): Promise<PostedVideoDTO> {
  const res = await fetch(`/api/channels/${channelId}/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ video: PostedVideoDTO }>(res);
  return data.video;
}

export async function updateVideo(
  videoId: string,
  payload: Partial<VideoPayload>
): Promise<PostedVideoDTO> {
  const res = await fetch(`/api/videos/${videoId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ video: PostedVideoDTO }>(res);
  return data.video;
}

export async function deleteVideo(videoId: string): Promise<void> {
  const res = await fetch(`/api/videos/${videoId}`, { method: 'DELETE' });
  await handle(res);
}

export async function syncChannelVideos(channelId: string): Promise<PostedVideoDTO[]> {
  const res = await fetch(`/api/channels/${channelId}/sync-videos`, { method: 'POST' });
  const data = await handle<{ videos: PostedVideoDTO[] }>(res);
  return data.videos;
}

export async function analyzeChannel(channelId: string): Promise<InsightDTO> {
  const res = await fetch(`/api/channels/${channelId}/analyze`, { method: 'POST' });
  const data = await handle<{ insight: InsightDTO }>(res);
  return data.insight;
}

export async function addManualInsight(
  channelId: string,
  payload: ManualInsightPayload
): Promise<InsightDTO> {
  const res = await fetch(`/api/channels/${channelId}/insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ insight: InsightDTO }>(res);
  return data.insight;
}
