import { Sparkles } from 'lucide-react';

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
        <Sparkles size={20} />
      </div>
      <h2 className="mt-5 font-heading text-xl font-semibold tracking-tight text-zinc-50">
        No channels yet
      </h2>
      <p className="mt-2 max-w-sm text-sm font-light leading-relaxed text-zinc-400">
        Channels are the shows Shorts Factory produces for — each one gets its own niche, voice,
        and content history. Add one to start generating ideas.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-6 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
      >
        Add your first channel
      </button>
    </div>
  );
}
