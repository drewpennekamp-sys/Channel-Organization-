'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import type { PostedVideoDTO, VideoFormValues, VideoPayload } from '@/lib/types';
import { ApiError } from '@/lib/client-api';
import { cn } from '@/lib/cn';

type Field = 'ideaTitle' | 'postedAt' | 'views' | 'likes' | 'comments' | 'shares' | 'avgViewDuration';

function todayISODate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function emptyValues(): VideoFormValues {
  return {
    ideaTitle: '',
    postedAt: todayISODate(),
    views: '0',
    likes: '0',
    comments: '0',
    shares: '',
    avgViewDuration: '',
    retentionNote: '',
  };
}

function valuesFromVideo(video: PostedVideoDTO): VideoFormValues {
  return {
    ideaTitle: video.ideaTitle,
    postedAt: video.postedAt.slice(0, 10),
    views: String(video.views),
    likes: String(video.likes),
    comments: String(video.comments),
    shares: video.shares === null ? '' : String(video.shares),
    avgViewDuration: video.avgViewDuration === null ? '' : String(video.avgViewDuration),
    retentionNote: video.retentionNote ?? '',
  };
}

function validateField(field: Field, values: VideoFormValues): string | undefined {
  if (field === 'ideaTitle') {
    if (!values.ideaTitle.trim()) return 'Title is required';
    if (values.ideaTitle.length > 160) return 'Keep it under 160 characters';
    return undefined;
  }
  if (field === 'postedAt') {
    if (!values.postedAt) return 'Posted date is required';
    if (Number.isNaN(new Date(values.postedAt).getTime())) return 'Enter a valid date';
    return undefined;
  }
  if (field === 'views' || field === 'likes' || field === 'comments') {
    const trimmed = values[field].trim();
    if (!trimmed) return 'Required';
    const n = Number(trimmed);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return 'Must be a whole number, 0 or more';
    return undefined;
  }
  if (field === 'shares') {
    const trimmed = values.shares.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return 'Must be a whole number, 0 or more';
    return undefined;
  }
  if (field === 'avgViewDuration') {
    const trimmed = values.avgViewDuration.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return 'Must be 0 or more';
    return undefined;
  }
  return undefined;
}

function toPayload(values: VideoFormValues): VideoPayload {
  return {
    ideaTitle: values.ideaTitle.trim(),
    postedAt: values.postedAt,
    views: parseInt(values.views, 10) || 0,
    likes: parseInt(values.likes, 10) || 0,
    comments: parseInt(values.comments, 10) || 0,
    shares: values.shares.trim() === '' ? null : parseInt(values.shares, 10),
    avgViewDuration: values.avgViewDuration.trim() === '' ? null : parseFloat(values.avgViewDuration),
    retentionNote: values.retentionNote.trim() || null,
  };
}

