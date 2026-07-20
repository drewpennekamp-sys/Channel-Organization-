'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import type { PostedVideoDTO } from '@/lib/types';
import { formatCompactNumber, formatDuration } from '@/lib/videoLog';
import { cn } from '@/lib/cn';
import { RetentionNoteCell } from './RetentionNoteCell';
import { ConfirmDeletePopover } from './ConfirmDeletePopover';

type SortKey = 'postedAt' | 'views' | 'likes' | 'comments' | 'avgViewDuration';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'postedAt', label: 'Posted' },
  { key: 'views', label: 'Views' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'avgViewDuration', label: 'Avg view' },
];

function sortValue(video: PostedVideoDTO, key: SortKey): number {
  if (key === 'postedAt') return new Date(video.postedAt).getTime();
  if (key === 'avgViewDuration') return video.avgViewDuration ?? -1;
  return video[key];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function VideoLogTable({
  videos,
  accentColor,
  bestVideoId,
  onEdit,
  onDelete,
  onSaveRetentionNote,
}: {
  videos: PostedVideoDTO[];
  accentColor: string;
  bestVideoId: string | null;
  onEdit: (video: PostedVideoDTO) => void;
  onDelete: (video: PostedVideoDTO) => Promise<void>;
  onSaveRetentionNote: (video: PostedVideoDTO, note: string | null) => Promise<void>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('postedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [busyDeletingId, setBusyDeletingId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const copy = [...videos];
    copy.sort((a, b) => {
      const diff = sortValue(a, sortKey) - sortValue(b, sortKey);
      return sortDir === 'asc' ? diff : -diff;
    });
    return copy;
  }, [videos, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  async function handleConfirmDelete(video: PostedVideoDTO) {
    setBusyDeletingId(video.id);
    try {
      await onDelete(video);
    } finally {
      setBusyDeletingId(null);
      setDeletingRowId(null);
    }
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              <th className="w-8 py-2 pr-2" aria-label="Retention note" />
              <th className="py-2 pr-3 font-medium">Idea</th>
              {COLUMNS.map((col) => (
                <th key={col.key} className="py-2 pr-3 text-right font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      'inline-flex items-center gap-1 transition-colors hover:text-zinc-200',
                      sortKey === col.key && 'text-zinc-200'
                    )}
                  >
                    {col.label}
                    {sortKey === col.key &&
                      (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              ))}
              <th className="w-16 py-2" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((video) => {
              const isBest = video.id === bestVideoId;
              return (
                <tr
                  key={video.id}
                  onClick={() => onEdit(video)}
                  style={isBest ? { boxShadow: `inset 3px 0 0 0 ${accentColor}` } : undefined}
                  className="group cursor-pointer border-t border-zinc-800/70 transition-colors hover:bg-zinc-800/30"
                >
                  <td className="py-2.5 pr-2 pl-2">
                    <RetentionNoteCell
                      note={video.retentionNote}
                      onSave={(note) => onSaveRetentionNote(video, note)}
                    />
                  </td>
                  <td className="max-w-[280px] py-2.5 pr-3">
                    <span className="block truncate text-zinc-100" title={video.ideaTitle}>
                      {video.ideaTitle}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-[13px] tabular-nums text-zinc-400">
                    {formatDate(video.postedAt)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-[13px] tabular-nums text-zinc-100">
                    {formatCompactNumber(video.views)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-[13px] tabular-nums text-zinc-300">
                    {formatCompactNumber(video.likes)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-[13px] tabular-nums text-zinc-300">
                    {formatCompactNumber(video.comments)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-[13px] tabular-nums text-zinc-300">
                    {formatDuration(video.avgViewDuration)}
                  </td>
                  <td className="relative py-2.5 pl-1 pr-2">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        aria-label={`Edit ${video.ideaTitle}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(video);
                        }}
                        className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${video.ideaTitle}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingRowId(video.id);
                        }}
                        className="rounded-md p-1.5 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {deletingRowId === video.id && (
                      <ConfirmDeletePopover
                        itemName={video.ideaTitle}
                        message="This removes it from the video log permanently."
                        isDeleting={busyDeletingId === video.id}
                        onCancel={() => setDeletingRowId(null)}
                        onConfirm={() => handleConfirmDelete(video)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="space-y-2.5 md:hidden">
        {sorted.map((video) => {
          const isBest = video.id === bestVideoId;
          return (
            <div
              key={video.id}
              onClick={() => onEdit(video)}
              style={isBest ? { boxShadow: `inset 3px 0 0 0 ${accentColor}` } : undefined}
              className="cursor-pointer rounded-lg bg-zinc-800/40 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium text-zinc-100" title={video.ideaTitle}>
                  {video.ideaTitle}
                </p>
                <div className="flex shrink-0 items-center gap-0.5">
                  <RetentionNoteCell
                    note={video.retentionNote}
                    align="right"
                    onSave={(note) => onSaveRetentionNote(video, note)}
                  />
                  <button
                    type="button"
                    aria-label={`Edit ${video.ideaTitle}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(video);
                    }}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    <Pencil size={13} />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={`Delete ${video.ideaTitle}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingRowId(video.id);
                      }}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400"
                    >
                      <Trash2 size={13} />
                    </button>
                    {deletingRowId === video.id && (
                      <ConfirmDeletePopover
                        itemName={video.ideaTitle}
                        message="This removes it from the video log permanently."
                        isDeleting={busyDeletingId === video.id}
                        onCancel={() => setDeletingRowId(null)}
                        onConfirm={() => handleConfirmDelete(video)}
                      />
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-1 font-mono text-xs tabular-nums text-zinc-500">
                {formatDate(video.postedAt)}
              </p>
              <div className="mt-2.5 grid grid-cols-4 gap-2 font-mono text-xs tabular-nums">
                <Stat label="Views" value={formatCompactNumber(video.views)} emphasize />
                <Stat label="Likes" value={formatCompactNumber(video.likes)} />
                <Stat label="Comments" value={formatCompactNumber(video.comments)} />
                <Stat label="Avg view" value={formatDuration(video.avgViewDuration)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-sans uppercase tracking-wide text-zinc-600">{label}</div>
      <div className={cn(emphasize ? 'text-zinc-100' : 'text-zinc-400')}>{value}</div>
    </div>
  );
}
