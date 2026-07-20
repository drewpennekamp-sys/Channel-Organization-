import { NextResponse } from 'next/server';
import { asc, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, dailyPlans } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  const allChannels = await db.select().from(channels).orderBy(asc(channels.createdAt));
  const allPlans = await db.select().from(dailyPlans).orderBy(desc(dailyPlans.createdAt));

  const latestPlanByChannel = new Map<string, (typeof allPlans)[number]>();
  for (const plan of allPlans) {
    if (!latestPlanByChannel.has(plan.channelId)) {
      latestPlanByChannel.set(plan.channelId, plan);
    }
  }

  const entries = allChannels.map((channel) => ({
    channel,
    plan: latestPlanByChannel.get(channel.id) ?? null,
  }));

  return NextResponse.json({ entries });
}
