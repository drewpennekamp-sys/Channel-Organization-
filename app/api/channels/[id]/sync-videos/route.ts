import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, postedVideos } from '@/lib/db/schema';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const channel = await db.select().from(channels).where(eq(channels.id, params.id)).get();
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  await delay(700 + Math.random() * 500);

  // TODO(vidIQ sync): replace this stub with a real call to the vidIQ MCP/API,
  // keyed off `channel.platformHandle`, to pull fresh views/likes/comments/shares
  // and avg_view_duration per platform_video_id. For now we just stamp
  // last_synced_at so the "Last synced" label reflects that a sync ran,
  // without touching any of the stats.
  const now = new Date();
  await db
    .update(postedVideos)
    .set({ lastSyncedAt: now })
    .where(eq(postedVideos.channelId, channel.id));

  const videos = await db.select().from(postedVideos).where(eq(postedVideos.channelId, channel.id));

  return NextResponse.json({ videos });
}
