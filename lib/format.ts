export function formatMoney(value: number | null): string {
  return value === null ? '—' : `$${value.toFixed(2)}`;
}

/**
 * "Show retrievedAt age on every value. Stale data must look stale." —
 * relative-time label for a Valuation's computedAt (or a Sale's
 * retrievedAt), so freshness is visible at a glance rather than requiring
 * the viewer to parse a timestamp.
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffSec = Math.round((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.round(diffDay / 30);
  return `${diffMonth}mo ago`;
}
