export default function LoginPage({
  searchParams,
}: {
  searchParams: { from?: string; error?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <form
        action="/api/auth/login"
        method="POST"
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-1 text-lg font-semibold text-ink">AI Agency OS</h1>
        <p className="mb-4 text-sm text-slate-500">Sign in to continue.</p>

        <input type="hidden" name="from" value={searchParams.from ?? '/'} />

        {searchParams.error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Wrong password. Try again.
          </p>
        )}

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />

        <button
          type="submit"
          className="w-full rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
