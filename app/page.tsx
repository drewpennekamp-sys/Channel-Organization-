import Link from 'next/link';
import {
  getPortfolio,
  computePortfolioStats,
  buildActivityFeed,
  needsSearch,
  cardEmoji,
  cardTitle,
} from '@/lib/portfolio';
import { formatMoney, formatRelativeTime } from '@/lib/format';
import { CardThumb } from '@/components/CardThumb';

// Reads straight from the DB on every request — without this, Next.js
// statically prerenders it at build time and bakes in whatever was in the
// database then.
export const dynamic = 'force-dynamic';

function activityLine(event: ReturnType<typeof buildActivityFeed>[number]): { text: string; dot: string } {
  const title = cardTitle(event.copy.card);
  if (event.kind === 'added') {
    return { text: `<strong>Added to collection</strong> — ${title}`, dot: 'var(--accent)' };
  }
  if (event.kind === 'valued') {
    return {
      text: `<strong>Comps updated</strong> — ${title} (n=${event.copy.latestValuation!.sampleSize})`,
      dot: 'var(--success)',
    };
  }
  return {
    text: `<strong>Insufficient comps</strong> (n=${event.copy.latestValuation!.sampleSize}) — ${title}`,
    dot: 'var(--warning)',
  };
}

export default async function DashboardPage() {
  const copies = await getPortfolio();
  const stats = computePortfolioStats(copies);
  const activity = buildActivityFeed(copies, 6);
  const attention = copies.filter(needsSearch).slice(0, 4);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-desc">Your collection at a glance — value, recent activity, and what needs a comp search.</p>
        </div>
        <Link href="/add" className="btn btn-primary">
          + Add card
        </Link>
      </div>

      {copies.length === 0 ? (
        <div className="panel">
          <div className="panel-body">
            <div className="empty-note">
              No cards yet.{' '}
              <Link href="/add" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                Add your first card
              </Link>
              .
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat-tile">
              <div className="eyebrow">Total value</div>
              <div className="stat-value num">{formatMoney(stats.totalValue)}</div>
              <div className="refractor-underline" />
            </div>
            <div className="stat-tile">
              <div className="eyebrow">Cards owned</div>
              <div className="stat-value num">{stats.cardCount}</div>
              <div className="stat-sub">
                across {stats.setCount} set{stats.setCount === 1 ? '' : 's'}
              </div>
            </div>
            <div className="stat-tile">
              <div className="eyebrow">Gain on valued cards</div>
              {stats.gainOnValued === null ? (
                <>
                  <div className="stat-value num" style={{ color: 'var(--text-faint)' }}>
                    —
                  </div>
                  <div className="stat-sub">no priced cards with a purchase price yet</div>
                </>
              ) : (
                <>
                  <div
                    className="stat-value num"
                    style={{ color: stats.gainOnValued >= 0 ? 'var(--success)' : 'var(--danger)' }}
                  >
                    {stats.gainOnValued >= 0 ? '+' : ''}
                    {formatMoney(stats.gainOnValued)}
                  </div>
                  <div className="stat-sub">
                    <span className={`chip ${stats.gainOnValued >= 0 ? 'chip-up' : 'chip-down'}`}>
                      {stats.gainOnValued >= 0 ? '▲' : '▼'} {Math.abs(stats.gainPctOnValued ?? 0).toFixed(1)}%
                    </span>{' '}
                    vs cost
                  </div>
                </>
              )}
            </div>
            <div className="stat-tile">
              <div className="eyebrow">Needs a search</div>
              <div className="stat-value num">{stats.needsSearchCount}</div>
              <div className="stat-sub">insufficient or unsearched</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="panel">
              <div className="panel-head">
                <h3>Recent activity</h3>
              </div>
              <div className="panel-body">
                {activity.length === 0 ? (
                  <div className="empty-note">Nothing yet — add a card or run a comp search.</div>
                ) : (
                  activity.map((event) => {
                    const line = activityLine(event);
                    return (
                      <div className="feed-row" key={event.id}>
                        <span className="feed-dot" style={{ background: line.dot }} />
                        <span className="feed-text" dangerouslySetInnerHTML={{ __html: line.text }} />
                        <span className="feed-time">{formatRelativeTime(event.at)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3>Needs attention</h3>
              </div>
              <div className="panel-body">
                {attention.length === 0 ? (
                  <div className="empty-note">Every card has a comp search on record.</div>
                ) : (
                  attention.map((copy) => (
                    <div className="attn-row" key={copy.id}>
                      <div className="attn-thumb">
                        <CardThumb src={copy.frontImagePath} alt="" emoji={cardEmoji(copy.card)} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="attn-name">{cardTitle(copy.card)}</div>
                        <div className="attn-meta">
                          {copy.grade} ·{' '}
                          {copy.latestValuation
                            ? `insufficient (n=${copy.latestValuation.sampleSize})`
                            : 'not yet valued'}
                        </div>
                      </div>
                      <Link href="/comps" className="btn btn-sm">
                        Search
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
