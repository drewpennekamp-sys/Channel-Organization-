'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { DashboardEntryDTO, OwnerView, PortfolioSummaryDTO, SettingsDTO } from '@/lib/types';
import { computeTodayChecklist } from '@/lib/today';
import { fetchDashboard, generateIdeaForChannel, markChannelPosted } from '@/lib/client-api';
import { usePoll } from '@/lib/usePoll';
import { useOwnerFilter, matchesOwnerView } from './OwnerFilterProvider';
import { OwnerViewEmptyState } from './OwnerViewEmptyState';
import { MissingKeyBanner } from './MissingKeyBanner';
import { TodayRow } from './TodayRow';

export function TodayScreen({
  initialEntries,
  portfolioByView,
  settings,
  anthropicKeyPresent,
}: {
  initialEntries: DashboardEntryDTO[];
  portfolioByView: Record<OwnerView, PortfolioSummaryDTO>;
  settings: SettingsDTO;
  anthropicKeyPresent: boolean;
}) {
  const [entries, setEntries] = useState<DashboardEntryDTO[]>(initialEntries);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [generateErrors, setGenerateErrors] = useState<Record<string, string>>({});
  const [postingIds, setPostingIds] = useState<Set<string>>(new Set());
  const [postErrors, setPostErrors] = useState<Record<string, string>>({});
  const { view } = useOwnerFilter();

  const visibleEntries = useMemo(
    () => entries.filter((e) => matchesOwnerView(e.channel.owner, view)),
    [entries, view]
  );
  const checklist = useMemo(() => computeTodayChecklist(visibleEntries), [visibleEntries]);
  const portfolio = portfolioByView[view];

  const anyPending = generatingIds.size > 0 || postingIds.size > 0;
  usePoll(
    async () => {
      try {
        setEntries(await fetchDashboard());
      } catch {
        // A missed poll isn't worth interrupting the user over.
      }
    },
    settings.pollIntervalSeconds,
    !anyPending
  );

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

  const total = visibleEntries.length;
  const done = checklist.posted.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-zinc-50">Today</h1>
        <p className="mt-1 text-sm font-light text-zinc-400">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
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
            Nothing to check off yet
          </h2>
          <p className="mt-2 max-w-sm text-sm font-light leading-relaxed text-zinc-400">
            Add a channel first, then this is where your daily checklist shows up.
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
          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-200">
                {done} of {total} done
              </span>
              <span className="tabular-nums text-zinc-500">{pct}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>

            {portfolio.hasEnoughData && (portfolio.fastestGrowing || portfolio.lagging) && (
              <div className="mt-3 flex flex-col gap-1 border-t border-zinc-800 pt-3">
                {portfolio.fastestGrowing && (
                  <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <TrendingUp size={12} style={{ color: portfolio.fastestGrowing.accentColor }} />
                    <span style={{ color: portfolio.fastestGrowing.accentColor }} className="font-medium">
                      {portfolio.fastestGrowing.name}
                    </span>
                    is growing fastest this week
                  </p>
                )}
                {portfolio.lagging && (
                  <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <TrendingDown size={12} />
                    <span className="font-medium text-zinc-400">{portfolio.lagging.name}</span>
                    is lagging behind
                  </p>
                )}
              </div>
            )}
          </div>

          {checklist.needsIdea.length > 0 && (
            <ChecklistGroup title="Needs an idea" count={checklist.needsIdea.length}>
              {checklist.needsIdea.map(({ channel, plan }) => (
                <TodayRow
                  key={channel.id}
                  channel={channel}
                  plan={plan}
                  variant="needs-idea"
                  isGenerating={generatingIds.has(channel.id)}
                  generateError={generateErrors[channel.id]}
                  onGenerate={() => handleGenerate(channel.id)}
                  isPosting={false}
                  onMarkPosted={() => Promise.resolve(false)}
                />
              ))}
            </ChecklistGroup>
          )}

          {checklist.ideaNotPosted.length > 0 && (
            <ChecklistGroup title="Ready to post" count={checklist.ideaNotPosted.length}>
              {checklist.ideaNotPosted.map(({ channel, plan }) => (
                <TodayRow
                  key={channel.id}
                  channel={channel}
                  plan={plan}
                  variant="idea-not-posted"
                  isGenerating={generatingIds.has(channel.id)}
                  onGenerate={() => handleGenerate(channel.id)}
                  isPosting={postingIds.has(channel.id)}
                  postError={postErrors[channel.id]}
                  onMarkPosted={(stats) => handleMarkPosted(channel.id, stats)}
                />
              ))}
            </ChecklistGroup>
          )}

          {checklist.posted.length > 0 && (
            <ChecklistGroup title="Posted" count={checklist.posted.length}>
              {checklist.posted.map(({ channel, plan }) => (
                <TodayRow
                  key={channel.id}
                  channel={channel}
                  plan={plan}
                  variant="posted"
                  isGenerating={false}
                  onGenerate={() => {}}
                  isPosting={false}
                  onMarkPosted={() => Promise.resolve(false)}
                />
              ))}
            </ChecklistGroup>
          )}
        </>
      )}
    </main>
  );
}

function ChecklistGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title} ({count})
      </h2>
      <ul className="mt-2 divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {children}
      </ul>
    </div>
  );
}
