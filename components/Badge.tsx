import { STATUS_COLORS, type ProspectStatus } from '@/lib/status';

export function StatusBadge({ status }: { status: ProspectStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {status}
    </span>
  );
}
