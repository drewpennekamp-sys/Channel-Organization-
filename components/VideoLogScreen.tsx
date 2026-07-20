'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';
import type { PostedVideoDTO, SettingsDTO, VideoLogEntryDTO, VideoPayload } from '@/lib/types';
import {
  createVideoForChannel,
  deleteVideo,
  syncChannelVideos,
  updateVideo,
} from '@/lib/client-api';
import { useOwnerFilter, matchesOwnerView } from './OwnerFilterProvider';
import { OwnerViewEmptyState } from './OwnerViewEmptyState';
import { MissingKeyBanner } from './MissingKeyBanner';
import { ChannelLogSection } from './ChannelLogSection';
import { VideoLogPanel } from './VideoLogPanel';

type PanelState =
  | { mode: 'add'; channelId: string; channelName: string }
  | { mode: 'edit'; channelId: string; channelName: string; video: PostedVideoDTO }
  | null;

export function VideoLogScreen({
  initialEntries,
  settings,
  vidiqKeyPresent,
}: {
  initialEntries: VideoLogEntryDTO[];
  settings: SettingsDTO;
  vidiqKeyPresent: boolean;
}) {
  const [entries, setEntries] = useState<VideoLogEntryDTO[]>(initialEntries);
  const [panel, setPanel] = useState<PanelState>(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const { view } = useOwnerFilter();

  const visibleEntries = useMemo(
    () => entries.filter((e) => matchesOwnerView(e.channel.owner, view)),
    [entries, view]
  );

  const channelsWithVideos = useMemo(
    () => visibleEntries.filter((e) => e.videos.length > 0),
    [visibleEntries]
  );
  const syncingAll = channelsWithVideos.some((e) => syncingIds.has(e.channel.id));

  function updateChannelVideos(channelId: string, updater: (videos: PostedVideoDTO[]) => PostedVideoDTO[]) {
    setEntries((prev) =>
      prev.map((e) => (e.channel.id === channelId ? { ...e, videos: updater(e.videos) } : e))
    );
  }

  async function handleCreate(channelId: string, payload: VideoPayload) {
    const video = await createVideoForChannel(channelId, payload);
    updateChannelVideos(channelId, (videos) => [video, ...videos]);
    setPanel(null);
  }

  async function handleUpdate(channelId: string, videoId: string, payload: VideoPayload) {
    const video = await updateVideo(videoId, payload);
    updateChannelVideos(channelId, (videos) => videos.map((v) => (v.id === videoId ? video : v)));
    setPanel(null);
  }

  async function handleDelete(channelId: string, video: PostedVideoDTO) {
    await deleteVideo(video.id);
    updateChannelVideos(channelId, (videos) => videos.filter((v) => v.id !== video.id));
  }

  async function handleSaveRetentionNote(
    channelId: string,
    video: PostedVideoDTO,
    note: string | null
  ) {
    const updated = await updateVideo(video.id, { retentionNote: note });
    updateChannelVideos(channelId, (videos) => videos.map((v) => (v.id === video.id ? updated : v)));
  }

  async function handleSync(channelId: string) {
    setSyncingIds((prev) => new Set(prev).add(channelId));
    try {
      const videos = await syncChannelVideos(channelId);
      updateChannelVideos(channelId, () => videos);
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(channelId);
        return next;
      });
    }
  }

  function handleSyncAll() {
    for (const entry of channelsWithVideos) {
      handleSync(entry.channel.id);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-zinc-50">
            Video Log
          </h1>
          <p className="mt-1 text-sm font-light text-zinc-400">
            The historical record of everything posted, per channel.
          </p>
        </div>

        {entries.length > 0 && (
          <button
            type="button"
            onClick={handleSyncAll}
            disabled={syncingAll || channelsWithVideos.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3.5 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {syncingAll ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            Sync all
          </button>
        )}
      </div>

      {!vidiqKeyPresent && (
        <MissingKeyBanner
          keyLabel="vidIQ credentials"
          reason="background sync won't be able to pull real stats until they're added"
        />
      )}

      {entries.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-24 text-center">
          <h2 className="font-heading text-xl font-semibold tracking-tight text-zinc-50">
            No channels yet
          </h2>
          <p className="mt-2 max-w-sm text-sm font-light leading-relaxed text-zinc-400">
            The video log tracks posted videos per channel. Add a channel first, then post
            something from the Dashboard (or log one manually here).
          </p>
          <Link
            href="/channels"
            className="mt-6 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
          >
            Go to Channels
          </Link>
        </div>
      ) : visibleEntries.length === 0 ? (
        <OwnerViewEmptyState noun="channels" />
      ) : (
        <div className="mt-8 space-y-5">
          {visibleEntries.map(({ channel, videos }) => (
            <ChannelLogSection
              key={channel.id}
              channel={channel}
              videos={videos}
              targetPerDay={settings.defaultPostingTarget}
              isSyncing={syncingIds.has(channel.id)}
              onSync={() => handleSync(channel.id)}
              onAddVideo={() => setPanel({ mode: 'add', channelId: channel.id, channelName: channel.name })}
              onEditVideo={(video) =>
                setPanel({ mode: 'edit', channelId: channel.id, channelName: channel.name, video })
              }
              onDeleteVideo={(video) => handleDelete(channel.id, video)}
              onSaveRetentionNote={(video, note) => handleSaveRetentionNote(channel.id, video, note)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {panel && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setPanel(null)}
          />
        )}
        {panel && (
          <VideoLogPanel
            key="panel"
            mode={panel.mode}
            channelName={panel.channelName}
            video={panel.mode === 'edit' ? panel.video : undefined}
            onClose={() => setPanel(null)}
            onCreate={(payload) => handleCreate(panel.channelId, payload)}
            onUpdate={(payload) =>
              panel.mode === 'edit'
                ? handleUpdate(panel.channelId, panel.video.id, payload)
                : Promise.resolve()
            }
          />
        )}
      </AnimatePresence>
    </main>
  );
}
