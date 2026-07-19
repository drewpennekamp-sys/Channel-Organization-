'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { X, Pencil, Loader2, Sparkles } from 'lucide-react';
import type { ChannelActivity, ChannelDTO, ChannelFormValues, Owner } from '@/lib/types';
import { ApiError, createChannel, fetchChannelDetail, updateChannel } from '@/lib/client-api';
import { SegmentedControl } from './SegmentedControl';
import { Toggle } from './Toggle';
import { OwnerBadge } from './OwnerBadge';
import { MicIndicator } from './MicIndicator';
import { cn } from '@/lib/cn';

type PanelMode = 'add' | 'edit' | 'view';
type Field = 'name' | 'niche' | 'owner' | 'platformHandle' | 'videoGenTool' | 'voiceStyle';

const STATUS_LABEL: Record<string, string> = {
  idea: 'Idea',
  scripted: 'Scripted',
  rendering: 'Rendering',
  scheduled: 'Scheduled',
  posted: 'Posted',
};

const STATUS_COLOR: Record<string, string> = {
  idea: 'bg-zinc-700 text-zinc-300',
  scripted: 'bg-sky-500/15 text-sky-300',
  rendering: 'bg-amber-500/15 text-amber-300',
  scheduled: 'bg-violet-500/15 text-violet-300',
  posted: 'bg-emerald-500/15 text-emerald-300',
};

function emptyValues(defaultTool: string): ChannelFormValues {
  return {
    name: '',
    niche: '',
    owner: 'you',
    platformHandle: '',
    videoGenTool: defaultTool,
    needsVoiceover: false,
    voiceStyle: '',
  };
}

function valuesFromChannel(channel: ChannelDTO): ChannelFormValues {
  return {
    name: channel.name,
    niche: channel.niche,
    owner: channel.owner,
    platformHandle: channel.platformHandle ?? '',
    videoGenTool: channel.videoGenTool,
    needsVoiceover: channel.needsVoiceover,
    voiceStyle: channel.voiceStyle ?? '',
  };
}

function validateField(
  field: Field,
  values: ChannelFormValues,
  otherNames: string[]
): string | undefined {
  if (field === 'name') {
    const trimmed = values.name.trim();
    if (!trimmed) return 'Name is required';
    if (trimmed.length > 80) return 'Keep it under 80 characters';
    if (otherNames.includes(trimmed.toLowerCase())) return 'A channel with this name already exists';
    return undefined;
  }
  if (field === 'niche') {
    if (!values.niche.trim()) return 'Niche is required';
    if (values.niche.length > 140) return 'Keep it under 140 characters';
    return undefined;
  }
  if (field === 'videoGenTool') {
    if (!values.videoGenTool.trim()) return 'Video-gen tool is required';
    return undefined;
  }
  return undefined;
}

