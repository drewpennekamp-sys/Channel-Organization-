'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Plus, RefreshCw } from 'lucide-react';
import type { ChannelDTO, PostedVideoDTO } from '@/lib/types';
import {
  computeChannelStats,
  computeMonthlyTargetProgress,
  formatCompactNumber,
  formatRelativeTime,
  latestSyncedAt,
} from '@/lib/videoLog';
import { VideoLogTable } from './VideoLogTable';

export function ChannelLogSection({
  channel,
  videos,
  targetPerDay,
  isSyncing,
  onSync,
  onAddVideo,
  onEditVideo,
  onDeleteVideo,
  onSaveRetentionNote,
}: {
  channel: ChannelDTO;
  videos: PostedVideoDTO[];
  targetPerDay: number;
  isSyncing: boolean;
  onSync: () => void;
  onAddVideo: () => void;
  onEditVideo: (video: PostedVideoDTO) => void;
  onDeleteVideo: (video: PostedVideoDTO) => Promise<void>;
  onSaveRetentionNote: (video: PostedVideoDTO, note: string | null) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const stats = computeChannelStats(videos);
  const progress = computeMonthlyTargetProgress(videos, targetPerDay);

  const summaryLine =
    stats.count === 0
      ? 'No videos logged yet'
      : `${stats.count} video${stats.count === 1 ? '' : 's'} · ${formatCompactNumber(
          stats.totalViews
        )} views · ${formatCompactNumber(stats.avgViews)} avg/video · Best: "${truncateInline(
          stats.best!.ideaTitle
        )}" (${formatCompactNumber(stats.best!.views)})`;

  return (
    <section
      style={{ borderLeftColor: channel.accentColor }}
      className="rounded-xl border-l-[3px] bg-zinc-900 ring-1 ring-white/[0.04]"
    >
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex min-w-0 items-center gap-3 text-left sm:flex-1"
        >
          {collapsed ? (
            <ChevronRight size={16} className="shrink-0 text-zinc-500" />
          ) : (
            <ChevronDown size={16} className="shrink-0 text-zinc-500" />
          )}
          <div className="min-w-0">
            <h2 className="truncate font-heading text-base font-semibold tracking-tight text-zinc-50">
              {channel.name}
            </h2>
            <p className="mt-0.5 truncate text-xs font-light text-zinc-500">{summaryLine}</p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`hidden text-xs font-light sm:inline ${
              progress.onPace ? 'text-zinc-500' : 'text-amber-400/80'
            }`}
            title={`${progress.postsThisMonth} posted this month vs. a target of ${progress.targetPerDay}/day`}
          >
            {progress.postsThisMonth}/{progress.expectedByNow} this month
          </span>
          <span className="hidden text-xs font-light text-zinc-600 sm:inline">
            Last synced: {formatRelativeTime(latestSyncedAt(videos))}
          </span>
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing || videos.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSyncing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            {isSyncing ? `Syncing ${channel.name}...` : 'Sync from vidIQ'}
          </button>
          <button
            type="button"
            onClick={onAddVideo}
            className="flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-white"
          >
            <Plus size={12} />
            Add video
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-zinc-800 px-5 py-4">
          {videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm font-light text-zinc-500">
                No videos logged yet — mark one posted on the Dashboard or add one manually.
              </p>
              <button
                type="button"
                onClick={onAddVideo}
                className="mt-4 flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
              >
                <Plus size={14} />
                Add video
              </button>
            </div>
          ) : (
            <VideoLogTable
              videos={videos}
              accentColor={channel.accentColor}
              bestVideoId={stats.best?.id ?? null}
              onEdit={onEditVideo}
              onDelete={onDeleteVideo}
              onSaveRetentionNote={onSaveRetentionNote}
            />
          )}
        </div>
      )}
    </section>
  );
}

function truncateInline(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
