'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * "Search comps" — kicks off a bounded comp search (see
 * app/api/copies/[id]/refresh) for one owned copy. Each click can only
 * search so much before the server's request budget runs out, so results
 * accumulate across clicks rather than needing to find everything in one
 * shot: Sale rows are append-only and deduped, so searching again later
 * only adds to what's already on record.
 */
export function RefreshValueButton({
  copyOwnedId,
  onDone,
}: {
  copyOwnedId: string;
  /** Called after a successful search with the sample size found, for callers (e.g. the Comps page) that want to report results without a full page refresh. */
  onDone?: (sampleSize: number) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/copies/${copyOwnedId}/refresh`, { method: 'POST' });
      const data = await res.json().catch(() => ({}) as { error?: string; valuation?: { sampleSize: number } });
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Search failed — try again.');
        return;
      }
      onDone?.((data as { valuation?: { sampleSize: number } }).valuation?.sampleSize ?? 0);
      router.refresh();
    } catch (err: unknown) {
      console.error('Search comps request failed:', err);
      setError('Search failed — try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button type="button" onClick={handleClick} disabled={loading} className="btn btn-sm">
        {loading ? 'Searching…' : 'Search comps'}
      </button>
      {error && (
        <span style={{ maxWidth: '11rem', textAlign: 'right', fontSize: 11, color: 'var(--danger)' }}>{error}</span>
      )}
    </div>
  );
}
