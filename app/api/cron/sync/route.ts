import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { channels } from '@/lib/db/schema';
import { getSettings, getLastAutoSyncAt, setLastAutoSyncAt } from '@/lib/settings';
import { runVidiqSync } from '@/lib/vidiq';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

// Vercel Cron fires this on a fixed schedule (see vercel.json — once daily;
// the Hobby plan doesn't allow more frequent cron jobs). The
// settings.autoSyncIntervalMinutes floor can't change how often Vercel
// *invokes* this route without redeploying, but it can make an invocation a
// no-op if it hasn't been long enough since the last sync (e.g. set it above
// 1440 to sync every few days instead of daily), so the setting still means
// something even under a fixed cron cadence.
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await getSettings();
  if (!settings.autoSyncEnabled) {
    return NextResponse.json({ ok: true, skipped: 'auto-sync is disabled in Settings' });
  }

  const now = new Date();
  const lastSyncAt = await getLastAutoSyncAt();
  if (lastSyncAt) {
    const dueAt = new Date(lastSyncAt.getTime() + settings.autoSyncIntervalMinutes * 60_000);
    if (dueAt > now) {
      return NextResponse.json({ ok: true, skipped: 'not due yet', dueAt: dueAt.toISOString() });
    }
  }

  const allChannels = await db.select({ id: channels.id }).from(channels);
  for (const channel of allChannels) {
    await runVidiqSync(channel.id, now);
  }
  await setLastAutoSyncAt(now);

  return NextResponse.json({ ok: true, syncedChannels: allChannels.length, syncedAt: now.toISOString() });
}