export function ChannelPanel({
  mode,
  channel,
  defaultVideoGenTool,
  existingChannels,
  onClose,
  onCreated,
  onUpdated,
  onRequestEdit,
}: {
  mode: PanelMode;
  channel?: ChannelDTO;
  defaultVideoGenTool: string;
  existingChannels: ChannelDTO[];
  onClose: () => void;
  onCreated: (channel: ChannelDTO) => void;
  onUpdated: (channel: ChannelDTO) => void;
  onRequestEdit: (channel: ChannelDTO) => void;
}) {
  const isFormMode = mode === 'add' || mode === 'edit';
  const [values, setValues] = useState<ChannelFormValues>(() =>
    channel ? valuesFromChannel(channel) : emptyValues(defaultVideoGenTool)
  );
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [activity, setActivity] = useState<ChannelActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  const otherNames = existingChannels
    .filter((c) => c.id !== channel?.id)
    .map((c) => c.name.toLowerCase());

  useEffect(() => {
    setValues(channel ? valuesFromChannel(channel) : emptyValues(defaultVideoGenTool));
    setTouched({});
    setSubmitError(null);
    setServerFieldErrors({});
  }, [mode, channel, defaultVideoGenTool]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    if (isFormMode) {
      firstFieldRef.current?.focus();
    } else {
      panelRef.current?.focus();
    }
  }, [isFormMode, mode]);

  useEffect(() => {
    if (mode === 'view' && channel) {
      let cancelled = false;
      setActivityLoading(true);
      fetchChannelDetail(channel.id)
        .then((data) => {
          if (!cancelled) setActivity(data.activity);
        })
        .catch(() => {
          if (!cancelled) setActivity({ recentPlans: [], latestInsight: null });
        })
        .finally(() => {
          if (!cancelled) setActivityLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [mode, channel]);

  function setField<K extends keyof ChannelFormValues>(field: K, value: ChannelFormValues[K]) {
    setValues((v) => ({ ...v, [field]: value }));
    if (serverFieldErrors[field as Field]) {
      setServerFieldErrors((e) => ({ ...e, [field]: undefined }));
    }
  }

  function handleBlur(field: Field) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  const clientErrors: Partial<Record<Field, string>> = {
    name: validateField('name', values, otherNames),
    niche: validateField('niche', values, otherNames),
    videoGenTool: validateField('videoGenTool', values, otherNames),
  };

  const isValid = !clientErrors.name && !clientErrors.niche && !clientErrors.videoGenTool;

  function errorFor(field: Field): string | undefined {
    return serverFieldErrors[field] ?? (touched[field] ? clientErrors[field] : undefined);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ name: true, niche: true, videoGenTool: true });
    if (!isValid) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (mode === 'add') {
        const created = await createChannel(values);
        onCreated(created);
      } else if (mode === 'edit' && channel) {
        const updated = await updateChannel(channel.id, values);
        onUpdated(updated);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldErrors) {
          const mapped: Partial<Record<Field, string>> = {};
          for (const [key, msgs] of Object.entries(err.fieldErrors)) {
            mapped[key as Field] = msgs[0];
          }
          setServerFieldErrors(mapped);
        }
        setSubmitError(err.fieldErrors ? null : err.message);
      } else {
        setSubmitError('Something went wrong. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.aside
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={isFormMode ? (mode === 'add' ? 'Add channel' : 'Edit channel') : channel?.name}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/50 focus:outline-none"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-zinc-50">
          {mode === 'add' ? 'Add channel' : mode === 'edit' ? 'Edit channel' : channel?.name}
        </h2>
        <div className="flex items-center gap-1">
          {mode === 'view' && channel && (
            <button
              type="button"
              onClick={() => onRequestEdit(channel)}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
        {isFormMode ? (
          <form id="channel-form" onSubmit={handleSubmit} noValidate className="space-y-5">
            <FormField label="Channel name" htmlFor="name" error={errorFor('name')}>
              <input
                ref={firstFieldRef}
                id="name"
                type="text"
                value={values.name}
                onChange={(e) => setField('name', e.target.value)}
                onBlur={() => handleBlur('name')}
                placeholder="Weird History Bites"
                className={inputClass(!!errorFor('name'))}
              />
            </FormField>

            <FormField label="Niche" htmlFor="niche" error={errorFor('niche')}>
              <input
                id="niche"
                type="text"
                value={values.niche}
                onChange={(e) => setField('niche', e.target.value)}
                onBlur={() => handleBlur('niche')}
                placeholder="Weird history facts"
                className={inputClass(!!errorFor('niche'))}
              />
            </FormField>

            <FormField label="Owner" htmlFor="owner">
              <SegmentedControl<Owner>
                name="Owner"
                value={values.owner}
                onChange={(v) => setField('owner', v)}
                options={[
                  { value: 'you', label: 'You' },
                  { value: 'friend', label: 'Friend' },
                ]}
              />
            </FormField>

            <FormField label="Platform handle" htmlFor="platformHandle" optional>
              <input
                id="platformHandle"
                type="text"
                value={values.platformHandle}
                onChange={(e) => setField('platformHandle', e.target.value)}
                placeholder="@handle or channel URL"
                className={inputClass(false)}
              />
            </FormField>

            <FormField label="Video-gen tool" htmlFor="videoGenTool" error={errorFor('videoGenTool')}>
              <input
                id="videoGenTool"
                type="text"
                value={values.videoGenTool}
                onChange={(e) => setField('videoGenTool', e.target.value)}
                onBlur={() => handleBlur('videoGenTool')}
                placeholder="InVideo"
                className={inputClass(!!errorFor('videoGenTool'))}
              />
            </FormField>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="needsVoiceover" className="text-sm font-medium text-zinc-300">
                  Needs voiceover
                </label>
                <Toggle
                  id="needsVoiceover"
                  checked={values.needsVoiceover}
                  onChange={(v) => setField('needsVoiceover', v)}
                  label="Needs voiceover"
                />
              </div>

              <div className={cn('reveal', values.needsVoiceover && 'reveal-open')}>
                <div>
                  <div className="pt-4">
                    <FormField label="Voice style" htmlFor="voiceStyle" optional>
                      <textarea
                        id="voiceStyle"
                        value={values.voiceStyle}
                        onChange={(e) => setField('voiceStyle', e.target.value)}
                        placeholder="Deep documentary narrator"
                        rows={2}
                        className={cn(inputClass(false), 'resize-none')}
                      />
                    </FormField>
                  </div>
                </div>
              </div>
            </div>

            {submitError && (
              <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {submitError}
              </p>
            )}
          </form>
        ) : (
          channel && (
            <div className="space-y-8">
              <div>
                <p className="text-sm font-light leading-relaxed text-zinc-400">{channel.niche}</p>
                <div className="mt-3 flex items-center gap-2">
                  <OwnerBadge owner={channel.owner} />
                  <MicIndicator on={channel.needsVoiceover} />
                  <span className="text-xs font-light text-zinc-500">
                    {channel.needsVoiceover ? 'Needs voiceover' : 'No voiceover'}
                  </span>
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-4 border-y border-zinc-800 py-5">
                <DetailRow label="Platform handle" value={channel.platformHandle || '—'} />
                <DetailRow label="Video-gen tool" value={channel.videoGenTool} />
                {channel.needsVoiceover && (
                  <DetailRow label="Voice style" value={channel.voiceStyle || '—'} />
                )}
                <DetailRow
                  label="Created"
                  value={new Date(channel.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                />
              </dl>

              <div>
                <h3 className="font-heading text-sm font-semibold tracking-tight text-zinc-200">
                  Recent activity
                </h3>

                {activityLoading ? (
                  <div className="mt-4 flex items-center gap-2 text-sm font-light text-zinc-500">
                    <Loader2 size={14} className="animate-spin" />
                    Loading activity…
                  </div>
                ) : activity && (activity.recentPlans.length > 0 || activity.latestInsight) ? (
                  <div className="mt-4 space-y-5">
                    {activity.recentPlans.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Last ideas
                        </p>
                        <ul className="space-y-2">
                          {activity.recentPlans.map((plan) => (
                            <li
                              key={plan.id}
                              className="flex items-center justify-between gap-3 rounded-lg bg-zinc-800/50 px-3 py-2"
                            >
                              <span className="truncate text-sm font-light text-zinc-300">
                                {plan.ideaTitle}
                              </span>
                              <span
                                className={cn(
                                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                                  STATUS_COLOR[plan.postStatus] ?? 'bg-zinc-700 text-zinc-300'
                                )}
                              >
                                {STATUS_LABEL[plan.postStatus] ?? plan.postStatus}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {activity.latestInsight && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Latest insight
                        </p>
                        <div className="flex items-start gap-2 rounded-lg bg-zinc-800/50 px-3 py-2.5">
                          <Sparkles size={14} className="mt-0.5 shrink-0 text-amber-300" />
                          <p className="text-sm font-light leading-relaxed text-zinc-300">
                            {activity.latestInsight.summary}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm font-light text-zinc-500">No activity yet.</p>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {isFormMode && (
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
            form="channel-form"
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {mode === 'add' ? 'Add channel' : 'Save changes'}
          </button>
        </div>
      )}
    </motion.aside>
  );
}

function inputClass(hasError: boolean) {
  return cn(
    'w-full rounded-lg border bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors focus:border-zinc-400 focus:bg-zinc-800',
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-sm font-light text-zinc-500">{label}</dt>
      <dd className="truncate text-sm text-zinc-200">{value}</dd>
    </div>
  );
}
