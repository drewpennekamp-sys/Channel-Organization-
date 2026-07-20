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

export interface MonthlyTargetProgress {
  postsThisMonth: number;
  targetPerDay: number;
  expectedByNow: number;
  onPace: boolean;
}

/**
 * Compares posts made so far this calendar month against a prorated target
 * (target/day * days elapsed, today inclusive) rather than the full-month
 * target, so "on pace" reads correctly on the 3rd as well as the 30th.
 */
export function computeMonthlyTargetProgress(
  videos: PostedVideoDTO[],
  targetPerDay: number,
  now: Date = new Date()
): MonthlyTargetProgress {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysElapsed = now.getDate();

  let postsThisMonth = 0;
  for (const video of videos) {
    const postedAt = new Date(video.postedAt);
    if (postedAt.getFullYear() === year && postedAt.getMonth() === month) {
      postsThisMonth += 1;
    }
  }

  const expectedByNow = targetPerDay * daysElapsed;

  return {
    postsThisMonth,
    targetPerDay,
    expectedByNow,
    onPace: postsThisMonth >= expectedByNow,
  };
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
