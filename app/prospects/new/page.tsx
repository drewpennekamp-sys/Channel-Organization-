import { NavHeader } from '@/components/NavHeader';
import { createProspect } from '@/app/actions';

export default function NewProspectPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div>
      <NavHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-xl font-semibold">New prospect</h1>

        {searchParams.error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {searchParams.error}
          </p>
        )}

        <form action={createProspect} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Website</label>
              <input
                name="website"
                placeholder="Leave blank if none"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Niche</label>
              <input
                name="niche"
                defaultValue="HVAC"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
              <input
                name="phone"
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
            <label className="mb-1 block text-sm font-medium text-slate-700">City</label>
            <input
              name="city"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Anything you noticed on their Google/Facebook page, reviews, etc."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Add prospect
          </button>
        </form>
      </main>
    </div>
  );
}
