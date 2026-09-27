import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { StatusBadge } from '@/components/Badge';
import { getDb } from '@/lib/supabase';
import { PIPELINE_STATUSES, isProspectStatus } from '@/lib/status';
import type { Prospect } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  status?: string;
}

async function loadProspects(searchParams: SearchParams) {
  const db = getDb();
  let query = db
    .from('prospects')
    .select('id, business_name, city, website, website_score, status, updated_at')
    .order('updated_at', { ascending: false });

  if (searchParams.status && isProspectStatus(searchParams.status)) {
    query = query.eq('status', searchParams.status);
  }

  if (searchParams.q) {
    const term = searchParams.q.trim();
    if (term) {
      query = query.or(`business_name.ilike.%${term}%,city.ilike.%${term}%`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Pick<
    Prospect,
    'id' | 'business_name' | 'city' | 'website' | 'website_score' | 'status' | 'updated_at'
  >[];
}

export default async function ProspectsPage({ searchParams }: { searchParams: SearchParams }) {
  const prospects = await loadProspects(searchParams);

  return (
    <div>
      <NavHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between">
          <h1 className="text-xl font-semibold">Prospects</h1>
          <Link
            href="/prospects/new"
            className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + New prospect
          </Link>
        </div>

        <form method="GET" className="mb-4 flex flex-wrap gap-2">
          <input
            type="text"
            name="q"
            placeholder="Search business or city..."
            defaultValue={searchParams.q ?? ''}
            className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            name="status"
            defaultValue={searchParams.status ?? ''}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {PIPELINE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Filter
          </button>
          {(searchParams.q || searchParams.status) && (
            <Link
              href="/prospects"
              className="rounded-md px-3 py-2 text-sm text-slate-500 hover:text-ink"
            >
              Clear
            </Link>
          )}
        </form>

        {prospects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No prospects match. Try clearing filters, or{' '}
            <Link href="/prospects/new" className="text-ink underline">
              add one
            </Link>
            .
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">City</th>
                  <th className="px-4 py-3 font-medium">Website</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/prospects/${p.id}`} className="font-medium text-ink hover:underline">
                        {p.business_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.city ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.website ? (
                        <span className="text-slate-600">{p.website.replace(/^https?:\/\//, '')}</span>
                      ) : (
                        <span className="text-red-500">none</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.website_score ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
