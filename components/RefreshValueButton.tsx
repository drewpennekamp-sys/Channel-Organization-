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
export function RefreshValueButton({ copyOwnedId }: { copyOwnedId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/copies/${copyOwnedId}/refresh`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        setError(data.error ?? 'Search failed — try again.');
        return;
      }
      router.refresh();
    } catch (err: unknown) {
      console.error('Search comps request failed:', err);
      setError('Search failed — try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="whitespace-nowrap rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-50"
      >
        {loading ? 'Searching…' : 'Search comps'}
      </button>
      {error && <span className="max-w-[10rem] text-right text-[11px] text-destructive">{error}</span>}
    </div>
  );
}