export function VideoLogPanel({
  mode,
  channelName,
  video,
  onClose,
  onCreate,
  onUpdate,
}: {
  mode: 'add' | 'edit';
  channelName: string;
  video?: PostedVideoDTO;
  onClose: () => void;
  onCreate: (payload: VideoPayload) => Promise<void>;
  onUpdate: (payload: VideoPayload) => Promise<void>;
}) {
  const [values, setValues] = useState<VideoFormValues>(() =>
    video ? valuesFromVideo(video) : emptyValues()
  );
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

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

  function setField<K extends keyof VideoFormValues>(field: K, value: VideoFormValues[K]) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  function handleBlur(field: Field) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  const fields: Field[] = ['ideaTitle', 'postedAt', 'views', 'likes', 'comments', 'shares', 'avgViewDuration'];
  const errors = Object.fromEntries(fields.map((f) => [f, validateField(f, values)])) as Record<
    Field,
    string | undefined
  >;
  const isValid = fields.every((f) => !errors[f]);

  function errorFor(field: Field): string | undefined {
    return touched[field] ? errors[field] : undefined;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(Object.fromEntries(fields.map((f) => [f, true])) as Record<Field, boolean>);
    if (!isValid) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = toPayload(values);
      if (mode === 'add') await onCreate(payload);
      else await onUpdate(payload);
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
      aria-label={mode === 'add' ? 'Add video' : 'Edit video'}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/50 focus:outline-none"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight text-zinc-50">
            {mode === 'add' ? 'Add video' : 'Edit video'}
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
        <form id="video-form" onSubmit={handleSubmit} noValidate className="space-y-5">
          <FormField label="Idea / title" htmlFor="ideaTitle" error={errorFor('ideaTitle')}>
            <input
              ref={firstFieldRef}
              id="ideaTitle"
              type="text"
              value={values.ideaTitle}
              onChange={(e) => setField('ideaTitle', e.target.value)}
              onBlur={() => handleBlur('ideaTitle')}
              placeholder="The war that lasted 38 minutes"
              className={inputClass(!!errorFor('ideaTitle'))}
            />
          </FormField>

          <FormField label="Posted date" htmlFor="postedAt" error={errorFor('postedAt')}>
            <input
              id="postedAt"
              type="date"
              value={values.postedAt}
              onChange={(e) => setField('postedAt', e.target.value)}
              onBlur={() => handleBlur('postedAt')}
              className={inputClass(!!errorFor('postedAt'))}
            />
          </FormField>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Views" htmlFor="views" error={errorFor('views')}>
              <input
                id="views"
                type="number"
                inputMode="numeric"
                min={0}
                value={values.views}
                onChange={(e) => setField('views', e.target.value)}
                onBlur={() => handleBlur('views')}
                className={inputClass(!!errorFor('views'))}
              />
            </FormField>
            <FormField label="Likes" htmlFor="likes" error={errorFor('likes')}>
              <input
                id="likes"
                type="number"
                inputMode="numeric"
                min={0}
                value={values.likes}
                onChange={(e) => setField('likes', e.target.value)}
                onBlur={() => handleBlur('likes')}
                className={inputClass(!!errorFor('likes'))}
              />
            </FormField>
            <FormField label="Comments" htmlFor="comments" error={errorFor('comments')}>
              <input
                id="comments"
                type="number"
                inputMode="numeric"
                min={0}
                value={values.comments}
                onChange={(e) => setField('comments', e.target.value)}
                onBlur={() => handleBlur('comments')}
                className={inputClass(!!errorFor('comments'))}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Shares" htmlFor="shares" error={errorFor('shares')} optional>
              <input
                id="shares"
                type="number"
                inputMode="numeric"
                min={0}
                value={values.shares}
                onChange={(e) => setField('shares', e.target.value)}
                onBlur={() => handleBlur('shares')}
                className={inputClass(!!errorFor('shares'))}
              />
            </FormField>
            <FormField
              label="Avg view duration (s)"
              htmlFor="avgViewDuration"
              error={errorFor('avgViewDuration')}
              optional
            >
              <input
                id="avgViewDuration"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                value={values.avgViewDuration}
                onChange={(e) => setField('avgViewDuration', e.target.value)}
                onBlur={() => handleBlur('avgViewDuration')}
                className={inputClass(!!errorFor('avgViewDuration'))}
              />
            </FormField>
          </div>

          <FormField label="Retention note" htmlFor="retentionNote" optional>
            <textarea
              id="retentionNote"
              value={values.retentionNote}
              onChange={(e) => setField('retentionNote', e.target.value)}
              placeholder="Hook was too slow — cut the intro in half next time"
              rows={3}
              className={cn(inputClass(false), 'resize-none')}
            />
          </FormField>

          {submitError && (
            <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{submitError}</p>
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
          form="video-form"
          disabled={!isValid || submitting}
          className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {mode === 'add' ? 'Add video' : 'Save changes'}
        </button>
      </div>
    </motion.aside>
  );
}

function inputClass(hasError: boolean) {
  return cn(
    'w-full rounded-lg border bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 tabular-nums placeholder:text-zinc-500 outline-none transition-colors focus:border-zinc-400 focus:bg-zinc-800',
    hasError ? 'border-rose-500/60' : 'border-zinc-700'
  );
}

function FormField({
  label,
  htmlFor,
  error,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-300">
          {label}
        </label>
        {optional && <span className="text-xs font-light text-zinc-500">Optional</span>}
      </div>
      {children}
      {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
