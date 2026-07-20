'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Incorrect password');
        setSubmitting(false);
        return;
      }
      const destination = searchParams.get('from') || '/today';
      router.replace(destination);
      router.refresh();
    } catch {
      setError('Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
            <Lock size={20} />
          </div>
          <h1 className="mt-5 font-heading text-xl font-semibold tracking-tight text-zinc-50">
            Shorts Factory
          </h1>
          <p className="mt-1 text-sm font-light text-zinc-400">Private tool — sign in to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="text-sm font-medium text-zinc-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors focus:border-zinc-400 focus:bg-zinc-800"
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !password}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
