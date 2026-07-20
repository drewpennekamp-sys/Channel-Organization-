import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { postedVideos } from './db/schema';

// TODO(vidIQ sync): replace this stub with a real call to the vidIQ API,
// keyed off the channel's platformHandle, to pull fresh views/likes/comments/
// shares and avg_view_duration per platform_video_id. For now it just stamps
// last_synced_at so "Last synced" reflects that a sync ran, without touching
// any of the stats. Shared by both the manual per-channel sync route and the
// cron-driven auto-sync so they stay behaviorally identical.
export async function runVidiqSync(channelId: string, now: Date = new Date()): Promise<void> {
  await db
    .update(postedVideos)
    .set({ lastSyncedAt: now })
    .where(eq(postedVideos.channelId, channelId));
}
