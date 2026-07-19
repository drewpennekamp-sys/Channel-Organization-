'use client';

import { useEffect, useRef } from 'react';

export function ConfirmDeletePopover({
  channelName,
  onCancel,
  onConfirm,
  isDeleting,
}: {
  channelName: string;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onCancel]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Confirm delete ${channelName}`}
      onClick={(e) => e.stopPropagation()}
      className="animate-pop-in absolute right-0 top-full z-30 mt-2 w-64 origin-top-right rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-xl shadow-black/40"
    >
      <p className="text-sm text-zinc-200">
        Delete <span className="font-medium">{channelName}</span>? This also removes its saved
        ideas and history.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isDeleting}
          className="rounded-md bg-rose-500/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
