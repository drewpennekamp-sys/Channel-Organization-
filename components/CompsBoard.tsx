'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cardEmoji, cardTitle, needsSearch, type PortfolioCopy } from '@/lib/portfolio';
import { formatRelativeTime } from '@/lib/format';
import { CardThumb } from '@/components/CardThumb';

interface RowState {
  status: 'idle' | 'searching' | 'done' | 'error';
  sampleSize: number | null;
  sufficient: boolean | null;
  lastSearched: Date | null;
  error: string | null;
}

interface FeedEntry {
  id: string;
  text: string;
  dot: string;
}

function initialRowState(copy: PortfolioCopy): RowState {
  return {
    status: 'idle',
    sampleSize: copy.latestValuation?.sampleSize ?? null,
    sufficient: copy.latestValuation?.sufficient ?? null,
    lastSearched: copy.latestValuation?.computedAt ?? null,
    error: null,
  };
}

async function callRefresh(copyId: string): Promise<{ sampleSize: number; sufficient: boolean } | { error: string }> {
  try {
    const res = await fetch(`/api/copies/${copyId}/refresh`, { method: 'POST' });
    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok) {
      return { error: (data as { error?: string }).error ?? 'Search failed.' };
    }
    const valuation = (data as { valuation?: { sampleSize: number; sufficient: boolean } }).valuation;
    return { sampleSize: valuation?.sampleSize ?? 0, sufficient: valuation?.sufficient ?? false };
  } catch (err: unknown) {
    console.error('Search comps request failed:', err);
    return { error: 'Search failed — try again.' };
  }
}

export function CompsBoard({ copies }: { copies: PortfolioCopy[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(copies.map((c) => [c.id, initialRowState(c)])),
  );
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [runningAll, setRunningAll] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastFullPass, setLastFullPass] = useState<Date | null>(null);

  function pushFeed(text: string, dot: string) {
    setFeed((prev) => [{ id: `${Date.now()}-${Math.random()}`, text, dot }, ...prev].slice(0, 30));
  }

  async function runOne(copy: PortfolioCopy) {
    setRows((prev) => ({ ...prev, [copy.id]: { ...prev[copy.id], status: 'searching', error: null } }));
    const result = await callRefresh(copy.id);
    const title = cardTitle(copy.card);

    if ('error' in result) {
      setRows((prev) => ({ ...prev, [copy.id]: { ...prev[copy.id], status: 'error', error: result.error } }));
      pushFeed(`<strong>Search failed</strong> — ${title}: ${result.error}`, 'var(--danger)');
      return;
    }

    const prevSample = rows[copy.id]?.sampleSize ?? 0;
    const newFound = Math.max(0, result.sampleSize - prevSample);

    setRows((prev) => ({
      ...prev,
      [copy.id]: {
        status: 'done',
        sampleSize: result.sampleSize,
        sufficient: result.sufficient,
        lastSearched: new Date(),
        error: null,
      },
    }));

    if (newFound > 0) {
      pushFeed(`<strong>${newFound} new sale${newFound > 1 ? 's' : ''} found</strong> — ${title}`, 'var(--success)');
    } else if (result.sufficient) {
      pushFeed(`<strong>No new sales</strong> — ${title} (n=${result.sampleSize})`, 'var(--text-faint)');
    } else {
      pushFeed(`<strong>Still insufficient</strong> (n=${result.sampleSize}) — ${title}`, 'var(--warning)');
    }
  }

  async function handleSearchOne(copy: PortfolioCopy) {
    await runOne(copy);
    router.refresh();
  }

  async function handleSearchAll() {
    setRunningAll(true);
    setProgress(0);
    setFeed([]);
    for (let i = 0; i < copies.length; i++) {
      await runOne(copies[i]);
      setProgress(Math.round(((i + 1) / copies.length) * 100));
    }
    setLastFullPass(new Date());
    setRunningAll(false);
    router.refresh();
  }

  const needingSearch = copies.filter(needsSearch).length;

  return (
    <>
      <div className="comps-toolbar">
        <div className="comps-toolbar-copy">
          <strong>
            {copies.length} card{copies.length === 1 ? '' : 's'}
          </strong>{' '}
          · {needingSearch} need
          {needingSearch === 1 ? 's' : ''} a search
          {lastFullPass && <> · last full pass {formatRelativeTime(lastFullPass)}</>}
        </div>
        <button type="button" className="btn btn-primary" onClick={handleSearchAll} disabled={runningAll || copies.length === 0}>
          {runningAll ? 'Searching…' : 'Search my whole collection'}
        </button>
      </div>
      {runningAll && (
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="grid-2" style={{ marginTop: 18 }}>
        <div className="panel">
          <div className="panel-head">
            <h3>Live feed</h3>
          </div>
          <div className="panel-body">
            {feed.length === 0 ? (
              <div className="empty-note">Run a search to see results stream in here.</div>
            ) : (
              feed.map((entry) => (
                <div className="feed-row" key={entry.id}>
                  <span className="feed-dot" style={{ background: entry.dot }} />
                  <span className="feed-text" dangerouslySetInnerHTML={{ __html: entry.text }} />
                  <span className="feed-time">just now</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Every card</h3>
          </div>
          <div className="panel-body">
            {copies.length === 0 ? (
              <div className="empty-note">No cards yet.</div>
            ) : (
              copies.map((copy) => {
                const row = rows[copy.id];
                let meta: string;
                if (row.status === 'searching') {
                  meta = 'Searching — bounded, usually under a minute…';
                } else if (row.status === 'error') {
                  meta = row.error ?? 'Search failed.';
                } else if (row.sampleSize === null) {
                  meta = 'Never searched';
                } else {
                  const suffix = row.lastSearched ? ` · searched ${formatRelativeTime(row.lastSearched)}` : '';
                  meta = `n=${row.sampleSize}${suffix}`;
                }
                return (
                  <div className="comps-list-row" key={copy.id}>
                    <div className="comps-thumb">
                      <CardThumb src={copy.frontImagePath} alt="" emoji={cardEmoji(copy.card)} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="comps-name">
                        {cardTitle(copy.card)} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>· {copy.grade}</span>
                      </div>
                      <div className="comps-meta" style={row.status === 'error' ? { color: 'var(--danger)' } : undefined}>
                        {meta}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={row.status === 'searching' || runningAll}
                      onClick={() => handleSearchOne(copy)}
                    >
                      {row.status === 'searching' ? 'Searching…' : 'Search'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
