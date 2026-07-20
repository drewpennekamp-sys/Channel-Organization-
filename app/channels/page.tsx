import { asc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { channels } from '@/lib/db/schema';
import { getSettings } from '@/lib/settings';
import type { ChannelDTO } from '@/lib/types';
import { ChannelsScreen } from '@/components/ChannelsScreen';

export const dynamic = 'force-dynamic';

async function getInitialData(): Promise<{
  channels: ChannelDTO[];
  defaultVideoGenTool: string;
  defaultNeedsVoiceover: boolean;
}> {
  const rows = await db.select().from(channels).orderBy(asc(channels.createdAt));
  const settings = await getSettings();

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
    defaultVideoGenTool: settings.defaultVideoGenTool,
    defaultNeedsVoiceover: settings.defaultNeedsVoiceover,
  };
}

export default async function Page() {
  const { channels: initialChannels, defaultVideoGenTool, defaultNeedsVoiceover } =
    await getInitialData();

  return (
    <ChannelsScreen
      initialChannels={initialChannels}
      defaultVideoGenTool={defaultVideoGenTool}
      defaultNeedsVoiceover={defaultNeedsVoiceover}
    />
  );
}
