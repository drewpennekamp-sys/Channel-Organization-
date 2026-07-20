'use client';

import { useState } from 'react';
import { ChevronDown, Loader2, NotebookPen, RefreshCw, Sparkles } from 'lucide-react';
import type { InsightEntryDTO } from '@/lib/types';
import { OwnerBadge } from './OwnerBadge';
import { MicIndicator } from './MicIndicator';
import { cn } from '@/lib/cn';

const MIN_VIDEOS_TO_ANALYZE = 3;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function sourceLabel(source: 'claude' | 'manual'): string {
  return source === 'claude' ? 'AI analysis' : 'Manual note';
}

export function InsightCard({
  entry,
  isAnalyzing,
  analyzeError,
  onAnalyze,
  onAddNote,
}: {
  entry: InsightEntryDTO;
  isAnalyzing: boolean;
  analyzeError?: string;
  onAnalyze: () => void;
  onAddNote: () => void;
}) {
  const { channel, videoCount, latest, history } = entry;
  const [historyOpen, setHistoryOpen] = useState(false);
  const canAnalyze = videoCount >= MIN_VIDEOS_TO_ANALYZE;
  const pastHistory = history.slice(latest ? 1 : 0);

  return (
    <div
      style={{ borderLeftColor: channel.accentColor }}
      className="flex h-full flex-col rounded-xl border-l-[3px] bg-zinc-900 p-5 shadow-sm shadow-black/20 ring-1 ring-white/[0.04]"
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

      <div className="mt-4 flex-1 space-y-4">
        {!canAnalyze ? (
          <p className="text-sm font-light leading-relaxed text-zinc-500">
            Post a few videos and this channel will start getting analyzed.
          </p>
        ) : isAnalyzing ? (
          <div className="flex items-center gap-2 text-sm font-light text-zinc-400">
            <Loader2 size={15} className="animate-spin" />
            Analyzing {videoCount} posted videos...
          </div>
        ) : analyzeError ? (
          <div className="flex items-start justify-between gap-3 rounded-lg bg-rose-500/10 px-3 py-2.5">
            <p className="text-xs leading-relaxed text-rose-300">{analyzeError}</p>
            <button
              type="button"
              onClick={onAnalyze}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-rose-300 underline decoration-rose-300/40 underline-offset-2 hover:text-rose-200"
            >
              <RefreshCw size={12} />
              Try again
            </button>
          </div>
        ) : latest ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-zinc-200">{latest.summary}</p>

            <ul className="space-y-2">
              {latest.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm font-light leading-relaxed text-zinc-400">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                  {rec}
                </li>
              ))}
            </ul>

            <p className="text-xs font-light text-zinc-500">
              {sourceLabel(latest.source)} &middot; {formatDate(latest.date)}
            </p>
          </div>
        ) : (
          <p className="text-sm font-light leading-relaxed text-zinc-500">
            No analysis yet. Hit Analyze to get a read on what&apos;s working and what to change
            next, based on this channel&apos;s posted videos.
          </p>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {canAnalyze && !isAnalyzing && (
          <button
            type="button"
            onClick={onAnalyze}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ backgroundColor: `${channel.accentColor}26`, color: channel.accentColor }}
          >
            <Sparkles size={15} />
            Analyze now
          </button>
        )}
        {!canAnalyze && (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-600"
            >
              Analyze now
            </button>
            <p className="text-center text-xs font-light text-zinc-600">
              Need at least {MIN_VIDEOS_TO_ANALYZE} posted videos to analyze
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onAddNote}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
        >
          <NotebookPen size={12} />
          Add manual note
        </button>

        {pastHistory.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              aria-expanded={historyOpen}
              className="flex w-full items-center justify-between text-xs font-medium text-zinc-500 hover:text-zinc-300"
            >
              <span>History ({pastHistory.length})</span>
              <ChevronDown
                size={13}
                className={cn('shrink-0 transition-transform duration-200', historyOpen && 'rotate-180')}
              />
            </button>
            <div className={cn('reveal', historyOpen && 'reveal-open')}>
              <div>
                <ul className="mt-2 space-y-2 border-t border-zinc-800 pt-2">
                  {pastHistory.map((insight) => (
                    <li key={insight.id} className="text-xs font-light leading-relaxed text-zinc-500">
                      <span className="text-zinc-400">{formatDate(insight.date)}</span>
                      {' — '}
                      {insight.summary}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
