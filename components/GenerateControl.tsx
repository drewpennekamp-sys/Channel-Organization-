'use client';

import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'link' | 'small';

export function GenerateControl({
  variant,
  label,
  loadingLabel,
  isLoading,
  error,
  onTrigger,
  accentColor,
}: {
  variant: Variant;
  label: string;
  loadingLabel: string;
  isLoading: boolean;
  error?: string;
  onTrigger: () => void;
  accentColor?: string;
}) {
  if (error && !isLoading) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg bg-rose-500/10 px-3 py-2.5',
          variant === 'link' && 'bg-transparent px-0 py-0'
        )}
      >
        <p className="text-xs text-rose-300">{error}</p>
        <button
          type="button"
          onClick={onTrigger}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-rose-300 underline decoration-rose-300/40 underline-offset-2 hover:text-rose-200"
        >
          <RefreshCw size={12} />
          Try again
        </button>
      </div>
    );
  }

  if (variant === 'primary') {
    return (
      <button
        type="button"
        onClick={onTrigger}
        disabled={isLoading}
        style={accentColor ? { backgroundColor: `${accentColor}26`, color: accentColor } : undefined}
        className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            {loadingLabel}
          </>
        ) : (
          <>
            <Sparkles size={15} />
            {label}
          </>
        )}
      </button>
    );
  }

  if (variant === 'small') {
    return (
      <button
        type="button"
        onClick={onTrigger}
        disabled={isLoading}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            {loadingLabel}
          </>
        ) : (
          <>
            <Sparkles size={12} />
            {label}
          </>
        )}
      </button>
    );
  }

  // link variant
  return (
    <button
      type="button"
      onClick={onTrigger}
      disabled={isLoading}
      className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 underline decoration-zinc-700 underline-offset-2 transition-colors hover:text-zinc-300 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-70"
    >
      {isLoading ? (
        <>
          <Loader2 size={11} className="animate-spin" />
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}
