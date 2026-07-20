'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { ApiError } from '@/lib/client-api';
import { cn } from '@/lib/cn';

const MAX_RECOMMENDATIONS = 6;

export function ManualInsightPanel({
  channelName,
  onClose,
  onCreate,
}: {
  channelName: string;
  onClose: () => void;
  onCreate: (payload: { summary: string; recommendations: string[] }) => Promise<void>;
}) {
  const [summary, setSummary] = useState('');
  const [recommendations, setRecommendations] = useState<string[]>(['']);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const summaryError = touched && !summary.trim() ? 'Summary is required' : undefined;
  const cleanRecommendations = recommendations.map((r) => r.trim()).filter(Boolean);
  const isValid = !!summary.trim();

  function setRecommendation(i: number, value: string) {
    setRecommendations((prev) => prev.map((r, idx) => (idx === i ? value : r)));
  }

  function addRecommendation() {
    setRecommendations((prev) => (prev.length < MAX_RECOMMENDATIONS ? [...prev, ''] : prev));
  }

  function removeRecommendation(i: number) {
    setRecommendations((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onCreate({ summary: summary.trim(), recommendations: cleanRecommendations });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.aside
      role="dialog"
      aria-modal="true"
      aria-label="Add manual note"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/50 focus:outline-none"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight text-zinc-50">
            Add manual note
          </h2>
          <p className="mt-0.5 text-xs font-light text-zinc-500">{channelName}</p>
        </div>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
        <form id="manual-insight-form" onSubmit={handleSubmit} noValidate className="space-y-5">
          <p className="text-sm font-light leading-relaxed text-zinc-500">
            Noticed something yourself? Fold it in here — it&apos;ll show up alongside AI
            analysis and gets woven into future idea generation for this channel.
          </p>

          <div>
            <label htmlFor="summary" className="mb-1.5 block text-sm font-medium text-zinc-300">
              Summary
            </label>
            <textarea
              ref={firstFieldRef}
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Comments are picking up on videos that name a specific year in the title"
              rows={3}
              className={cn(inputClass(!!summaryError), 'resize-none')}
            />
            {summaryError && <p className="mt-1.5 text-xs text-rose-400">{summaryError}</p>}
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label className="text-sm font-medium text-zinc-300">Recommendations</label>
              <span className="text-xs font-light text-zinc-500">Optional</span>
            </div>
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={rec}
                    onChange={(e) => setRecommendation(i, e.target.value)}
                    placeholder="Test naming a specific year in the next three titles"
                    className={inputClass(false)}
                  />
                  {recommendations.length > 1 && (
                    <button
                      type="button"
                      aria-label="Remove recommendation"
                      onClick={() => removeRecommendation(i)}
                      className="shrink-0 rounded-md p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {recommendations.length < MAX_RECOMMENDATIONS && (
              <button
                type="button"
                onClick={addRecommendation}
                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200"
              >
                <Plus size={13} />
                Add another
              </button>
            )}
          </div>

          {submitError && (
            <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {submitError}
            </p>
          )}
        </form>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          form="manual-insight-form"
          disabled={!isValid || submitting}
          className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Save note
        </button>
      </div>
    </motion.aside>
  );
}

function inputClass(hasError: boolean) {
  return cn(
    'w-full rounded-lg border bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors focus:border-zinc-400 focus:bg-zinc-800',
    hasError ? 'border-rose-500/60' : 'border-zinc-700'
  );
}
