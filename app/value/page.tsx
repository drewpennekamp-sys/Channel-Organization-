import {
  getPortfolio,
  computePortfolioStats,
  cardTitle,
  cardSubtitle,
  currentValue,
  gain,
} from '@/lib/portfolio';
import { formatMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ValuePage() {
  const copies = await getPortfolio();
  const stats = computePortfolioStats(copies);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Value</h1>
          <p className="page-desc">
            Only cards with a sufficient comp search count as valued — the rest are shown at cost, never guessed.
          </p>
        </div>
      </div>

      {copies.length === 0 ? (
        <div className="panel">
          <div className="empty-note">Add a card to start tracking its value.</div>
        </div>
      ) : (
        <>
          <div className="value-hero">
            <div className="hero-panel">
              <div className="eyebrow">Total collection value</div>
              <div className="hero-figure num">{formatMoney(stats.totalValue)}</div>
              <div className="refractor-underline" />
              <div className="hero-note">
                <strong style={{ color: 'var(--text)' }}>{formatMoney(stats.valuedSubtotal)}</strong> valued from real
                comps on {stats.valuedCount} card{stats.valuedCount === 1 ? '' : 's'}
                {stats.atCostCount > 0 && (
                  <>
                    {' '}
                    · <strong style={{ color: 'var(--text)' }}>{formatMoney(stats.atCostSubtotal)}</strong> at
                    purchase price on {stats.atCostCount} card{stats.atCostCount === 1 ? '' : 's'} with insufficient
                    comps
                  </>
                )}
              </div>
            </div>

            <div className="hero-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
              <div>
                <div className="eyebrow">Best performer</div>
                {stats.bestPerformer ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{cardTitle(stats.bestPerformer.copy.card)}</span>
                    <span className={`chip num ${stats.bestPerformer.pct >= 0 ? 'chip-up' : 'chip-down'}`}>
                      {stats.bestPerformer.pct >= 0 ? '▲' : '▼'} {Math.abs(stats.bestPerformer.pct).toFixed(1)}%
                    </span>
                  </div>
                ) : (
                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                    No priced cards with a purchase price yet
                  </div>
                )}
              </div>
              <div style={{ height: 1, background: 'var(--border-subtle)' }} />
              <div>
                <div className="eyebrow">Needs a look</div>
                {stats.worstPerformer ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{cardTitle(stats.worstPerformer.copy.card)}</span>
                    <span className={`chip num ${stats.worstPerformer.pct >= 0 ? 'chip-up' : 'chip-down'}`}>
                      {stats.worstPerformer.pct >= 0 ? '▲' : '▼'} {Math.abs(stats.worstPerformer.pct).toFixed(1)}%
                    </span>
                  </div>
                ) : (
                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>—</div>
                )}
              </div>
              <div style={{ height: 1, background: 'var(--border-subtle)' }} />
              <div>
                <div className="eyebrow">Unpriced</div>
                <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                  {stats.atCostCount} card{stats.atCostCount === 1 ? '' : 's'} at cost · comps pending
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Holdings</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="holdings-table">
                <thead>
                  <tr>
                    <th>Card</th>
                    <th>Grade</th>
                    <th className="num">Paid</th>
                    <th className="num">Value</th>
                    <th className="num">Gain</th>
                    <th className="num">Comps</th>
                  </tr>
                </thead>
                <tbody>
                  {copies.map((copy) => {
                    const { amount, isPriced } = currentValue(copy);
                    const g = gain(copy);
                    return (
                      <tr key={copy.id}>
                        <td>
                          <div className="hname">{cardTitle(copy.card)}</div>
                          <div className="hsub">{cardSubtitle(copy.card)}</div>
                        </td>
                        <td className="num">{copy.grade}</td>
                        <td className="num">{formatMoney(copy.purchasePrice)}</td>
                        <td className="num">{formatMoney(amount)}</td>
                        <td className="num">
                          {g === null ? (
                            <span className="chip chip-neutral">{isPriced ? '—' : 'at cost'}</span>
                          ) : (
                            <span className={`chip num ${g.amount >= 0 ? 'chip-up' : 'chip-down'}`}>
                              {g.amount >= 0 ? '▲' : '▼'} {Math.abs(g.pct).toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="num">
                          {!copy.latestValuation ? (
                            <span className="chip chip-neutral">unsearched</span>
                          ) : copy.latestValuation.sufficient ? (
                            <span className="chip chip-up">n={copy.latestValuation.sampleSize}</span>
                          ) : (
                            <span className="chip chip-warn">n={copy.latestValuation.sampleSize}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
