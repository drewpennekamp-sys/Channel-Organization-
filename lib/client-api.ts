import type {
  ChannelActivity,
  ChannelDTO,
  ChannelFormValues,
  DailyPlanDTO,
  DashboardEntryDTO,
  InsightDTO,
  InsightEntryDTO,
  ManualInsightPayload,
  OwnerView,
  PortfolioSummaryDTO,
  PostedVideoDTO,
  SettingsDTO,
  SettingsResponseDTO,
  VideoLogEntryDTO,
  VideoPayload,
} from './types';
import { downloadBlob } from './download';

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
  const res = await fetch('/api/channels', { cache: 'no-store' });
  const data = await handle<{ channels: ChannelDTO[] }>(res);
  return data.channels;
}

export async function fetchVideoLog(): Promise<VideoLogEntryDTO[]> {
  const res = await fetch('/api/video-log', { cache: 'no-store' });
  const data = await handle<{ entries: VideoLogEntryDTO[] }>(res);
  return data.entries;
}

export async function fetchInsights(): Promise<{
  entries: InsightEntryDTO[];
  portfolioByView: Record<OwnerView, PortfolioSummaryDTO>;
}> {
  const res = await fetch('/api/insights', { cache: 'no-store' });
  return handle(res);
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
  const res = await fetch('/api/dashboard', { cache: 'no-store' });
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

export async function fetchSettings(): Promise<SettingsResponseDTO> {
  const res = await fetch('/api/settings');
  return handle(res);
}

export async function updateSettingsApi(partial: Partial<SettingsDTO>): Promise<SettingsResponseDTO> {
  const res = await fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  });
  return handle(res);
}

async function downloadFrom(path: string, filename: string): Promise<void> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? 'Export failed');
  }
  const blob = await res.blob();
  downloadBlob(blob, filename);
}

export async function exportTodayPrompts(): Promise<void> {
  await downloadFrom(
    '/api/export/today',
    `shorts-factory-today-${new Date().toISOString().slice(0, 10)}.md`
  );
}

export async function exportAllData(): Promise<void> {
  await downloadFrom(
    '/api/export/all',
    `shorts-factory-backup-${new Date().toISOString().slice(0, 10)}.json`
  );
}

export async function importData(data: unknown): Promise<{ counts: Record<string, number> }> {
  const res = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handle(res);
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
