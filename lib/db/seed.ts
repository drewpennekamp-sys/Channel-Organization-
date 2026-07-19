import { randomUUID } from 'node:crypto';
import { db } from './client';
import { channels, dailyPlans, insights } from './schema';
import { nextAccentColor } from '../palette';

async function seed() {
  const existing = await db.select().from(channels);
  if (existing.length > 0) {
    console.log(`Skipping seed: ${existing.length} channel(s) already exist.`);
    return;
  }

  const seedChannels = [
    {
      name: 'Weird History Bites',
      niche: 'Weird history facts',
      owner: 'you' as const,
      platformHandle: '@weirdhistorybites',
      videoGenTool: 'InVideo',
      needsVoiceover: true,
      voiceStyle: 'Deep documentary narrator, slow pacing',
    },
    {
      name: 'Pocket Physics',
      niche: 'Mind-bending physics in 60 seconds',
      owner: 'friend' as const,
      platformHandle: '@pocketphysics',
      videoGenTool: 'Runway',
      needsVoiceover: false,
      voiceStyle: null,
    },
    {
      name: 'Cursed Cuisine',
      niche: 'The strangest foods people actually eat',
      owner: 'you' as const,
      platformHandle: null,
      videoGenTool: 'InVideo',
      needsVoiceover: true,
      voiceStyle: 'Upbeat, slightly sarcastic, fast cuts',
    },
  ];

  const usedColors: string[] = [];
  for (const ch of seedChannels) {
    const color = nextAccentColor(usedColors);
    usedColors.push(color);
    const id = randomUUID();
    await db.insert(channels).values({
      id,
      ...ch,
      accentColor: color,
    });

    if (ch.name === 'Weird History Bites') {
      await db.insert(dailyPlans).values([
        {
          id: randomUUID(),
          channelId: id,
          ideaTitle: 'The king who was crowned at age 9 months',
          postStatus: 'posted',
        },
        {
          id: randomUUID(),
          channelId: id,
          ideaTitle: 'The war that lasted 38 minutes',
          postStatus: 'scheduled',
        },
        {
          id: randomUUID(),
          channelId: id,
          ideaTitle: "The postal service that used rockets",
          postStatus: 'scripted',
        },
      ]);
      await db.insert(insights).values({
        id: randomUUID(),
        channelId: id,
        summary:
          'Hooks under 2 seconds are outperforming longer setups by 3x average watch-through this week.',
      });
    }
  }

  console.log(`Seeded ${seedChannels.length} channels.`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
