'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import type { ChannelDTO } from '@/lib/types';
import { deleteChannel } from '@/lib/client-api';
import { ChannelGrid } from './ChannelGrid';
import { EmptyState } from './EmptyState';
import { ChannelPanel } from './ChannelPanel';

type PanelState =
  | { mode: 'add' }
  | { mode: 'edit'; channel: ChannelDTO }
  | { mode: 'view'; channel: ChannelDTO }
  | null;

export function ChannelsScreen({
  initialChannels,
  defaultVideoGenTool,
}: {
  initialChannels: ChannelDTO[];
  defaultVideoGenTool: string;
}) {
  const [channels, setChannels] = useState<ChannelDTO[]>(initialChannels);
  const [panel, setPanel] = useState<PanelState>(null);

  function handleCreated(channel: ChannelDTO) {
    setChannels((prev) => [...prev, channel]);
    setPanel(null);
  }

  function handleUpdated(channel: ChannelDTO) {
    setChannels((prev) => prev.map((c) => (c.id === channel.id ? channel : c)));
    setPanel(null);
  }

  async function handleDelete(channel: ChannelDTO) {
    await deleteChannel(channel.id);
    setChannels((prev) => prev.filter((c) => c.id !== channel.id));
    setPanel((current) => (current?.mode !== 'add' && current?.channel.id === channel.id ? null : current));
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-zinc-50">
            Channels
          </h1>
          <p className="mt-1 text-sm font-light text-zinc-400">
            Everything Shorts Factory produces content for.
          </p>
        </div>

        {channels.length > 0 && (
          <button
            type="button"
            onClick={() => setPanel({ mode: 'add' })}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3.5 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
          >
            <Plus size={16} />
            Add channel
          </button>
        )}
      </div>

      <div className="mt-8">
        {channels.length === 0 ? (
          <EmptyState onAdd={() => setPanel({ mode: 'add' })} />
        ) : (
          <ChannelGrid
            channels={channels}
            onView={(channel) => setPanel({ mode: 'view', channel })}
            onEdit={(channel) => setPanel({ mode: 'edit', channel })}
            onDelete={handleDelete}
          />
        )}
      </div>

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
          <ChannelPanel
            key="panel"
            mode={panel.mode}
            channel={panel.mode === 'add' ? undefined : panel.channel}
            defaultVideoGenTool={defaultVideoGenTool}
            existingChannels={channels}
            onClose={() => setPanel(null)}
            onCreated={handleCreated}
            onUpdated={handleUpdated}
            onRequestEdit={(channel) => setPanel({ mode: 'edit', channel })}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
