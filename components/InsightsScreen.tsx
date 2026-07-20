'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import type { InsightDTO, InsightEntryDTO, OwnerView, PortfolioSummaryDTO } from '@/lib/types';
import { addManualInsight, analyzeChannel } from '@/lib/client-api';
import { useOwnerFilter, matchesOwnerView } from './OwnerFilterProvider';
import { OwnerViewEmptyState } from './OwnerViewEmptyState';
import { MissingKeyBanner } from './MissingKeyBanner';
import { PortfolioSummary } from './PortfolioSummary';
import { InsightCard } from './InsightCard';
import { ManualInsightPanel } from './ManualInsightPanel';

type NotePanelState = { channelId: string; channelName: string } | null;

function withNewInsight(entry: InsightEntryDTO, insight: InsightDTO): InsightEntryDTO {
  return {
    ...entry,
    latest: insight,
    history: [insight, ...entry.history],
  };
}

export function InsightsScreen({
  initialEntries,
  portfolioByView,
  anthropicKeyPresent,
}: {
  initialEntries: InsightEntryDTO[];
  portfolioByView: Record<OwnerView, PortfolioSummaryDTO>;
  anthropicKeyPresent: boolean;
}) {
  const [entries, setEntries] = useState<InsightEntryDTO[]>(initialEntries);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [analyzeErrors, setAnalyzeErrors] = useState<Record<string, string>>({});
  const [notePanel, setNotePanel] = useState<NotePanelState>(null);
  const { view } = useOwnerFilter();

  const visibleEntries = useMemo(
    () => entries.filter((e) => matchesOwnerView(e.channel.owner, view)),
    [entries, view]
  );
  const portfolio = portfolioByView[view];

  async function handleAnalyze(channelId: string) {
    setAnalyzingIds((prev) => new Set(prev).add(channelId));
    setAnalyzeErrors((prev) => {
      const next = { ...prev };
      delete next[channelId];
      return next;
    });

    try {
      const insight = await analyzeChannel(channelId);
      setEntries((prev) =>
        prev.map((e) => (e.channel.id === channelId ? withNewInsight(e, insight) : e))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed. Try again.';
      setAnalyzeErrors((prev) => ({ ...prev, [channelId]: message }));
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(channelId);
        return next;
      });
    }
  }

  async function handleAddNote(payload: { summary: string; recommendations: string[] }) {
    if (!notePanel) return;
    const insight = await addManualInsight(notePanel.channelId, payload);
    setEntries((prev) =>
      prev.map((e) => (e.channel.id === notePanel.channelId ? withNewInsight(e, insight) : e))
    );
    setNotePanel(null);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-zinc-50">
          Insights
        </h1>
        <p className="mt-1 text-sm font-light text-zinc-400">
          What the data says is working, and what to change next — per channel.
        </p>
      </div>

      {!anthropicKeyPresent && (
        <MissingKeyBanner
          keyLabel="The Anthropic API key"
          reason="analysis will fail until it's added"
        />
      )}

      {entries.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-24 text-center">
          <h2 className="font-heading text-xl font-semibold tracking-tight text-zinc-50">
            No channels to analyze yet
          </h2>
          <p className="mt-2 max-w-sm text-sm font-light leading-relaxed text-zinc-400">
            Add a channel and post a few videos, then this is where you&apos;ll see what&apos;s
            working and what to try next.
          </p>
          <Link
            href="/channels"
            className="mt-6 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
          >
            Add a channel
          </Link>
        </div>
      ) : visibleEntries.length === 0 ? (
        <OwnerViewEmptyState noun="channels" />
      ) : (
        <>
          <div className="mt-8">
            <PortfolioSummary portfolio={portfolio} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {visibleEntries.map((entry) => (
              <InsightCard
                key={entry.channel.id}
                entry={entry}
                isAnalyzing={analyzingIds.has(entry.channel.id)}
                analyzeError={analyzeErrors[entry.channel.id]}
                onAnalyze={() => handleAnalyze(entry.channel.id)}
                onAddNote={() =>
                  setNotePanel({ channelId: entry.channel.id, channelName: entry.channel.name })
                }
              />
            ))}
          </div>
        </>
      )}

      <AnimatePresence>
        {notePanel && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setNotePanel(null)}
          />
        )}
        {notePanel && (
          <ManualInsightPanel
            key="panel"
            channelName={notePanel.channelName}
            onClose={() => setNotePanel(null)}
            onCreate={handleAddNote}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
