'use client';

import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import type { KeyStatus, SettingsDTO } from '@/lib/types';
import { ApiError, updateSettingsApi } from '@/lib/client-api';
import { Toggle } from './Toggle';
import { cn } from '@/lib/cn';
import { ApiKeysSection } from './ApiKeysSection';
import { BackupSection } from './BackupSection';

interface FormValues {
  defaultVideoGenTool: string;
  defaultPostingTarget: string;
  defaultNeedsVoiceover: boolean;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: string;
  pollIntervalSeconds: string;
}

function toFormValues(settings: SettingsDTO): FormValues {
  return {
    defaultVideoGenTool: settings.defaultVideoGenTool,
    defaultPostingTarget: String(settings.defaultPostingTarget),
    defaultNeedsVoiceover: settings.defaultNeedsVoiceover,
    autoSyncEnabled: settings.autoSyncEnabled,
    autoSyncIntervalMinutes: String(settings.autoSyncIntervalMinutes),
    pollIntervalSeconds: String(settings.pollIntervalSeconds),
  };
}

type Field =
  | 'defaultVideoGenTool'
  | 'defaultPostingTarget'
  | 'autoSyncIntervalMinutes'
  | 'pollIntervalSeconds';

function validateField(field: Field, values: FormValues): string | undefined {
  if (field === 'defaultVideoGenTool') {
    if (!values.defaultVideoGenTool.trim()) return 'Required';
    return undefined;
  }
  if (field === 'defaultPostingTarget') {
    const n = Number(values.defaultPostingTarget);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 20) {
      return 'Whole number, 1–20';
    }
    return undefined;
  }
  if (field === 'autoSyncIntervalMinutes') {
    const n = Number(values.autoSyncIntervalMinutes);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 5 || n > 1440) {
      return 'Whole number, 5–1440';
    }
    return undefined;
  }
  if (field === 'pollIntervalSeconds') {
    const n = Number(values.pollIntervalSeconds);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 5 || n > 600) {
      return 'Whole number, 5–600';
    }
    return undefined;
  }
  return undefined;
}

