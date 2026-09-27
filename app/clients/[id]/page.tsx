import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { getDb } from '@/lib/supabase';
import { createProject } from '@/app/actions';
import type { Client, Project } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PROJECT_STATUS_COLORS: Record<Project['status'], string> = {
  planning: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-700',
  delivered: 'bg-green-100 text-green-700',
  maintenance: 'bg-purple-100 text-purple-700',
};

async function loadClient(id: string) {
  const db = getDb();
  const { data: client, error } = await db.from('clients').select('*').eq('id', id).single();
  if (error || !client) return null;

  const { data: projects } = await db
    .from('projects')
    .select('*')
    .eq('client_id', id)
    .order('created_at', { ascending: false });

  return { client: client as Client, projects: (projects ?? []) as Project[] };
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const data = await loadClient(params.id);
  if (!data) notFound();
  const { client, projects } = data;

  const boundCreateProject = createProject.bind(null, client.id);

  return (
    <div>
      <NavHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/clients" className="mb-4 inline-block text-sm text-slate-500 hover:text-ink">
          &larr; All clients
        </Link>

        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="text-xl font-semibold">{client.business_name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-6 text-sm text-slate-600">
            {client.contact_name && <span>Contact: {client.contact_name}</span>}
            {client.email && <span>Email: {client.email}</span>}
            {client.phone && <span>Phone: {client.phone}</span>}
          </div>
          {client.prospect_id && (
            <Link
              href={`/prospects/${client.prospect_id}`}
              className="mt-2 inline-block text-xs text-slate-400 hover:text-ink"
            >
              View originating prospect &rarr;
            </Link>
          )}
        </div>

        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Projects</h2>

          {searchParams.error && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {searchParams.error}
            </p>
          )}

          {projects.length > 0 && (
            <ul className="mb-5 space-y-3">
              {projects.map((p) => (
                <li key={p.id} className="rounded-md border border-slate-200 p-4 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">{p.name}</span>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${PROJECT_STATUS_COLORS[p.status]}`}
                    >
                      {p.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {p.type}
                    {p.price !== null ? ` · $${p.price}` : ''}
                  </p>
                  <div className="mt-1 flex gap-3 text-xs">
                    {p.demo_url && (
                      <a href={p.demo_url} target="_blank" rel="noreferrer" className="text-ink underline">
                        Demo
                      </a>
                    )}
                    {p.live_url && (
                      <a href={p.live_url} target="_blank" rel="noreferrer" className="text-ink underline">
                        Live
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <details open={projects.length === 0}>
            <summary className="cursor-pointer text-sm font-medium text-ink">+ Add project</summary>
            <form action={boundCreateProject} className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
                <input
                  name="name"
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
                  <select name="type" defaultValue="website" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <option value="website">Website</option>
                    <option value="lead-gen">Lead generation</option>
                    <option value="quote-system">Quote system</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                  <select name="status" defaultValue="planning" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <option value="planning">Planning</option>
                    <option value="in_progress">In progress</option>
                    <option value="review">Review</option>
                    <option value="delivered">Delivered</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Demo URL</label>
                  <input name="demo_url" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Live URL</label>
                  <input name="live_url" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Price ($)</label>
                <input name="price" type="number" step="0.01" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <button
                type="submit"
                className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Add project
              </button>
            </form>
          </details>
        </section>
      </main>
    </div>
  );
}
