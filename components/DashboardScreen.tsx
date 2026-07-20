'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';
import type { DashboardEntryDTO, SettingsDTO } from '@/lib/types';
import { getDashboardState } from '@/lib/dashboard';
import { fetchDashboard, generateIdeaForChannel, markChannelPosted } from '@/lib/client-api';
import { usePoll } from '@/lib/usePoll';
import { useOwnerFilter, matchesOwnerView } from './OwnerFilterProvider';
import { OwnerViewEmptyState } from './OwnerViewEmptyState';
import { MissingKeyBanner } from './MissingKeyBanner';
import { StatusStrip } from './StatusStrip';
import { DashboardCard } from './DashboardCard';

export function DashboardScreen({
  initialEntries,
  settings,
  anthropicKeyPresent,
}: {
  initialEntries: DashboardEntryDTO[];
  settings: SettingsDTO;
  anthropicKeyPresent: boolean;
}) {
  const [entries, setEntries] = useState<DashboardEntryDTO[]>(initialEntries);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [generateErrors, setGenerateErrors] = useState<Record<string, string>>({});
  const [postingIds, setPostingIds] = useState<Set<string>>(new Set());
  const [postErrors, setPostErrors] = useState<Record<string, string>>({});
  const { view } = useOwnerFilter();

  const anyPending = generatingIds.size > 0 || postingIds.size > 0;
  usePoll(
    async () => {
      try {
        const fresh = await fetchDashboard();
        setEntries(fresh);
      } catch {
        // A missed poll isn't worth interrupting the user over; it'll retry next tick.
      }
    },
    settings.pollIntervalSeconds,
    !anyPending
  );

  const visibleEntries = useMemo(
    () => entries.filter((e) => matchesOwnerView(e.channel.owner, view)),
    [entries, view]
  );

  const noIdeaChannelIds = useMemo(
    () =>
      visibleEntries.filter((e) => getDashboardState(e.plan) === 'no-idea').map((e) => e.channel.id),
    [visibleEntries]
  );
  const bulkGenerating = noIdeaChannelIds.some((id) => generatingIds.has(id));

  async function handleGenerate(channelId: string) {
    setGeneratingIds((prev) => new Set(prev).add(channelId));
    setGenerateErrors((prev) => {
      const next = { ...prev };
      delete next[channelId];
      return next;
    });

    try {
      const plan = await generateIdeaForChannel(channelId);
      setEntries((prev) => prev.map((e) => (e.channel.id === channelId ? { ...e, plan } : e)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setGenerateErrors((prev) => ({ ...prev, [channelId]: message }));
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(channelId);
        return next;
      });
    }
  }

  function handleGenerateAll() {
    for (const channelId of noIdeaChannelIds) {
      handleGenerate(channelId);
    }
  }

  async function handleMarkPosted(
    channelId: string,
    stats: { views: number; likes: number; comments: number }
  ): Promise<boolean> {
    setPostingIds((prev) => new Set(prev).add(channelId));
    setPostErrors((prev) => {
      const next = { ...prev };
      delete next[channelId];
      return next;
    });

    try {
      const plan = await markChannelPosted(channelId, stats);
      setEntries((prev) => prev.map((e) => (e.channel.id === channelId ? { ...e, plan } : e)));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setPostErrors((prev) => ({ ...prev, [channelId]: message }));
      return false;
    } finally {
      setPostingIds((prev) => {
        const next = new Set(prev);
        next.delete(channelId);
        return next;
      });
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-zinc-50">
            Dashboard
          </h1>
          <p className="mt-1 text-sm font-light text-zinc-400">
            What needs to happen today, across every channel.
          </p>
        </div>
      </div>

      {!anthropicKeyPresent && (
        <MissingKeyBanner
          keyLabel="The Anthropic API key"
          reason="idea generation will fail until it's added"
        />
      )}

      {entries.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-24 text-center">
          <h2 className="font-heading text-xl font-semibold tracking-tight text-zinc-50">
            No channels to plan for yet
          </h2>
          <p className="mt-2 max-w-sm text-sm font-light leading-relaxed text-zinc-400">
            Add a channel first, then this is where you&apos;ll generate and track today&apos;s
            idea for each one.
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
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <StatusStrip entries={visibleEntries} />
            <button
              type="button"
              onClick={handleGenerateAll}
              disabled={noIdeaChannelIds.length === 0 || bulkGenerating}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3.5 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {bulkGenerating ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Sparkles size={15} />
              )}
              Generate all
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {visibleEntries.map(({ channel, plan }) => (
              <DashboardCard
                key={channel.id}
                channel={channel}
                plan={plan}
                isGenerating={generatingIds.has(channel.id)}
                generateError={generateErrors[channel.id]}
                onGenerate={() => handleGenerate(channel.id)}
                isPosting={postingIds.has(channel.id)}
                postError={postErrors[channel.id]}
                onMarkPosted={(stats) => handleMarkPosted(channel.id, stats)}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
