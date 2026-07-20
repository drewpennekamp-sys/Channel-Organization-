import type { PostedVideoDTO } from './types';

export interface ChannelVideoStats {
  count: number;
  totalViews: number;
  avgViews: number;
  best: PostedVideoDTO | null;
}

export function computeChannelStats(videos: PostedVideoDTO[]): ChannelVideoStats {
  if (videos.length === 0) {
    return { count: 0, totalViews: 0, avgViews: 0, best: null };
  }

  let totalViews = 0;
  let best = videos[0];
  for (const video of videos) {
    totalViews += video.views;
    if (video.views > best.views) best = video;
  }

  return {
    count: videos.length,
    totalViews,
    avgViews: Math.round(totalViews / videos.length),
    best,
  };
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value
  );
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds % 1 === 0 ? seconds : seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never synced';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function latestSyncedAt(videos: PostedVideoDTO[]): string | null {
  let latest: string | null = null;
  for (const video of videos) {
    if (video.lastSyncedAt && (!latest || video.lastSyncedAt > latest)) {
      latest = video.lastSyncedAt;
    }
  }
  return latest;
}
