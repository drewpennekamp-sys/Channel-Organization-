import { db } from './db/client';
import { settings } from './db/schema';

export interface SettingsDTO {
  defaultVideoGenTool: string;
  defaultPostingTarget: number;
  defaultNeedsVoiceover: boolean;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  pollIntervalSeconds: number;
}

export const SETTINGS_DEFAULTS: SettingsDTO = {
  defaultVideoGenTool: 'InVideo',
  defaultPostingTarget: 1,
  defaultNeedsVoiceover: false,
  autoSyncEnabled: false,
  autoSyncIntervalMinutes: 60,
  pollIntervalSeconds: 30,
};

// Every setting lives as one row in the generic key/value `settings` table.
// This map is the single source of truth for the DB key each field uses, so
// the app-facing shape can evolve independently of storage.
const SETTINGS_KEYS: Record<keyof SettingsDTO, string> = {
  defaultVideoGenTool: 'default_video_gen_tool',
  defaultPostingTarget: 'default_posting_target',
  defaultNeedsVoiceover: 'default_needs_voiceover',
  autoSyncEnabled: 'auto_sync_enabled',
  autoSyncIntervalMinutes: 'auto_sync_interval_minutes',
  pollIntervalSeconds: 'poll_interval_seconds',
};

function parseValue<K extends keyof SettingsDTO>(key: K, raw: string | undefined): SettingsDTO[K] {
  const fallback = SETTINGS_DEFAULTS[key];
  if (raw === undefined) return fallback;

  if (typeof fallback === 'boolean') {
    return (raw === 'true') as SettingsDTO[K];
  }
  if (typeof fallback === 'number') {
    const n = Number(raw);
    return (Number.isFinite(n) ? n : fallback) as SettingsDTO[K];
  }
  return raw as SettingsDTO[K];
}

function serializeValue(value: string | number | boolean): string {
  return String(value);
}

export async function getSettings(): Promise<SettingsDTO> {
  const rows = await db.select().from(settings);
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const result = {} as SettingsDTO;
  for (const key of Object.keys(SETTINGS_KEYS) as (keyof SettingsDTO)[]) {
    result[key] = parseValue(key, byKey.get(SETTINGS_KEYS[key])) as never;
  }
  return result;
}

export async function updateSettings(partial: Partial<SettingsDTO>): Promise<SettingsDTO> {
  for (const key of Object.keys(partial) as (keyof SettingsDTO)[]) {
    const value = partial[key];
    if (value === undefined) continue;
    const dbKey = SETTINGS_KEYS[key];
    await db
      .insert(settings)
      .values({ key: dbKey, value: serializeValue(value) })
      .onConflictDoUpdate({ target: settings.key, set: { value: serializeValue(value) } });
  }
  return getSettings();
}
