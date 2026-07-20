import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { channels, dailyPlans, insights, postedVideos } from '@/lib/db/schema';
import { importDataSchema } from '@/lib/validation';
import { updateSettings } from '@/lib/settings';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = importDataSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: `This doesn't look like a Shorts Factory backup file${
          firstIssue ? ` (${firstIssue.path.join('.')}: ${firstIssue.message})` : ''
        }`,
      },
      { status: 422 }
    );
  }

  const data = parsed.data;

  try {
    // Deleting channels cascades to insights/daily_plans/posted_videos, so
    // this alone clears every table the import is about to repopulate.
    await db.delete(channels);

    if (data.channels.length > 0) {
      await db.insert(channels).values(
        data.channels.map((c) => ({
          id: c.id,
          name: c.name,
          niche: c.niche,
          owner: c.owner,
          platformHandle: c.platformHandle,
          videoGenTool: c.videoGenTool,
          needsVoiceover: c.needsVoiceover,
          voiceStyle: c.voiceStyle,
          accentColor: c.accentColor,
          createdAt: new Date(c.createdAt),
        }))
      );
    }

    if (data.insights.length > 0) {
      await db.insert(insights).values(
        data.insights.map((i) => ({
          id: i.id,
          channelId: i.channelId,
          date: new Date(i.date),
          summary: i.summary,
          recommendations: JSON.stringify(i.recommendations),
          source: i.source,
          createdAt: new Date(i.createdAt),
        }))
      );
    }

    if (data.dailyPlans.length > 0) {
      await db.insert(dailyPlans).values(
        data.dailyPlans.map((p) => ({
          id: p.id,
          channelId: p.channelId,
          ideaTitle: p.ideaTitle,
          hook: p.hook,
          videoPrompt: p.videoPrompt,
          voiceoverScript: p.voiceoverScript,
          postStatus: p.postStatus,
          postedAt: p.postedAt ? new Date(p.postedAt) : null,
          informedByInsightId: p.informedByInsightId,
          createdAt: new Date(p.createdAt),
        }))
      );
    }

    if (data.postedVideos.length > 0) {
      await db.insert(postedVideos).values(
        data.postedVideos.map((v) => ({
          id: v.id,
          channelId: v.channelId,
          dailyPlanId: v.dailyPlanId,
          ideaTitle: v.ideaTitle,
          platformVideoId: v.platformVideoId,
          postedAt: new Date(v.postedAt),
          views: v.views,
          likes: v.likes,
          comments: v.comments,
          shares: v.shares,
          avgViewDuration: v.avgViewDuration,
          retentionNote: v.retentionNote,
          lastSyncedAt: v.lastSyncedAt ? new Date(v.lastSyncedAt) : null,
        }))
      );
    }

    await updateSettings(data.settings);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    return NextResponse.json({ error: `Import failed partway through: ${message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    counts: {
      channels: data.channels.length,
      insights: data.insights.length,
      dailyPlans: data.dailyPlans.length,
      postedVideos: data.postedVideos.length,
    },
  });
}
