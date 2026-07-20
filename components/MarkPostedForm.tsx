'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

function StatField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-400"
      />
    </label>
  );
}

export function MarkPostedForm({
  isSaving,
  error,
  onCancel,
  onSave,
}: {
  isSaving: boolean;
  error?: string;
  onCancel: () => void;
  onSave: (stats: { views: number; likes: number; comments: number }) => void;
}) {
  const [views, setViews] = useState('0');
  const [likes, setLikes] = useState('0');
  const [comments, setComments] = useState('0');

  function toInt(value: string) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-800/30 p-3">
      <p className="text-xs leading-relaxed text-zinc-500">
        Enter 0 for now — this will sync automatically from vidIQ once that&apos;s connected.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <StatField label="Views" value={views} onChange={setViews} />
        <StatField label="Likes" value={likes} onChange={setLikes} />
        <StatField label="Comments" value={comments} onChange={setComments} />
      </div>

      {error && <p className="text-xs text-rose-300">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave({ views: toInt(views), likes: toInt(likes), comments: toInt(comments) })}
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaving && <Loader2 size={12} className="animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
}
