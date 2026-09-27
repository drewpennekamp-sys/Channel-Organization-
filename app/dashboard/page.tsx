import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { StatusBadge } from '@/components/Badge';
import { getDb } from '@/lib/supabase';
import { PIPELINE_STATUSES, type ProspectStatus } from '@/lib/status';
import type { Prospect } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function loadData() {
  const db = getDb();

  const { data: prospects, error } = await db
    .from('prospects')
    .select('id, business_name, status, updated_at')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (prospects ?? []) as Pick<Prospect, 'id' | 'business_name' | 'status' | 'updated_at'>[];
}

export default async function DashboardPage() {
  const prospects = await loadData();

  const counts: Record<ProspectStatus, number> = Object.fromEntries(
    PIPELINE_STATUSES.map((s) => [s, 0])
  ) as Record<ProspectStatus, number>;

  for (const p of prospects) {
    counts[p.status] = (counts[p.status] ?? 0) + 1;
  }

  const active = prospects.filter((p) => p.status !== 'Won' && p.status !== 'Lost').length;
  const won = counts.Won;
  const recent = prospects.slice(0, 8);

  return (
    <div>
      <NavHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-xl font-semibold">Pipeline</h1>
            <p className="text-sm text-slate-500">
              {prospects.length} total prospects &middot; {active} active &middot; {won} won
            </p>
          </div>
          <Link
            href="/prospects/new"
            className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + New prospect
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PIPELINE_STATUSES.map((status) => (
            <Link
              key={status}
              href={`/prospects?status=${encodeURIComponent(status)}`}
              className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
            >
              <div className="text-2xl font-semibold">{counts[status]}</div>
              <div className="mt-1">
                <StatusBadge status={status} />
              </div>
            </Link>
          ))}
        </div>

        <h2 className="mb-3 text-sm font-semibold text-slate-700">Recently updated</h2>
        {recent.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No prospects yet.{' '}
            <Link href="/prospects/new" className="text-ink underline">
              Add your first one
            </Link>{' '}
            or run <code className="rounded bg-slate-100 px-1 py-0.5">npm run seed</code> for test data.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/prospects/${p.id}`} className="font-medium text-ink hover:underline">
                        {p.business_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="w-40 px-4 py-3 text-right text-xs text-slate-400">
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
