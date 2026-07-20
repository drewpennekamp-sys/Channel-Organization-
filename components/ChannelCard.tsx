'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { ChannelDTO } from '@/lib/types';
import { OwnerBadge } from './OwnerBadge';
import { MicIndicator } from './MicIndicator';
import { ConfirmDeletePopover } from './ConfirmDeletePopover';

export function ChannelCard({
  channel,
  onView,
  onEdit,
  onDelete,
}: {
  channel: ChannelDTO;
  onView: (channel: ChannelDTO) => void;
  onEdit: (channel: ChannelDTO) => void;
  onDelete: (channel: ChannelDTO) => Promise<void>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete() {
    setIsDeleting(true);
    try {
      await onDelete(channel);
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onView(channel)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView(channel);
        }
      }}
      style={{ ['--accent' as string]: channel.accentColor, borderLeftColor: channel.accentColor }}
      className="group relative flex h-full cursor-pointer flex-col rounded-xl border-l-[3px] bg-zinc-900 p-5 shadow-sm shadow-black/20 ring-1 ring-white/[0.04] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:ring-white/10 hover:shadow-[0_0_24px_-10px_var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-heading text-base font-semibold tracking-tight text-zinc-50">
            {channel.name}
          </h3>
          <p className="mt-1 truncate text-sm font-light text-zinc-400">{channel.niche}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <OwnerBadge owner={channel.owner} />
          <MicIndicator on={channel.needsVoiceover} />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-light text-zinc-500">
          {channel.platformHandle || ' '}
        </span>

        <div
          className={`relative flex shrink-0 items-center gap-1 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${
            confirmOpen ? 'opacity-100' : 'opacity-0'
          }`}
        >

          <button
            type="button"
            aria-label={`Edit ${channel.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(channel);
            }}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            aria-label={`Delete ${channel.name}`}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmOpen(true);
            }}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400"
          >
            <Trash2 size={14} />
          </button>

          {confirmOpen && (
            <ConfirmDeletePopover
              itemName={channel.name}
              onCancel={() => setConfirmOpen(false)}
              onConfirm={handleConfirmDelete}
              isDeleting={isDeleting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