export function SettingsScreen({
  initialSettings,
  initialKeys,
}: {
  initialSettings: SettingsDTO;
  initialKeys: { anthropic: KeyStatus; vidiq: KeyStatus };
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [values, setValues] = useState<FormValues>(() => toFormValues(initialSettings));
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const fields: Field[] = [
    'defaultVideoGenTool',
    'defaultPostingTarget',
    'autoSyncIntervalMinutes',
    'pollIntervalSeconds',
  ];
  const errors = Object.fromEntries(fields.map((f) => [f, validateField(f, values)])) as Record<
    Field,
    string | undefined
  >;
  const isValid = fields.every((f) => !errors[f]);
  const isDirty = JSON.stringify(values) !== JSON.stringify(toFormValues(settings));

  function errorFor(field: Field): string | undefined {
    return touched[field] ? errors[field] : undefined;
  }

  function setField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [field]: value }));
    setSavedFlash(false);
  }

  async function handleSave() {
    setTouched({
      defaultVideoGenTool: true,
      defaultPostingTarget: true,
      autoSyncIntervalMinutes: true,
      pollIntervalSeconds: true,
    });
    if (!isValid) return;

    setSaving(true);
    setSaveError(null);
    try {
      const { settings: updated } = await updateSettingsApi({
        defaultVideoGenTool: values.defaultVideoGenTool.trim(),
        defaultPostingTarget: Number(values.defaultPostingTarget),
        defaultNeedsVoiceover: values.defaultNeedsVoiceover,
        autoSyncEnabled: values.autoSyncEnabled,
        autoSyncIntervalMinutes: Number(values.autoSyncIntervalMinutes),
        pollIntervalSeconds: Number(values.pollIntervalSeconds),
      });
      setSettings(updated);
      setValues(toFormValues(updated));
      setSavedFlash(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 sm:px-8 lg:px-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-zinc-50">
          Settings
        </h1>
        <p className="mt-1 text-sm font-light text-zinc-400">
          Defaults the rest of the app reads from, API keys, and your data backups.
        </p>
      </div>

      <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-zinc-200">
          Account defaults
        </h2>
        <p className="mt-1 text-xs font-light leading-relaxed text-zinc-500">
          New channels inherit these — still overridable per channel on the Channels screen.
        </p>

        <div className="mt-5 space-y-5">
          <FormField label="Default AI video-gen tool" htmlFor="defaultVideoGenTool" error={errorFor('defaultVideoGenTool')}>
            <input
              id="defaultVideoGenTool"
              type="text"
              value={values.defaultVideoGenTool}
              onChange={(e) => setField('defaultVideoGenTool', e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, defaultVideoGenTool: true }))}
              placeholder="InVideo"
              className={inputClass(!!errorFor('defaultVideoGenTool'))}
            />
          </FormField>

          <FormField
            label="Default posting target"
            htmlFor="defaultPostingTarget"
            error={errorFor('defaultPostingTarget')}
            hint="Posts/day, used for the video log's month-vs-target progress"
          >
            <input
              id="defaultPostingTarget"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={values.defaultPostingTarget}
              onChange={(e) => setField('defaultPostingTarget', e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, defaultPostingTarget: true }))}
              className={cn(inputClass(!!errorFor('defaultPostingTarget')), 'max-w-[8rem]')}
            />
          </FormField>

          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="defaultNeedsVoiceover" className="text-sm font-medium text-zinc-300">
                Generate voiceover by default
              </label>
              <p className="mt-0.5 text-xs font-light text-zinc-500">
                New channels start with this on or off; still editable per channel.
              </p>
            </div>
            <Toggle
              id="defaultNeedsVoiceover"
              checked={values.defaultNeedsVoiceover}
              onChange={(v) => setField('defaultNeedsVoiceover', v)}
              label="Generate voiceover by default"
            />
          </div>

          <div className="border-t border-zinc-800 pt-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label htmlFor="autoSyncEnabled" className="text-sm font-medium text-zinc-300">
                  Auto-sync from vidIQ
                </label>
                <p className="mt-0.5 text-xs font-light text-zinc-500">
                  A Vercel Cron job checks once a day (the platform limit); this floor can space
                  syncs out further if you want them less often than that.
                </p>
              </div>
              <Toggle
                id="autoSyncEnabled"
                checked={values.autoSyncEnabled}
                onChange={(v) => setField('autoSyncEnabled', v)}
                label="Auto-sync from vidIQ"
              />
            </div>

            <div className={cn('reveal', values.autoSyncEnabled && 'reveal-open')}>
              <div>
                <div className="pt-4">
                  <FormField
                    label="Auto-sync interval"
                    htmlFor="autoSyncIntervalMinutes"
                    error={errorFor('autoSyncIntervalMinutes')}
                    hint="Minutes between syncs — won't run more often than the once-a-day cron"
                  >
                    <input
                      id="autoSyncIntervalMinutes"
                      type="number"
                      inputMode="numeric"
                      min={5}
                      max={1440}
                      value={values.autoSyncIntervalMinutes}
                      onChange={(e) => setField('autoSyncIntervalMinutes', e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, autoSyncIntervalMinutes: true }))}
                      className={cn(inputClass(!!errorFor('autoSyncIntervalMinutes')), 'max-w-[8rem]')}
                    />
                  </FormField>
                </div>
              </div>
            </div>
          </div>

          <FormField
            label="Client poll interval"
            htmlFor="pollIntervalSeconds"
            error={errorFor('pollIntervalSeconds')}
            hint="Seconds between live-refreshes of the Dashboard and Today view"
          >
            <input
              id="pollIntervalSeconds"
              type="number"
              inputMode="numeric"
              min={5}
              max={600}
              value={values.pollIntervalSeconds}
              onChange={(e) => setField('pollIntervalSeconds', e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, pollIntervalSeconds: true }))}
              className={cn(inputClass(!!errorFor('pollIntervalSeconds')), 'max-w-[8rem]')}
            />
          </FormField>
        </div>

        {saveError && (
          <p className="mt-4 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {saveError}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3 border-t border-zinc-800 pt-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid || saving || !isDirty}
            className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save changes
          </button>
          {savedFlash && !isDirty && (
            <span className="text-xs font-medium text-emerald-400">Saved</span>
          )}
        </div>
      </section>

      <div className="mt-6">
        <ApiKeysSection keys={initialKeys} />
      </div>

      <div className="mt-6">
        <BackupSection />
      </div>
    </main>
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
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-300">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs font-light text-zinc-500">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
