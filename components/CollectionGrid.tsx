'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { RefreshValueButton } from '@/components/RefreshValueButton';
import { CardThumb } from '@/components/CardThumb';
import { formatMoney } from '@/lib/format';
import {
  cardEmoji,
  cardTitle,
  cardSubtitle,
  currentValue,
  needsSearch,
  type PortfolioCopy,
} from '@/lib/portfolio';

function statusChip(copy: PortfolioCopy) {
  if (!copy.latestValuation) return <span className="chip chip-neutral">unsearched</span>;
  if (!copy.latestValuation.sufficient) {
    return <span className="chip chip-warn">n={copy.latestValuation.sampleSize}</span>;
  }
  return <span className="chip chip-up">n={copy.latestValuation.sampleSize}</span>;
}

export function CollectionGrid({ copies }: { copies: PortfolioCopy[] }) {
  const [filter, setFilter] = useState<string>('All');
  const [query, setQuery] = useState('');

  const sports = useMemo(
    () => Array.from(new Set(copies.map((c) => c.card.sport).filter(Boolean))).sort(),
    [copies],
  );

  const filtered = copies.filter((copy) => {
    if (filter === 'Graded' && copy.grade.trim().toUpperCase() === 'RAW') return false;
    if (filter === 'Raw' && copy.grade.trim().toUpperCase() !== 'RAW') return false;
    if (filter === 'Needs search' && !needsSearch(copy)) return false;
    if (sports.includes(filter) && copy.card.sport !== filter) return false;

    if (query.trim()) {
      const haystack = `${cardTitle(copy.card)} ${cardSubtitle(copy.card)} ${copy.grade}`.toLowerCase();
      if (!haystack.includes(query.trim().toLowerCase())) return false;
    }
    return true;
  });

  const pills = ['All', ...sports, 'Graded', 'Raw', 'Needs search'];

  return (
    <>
      <div className="filter-bar">
        {pills.map((pill) => (
          <button
            key={pill}
            type="button"
            className={`filter-pill${filter === pill ? ' active' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => setFilter(pill)}
          >
            {pill}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <input
          className="search-input"
          placeholder="Search your collection…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="panel">
          <div className="empty-note">No cards match this filter.</div>
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((copy) => {
            const { amount, isPriced } = currentValue(copy);
            return (
              <div className="ccard" key={copy.id}>
                <div className="ccard-photo">
                  <CardThumb src={copy.frontImagePath} alt={cardTitle(copy.card)} emoji={cardEmoji(copy.card)} />
                  <span className="ccard-grade">{copy.grade}</span>
                </div>
                <div className="ccard-body">
                  <div className="ccard-title">{cardTitle(copy.card)}</div>
                  <div className="ccard-sub">{cardSubtitle(copy.card)}</div>
                  <div className="ccard-foot">
                    <div>
                      <div className="ccard-value-lbl">{isPriced ? 'Value' : 'At cost'}</div>
                      <div className="ccard-value num">{formatMoney(amount)}</div>
                    </div>
                    {statusChip(copy)}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    <RefreshValueButton copyOwnedId={copy.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ marginTop: 18, fontSize: 12, color: 'var(--text-faint)' }}>
        Don&rsquo;t see a card?{' '}
        <Link href="/add" style={{ color: 'var(--accent)', fontWeight: 700 }}>
          Add one from a photo
        </Link>
        .
      </p>
    </>
  );
}
