'use client';

import { useOwnerFilter } from './OwnerFilterProvider';

const VIEW_LABEL: Record<string, string> = {
  you: 'You',
  friend: 'Friend',
};

export function OwnerViewEmptyState({ noun }: { noun: string }) {
  const { view, setView } = useOwnerFilter();
  if (view === 'all') return null;

  return (
    <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-16 text-center">
      <p className="text-sm font-light leading-relaxed text-zinc-400">
        No {noun} for <span className="font-medium text-zinc-200">{VIEW_LABEL[view]}</span> yet.
      </p>
      <button
        type="button"
        onClick={() => setView('all')}
        className="mt-4 rounded-lg border border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
      >
        Switch to All
      </button>
    </div>
  );
}
