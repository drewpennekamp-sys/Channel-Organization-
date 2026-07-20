'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export function RetentionNoteCell({
  note,
  onSave,
  align = 'left',
}: {
  note: string | null;
  onSave: (note: string | null) => Promise<void>;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note ?? '');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setDraft(note ?? '');
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open, note]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draft.trim() || null);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={note ? 'Read or edit retention note' : 'Add retention note'}
        title={note ?? 'Add a retention note'}
        className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-zinc-800"
      >
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            note ? 'bg-amber-400' : 'border border-zinc-600 bg-transparent'
          )}
        />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'animate-pop-in absolute top-full z-30 mt-2 w-72 origin-top rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-xl shadow-black/40',
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
          )}
        >
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Retention note</label>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Hook was too slow — cut the intro in half next time"
            rows={3}
            className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-900/60 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-400"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving && <Loader2 size={11} className="animate-spin" />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
