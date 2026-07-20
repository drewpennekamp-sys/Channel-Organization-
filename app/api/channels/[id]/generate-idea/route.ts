import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, dailyPlans } from '@/lib/db/schema';
import { generateIdea } from '@/lib/ideaGenerator';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const channel = await db.select().from(channels).where(eq(channels.id, params.id)).get();
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  await delay(600 + Math.random() * 500);

  const generated = generateIdea(channel.niche, channel.needsVoiceover, channel.voiceStyle);

  await db
    .delete(dailyPlans)
    .where(and(eq(dailyPlans.channelId, channel.id), ne(dailyPlans.postStatus, 'posted')));

  const id = randomUUID();
  await db.insert(dailyPlans).values({
    id,
    channelId: channel.id,
    ideaTitle: generated.ideaTitle,
    hook: generated.hook,
    videoPrompt: generated.videoPrompt,
    voiceoverScript: generated.voiceoverScript,
    postStatus: 'idea',
  });

  const plan = await db.select().from(dailyPlans).where(eq(dailyPlans.id, id)).get();

  return NextResponse.json({ plan });
}
