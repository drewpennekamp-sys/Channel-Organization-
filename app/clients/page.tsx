import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { getDb } from '@/lib/supabase';
import type { Client } from '@/lib/types';

export const dynamic = 'force-dynamic';

const CLIENT_STATUS_COLORS: Record<Client['status'], string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  churned: 'bg-slate-100 text-slate-500',
};

export default async function ClientsPage() {
  const db = getDb();
  const { data, error } = await db
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const clients = (data ?? []) as Client[];

  return (
    <div>
      <NavHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between">
          <h1 className="text-xl font-semibold">Clients</h1>
          <Link
            href="/clients/new"
            className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + Add client
          </Link>
        </div>

        {clients.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No clients yet — win a prospect to create your first one.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${c.id}`} className="font-medium text-ink hover:underline">
                        {c.business_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{c.contact_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${CLIENT_STATUS_COLORS[c.status]}`}
                      >
                        {c.status}
                      </span>
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
