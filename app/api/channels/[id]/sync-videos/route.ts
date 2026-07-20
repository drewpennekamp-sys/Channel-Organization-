import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, postedVideos } from '@/lib/db/schema';
import { runVidiqSync } from '@/lib/vidiq';

export const dynamic = 'force-dynamic';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const [channel] = await db.select().from(channels).where(eq(channels.id, params.id)).limit(1);
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  await delay(700 + Math.random() * 500);
  await runVidiqSync(channel.id);

  const videos = await db.select().from(postedVideos).where(eq(postedVideos.channelId, channel.id));

  return NextResponse.json({ videos });
}
