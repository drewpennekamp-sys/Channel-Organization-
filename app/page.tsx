import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels, settings } from '@/lib/db/schema';
import type { ChannelDTO } from '@/lib/types';
import { ChannelsScreen } from '@/components/ChannelsScreen';

export const dynamic = 'force-dynamic';

async function getInitialData(): Promise<{
  channels: ChannelDTO[];
  defaultVideoGenTool: string;
}> {
  const rows = await db.select().from(channels).orderBy(asc(channels.createdAt));
  const toolRow = await db
    .select()
    .from(settings)
    .where(eq(settings.key, 'default_video_gen_tool'))
    .get();

  return {
    channels: rows.map((row) => ({
      id: row.id,
      name: row.name,
      niche: row.niche,
      owner: row.owner,
      platformHandle: row.platformHandle,
      videoGenTool: row.videoGenTool,
      needsVoiceover: row.needsVoiceover,
      voiceStyle: row.voiceStyle,
      accentColor: row.accentColor,
      createdAt: row.createdAt.toISOString(),
    })),
    defaultVideoGenTool: toolRow?.value ?? '',
  };
}

export default async function Page() {
  const { channels: initialChannels, defaultVideoGenTool } = await getInitialData();

  return (
    <ChannelsScreen initialChannels={initialChannels} defaultVideoGenTool={defaultVideoGenTool} />
  );
}
