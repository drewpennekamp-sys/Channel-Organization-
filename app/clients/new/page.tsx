import { NavHeader } from '@/components/NavHeader';
import { createClient } from '@/app/actions';

export default function NewClientPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div>
      <NavHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-xl font-semibold">Add client</h1>

        {searchParams.error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {searchParams.error}
          </p>
        )}

        <form action={createClient} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Business name *</label>
            <input
              name="business_name"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Contact name</label>
              <input
                name="contact_name"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                name="email"
                type="email"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
            <input name="phone" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              name="notes"
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Add client
          </button>
        </form>
      </main>
    </div>
  );
}
