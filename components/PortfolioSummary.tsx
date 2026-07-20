import { TrendingDown, TrendingUp } from 'lucide-react';
import type { PortfolioSummaryDTO } from '@/lib/types';

function formatViews(n: number): string {
  return n.toLocaleString();
}

function formatDelta(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString()}`;
}

export function PortfolioSummary({ portfolio }: { portfolio: PortfolioSummaryDTO }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-zinc-200">
        Portfolio
      </h2>

      {!portfolio.hasEnoughData ? (
        <p className="mt-2 text-sm font-light leading-relaxed text-zinc-500">
          Not enough posting activity yet to compare this week against last. Post a few videos
          across your channels and this will fill in.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Views this week
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xl font-semibold tabular-nums text-zinc-50">
                {formatViews(portfolio.totalViewsThisWeek)}
              </span>
              <span className="text-xs font-light text-zinc-500">
                vs {formatViews(portfolio.totalViewsLastWeek)} last week
              </span>
            </div>
            <p
              className={`mt-1 text-xs font-medium tabular-nums ${
                portfolio.totalViewsDelta > 0
                  ? 'text-emerald-400'
                  : portfolio.totalViewsDelta < 0
                    ? 'text-rose-400'
                    : 'text-zinc-500'
              }`}
            >
              {formatDelta(portfolio.totalViewsDelta)} views
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Fastest growing
            </p>
            {portfolio.fastestGrowing ? (
              <div
                style={{ borderColor: portfolio.fastestGrowing.accentColor }}
                className="mt-1.5 flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
              >
                <TrendingUp
                  size={14}
                  className="shrink-0"
                  style={{ color: portfolio.fastestGrowing.accentColor }}
                />
                <span
                  className="truncate text-sm font-medium"
                  style={{ color: portfolio.fastestGrowing.accentColor }}
                >
                  {portfolio.fastestGrowing.name}
                </span>
                <span className="ml-auto shrink-0 text-xs font-light tabular-nums text-zinc-400">
                  {formatDelta(portfolio.fastestGrowing.delta)}
                </span>
              </div>
            ) : (
              <p className="mt-1.5 text-sm font-light text-zinc-500">No growth yet</p>
            )}
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Lagging</p>
            {portfolio.lagging ? (
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-zinc-800 px-2.5 py-1.5">
                <TrendingDown size={14} className="shrink-0 text-zinc-500" />
                <span className="truncate text-sm font-medium text-zinc-300">
                  {portfolio.lagging.name}
                </span>
                <span className="ml-auto shrink-0 text-xs font-light tabular-nums text-zinc-500">
                  {formatDelta(portfolio.lagging.delta)}
                </span>
              </div>
            ) : (
              <p className="mt-1.5 text-sm font-light text-zinc-500">Nothing lagging behind</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
