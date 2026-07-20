import type { ChannelDTO, ChannelGrowth, PortfolioSummaryDTO, PostedVideoDTO } from './types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Growth is expressed as an absolute views delta (this week minus last
 * week), never a ratio — that sidesteps division-by-zero/NaN entirely for
 * channels with no videos in one or both windows.
 */
export function computePortfolioSummary(
  entries: { channel: ChannelDTO; videos: PostedVideoDTO[] }[],
  now: Date = new Date()
): PortfolioSummaryDTO {
  const nowMs = now.getTime();
  const thisWeekStart = nowMs - WEEK_MS;
  const lastWeekStart = nowMs - 2 * WEEK_MS;

  const growths: ChannelGrowth[] = [];
  let totalThisWeek = 0;
  let totalLastWeek = 0;

  for (const { channel, videos } of entries) {
    let thisWeekViews = 0;
    let lastWeekViews = 0;
    for (const video of videos) {
      const postedMs = new Date(video.postedAt).getTime();
      if (postedMs >= thisWeekStart) {
        thisWeekViews += video.views;
      } else if (postedMs >= lastWeekStart) {
        lastWeekViews += video.views;
      }
    }
    totalThisWeek += thisWeekViews;
    totalLastWeek += lastWeekViews;
    growths.push({
      channelId: channel.id,
      name: channel.name,
      accentColor: channel.accentColor,
      thisWeekViews,
      lastWeekViews,
      delta: thisWeekViews - lastWeekViews,
    });
  }

  const channelsWithData = growths.filter((g) => g.thisWeekViews > 0 || g.lastWeekViews > 0);

  if (channelsWithData.length === 0) {
    return {
      totalViewsThisWeek: 0,
      totalViewsLastWeek: 0,
      totalViewsDelta: 0,
      fastestGrowing: null,
      lagging: null,
      hasEnoughData: false,
    };
  }

  const sorted = [...channelsWithData].sort((a, b) => b.delta - a.delta);
  const fastestGrowing = sorted[0].delta > 0 ? sorted[0] : null;
  const laggingCandidate = sorted[sorted.length - 1];
  const lagging =
    channelsWithData.length > 1 && laggingCandidate.channelId !== fastestGrowing?.channelId
      ? laggingCandidate
      : null;

  return {
    totalViewsThisWeek: totalThisWeek,
    totalViewsLastWeek: totalLastWeek,
    totalViewsDelta: totalThisWeek - totalLastWeek,
    fastestGrowing,
    lagging,
    hasEnoughData: true,
  };
}
