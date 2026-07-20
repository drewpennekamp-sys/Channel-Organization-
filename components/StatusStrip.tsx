import type { DashboardEntryDTO } from '@/lib/types';
import { getDashboardState } from '@/lib/dashboard';
import { cn } from '@/lib/cn';

export function StatusStrip({ entries }: { entries: DashboardEntryDTO[] }) {
  const postedCount = entries.filter((e) => getDashboardState(e.plan) === 'posted').length;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        {entries.map(({ channel, plan }) => {
          const state = getDashboardState(plan);
          const label =
            state === 'no-idea' ? 'no idea yet' : state === 'idea' ? 'planned' : 'posted';
          return (
            <span
              key={channel.id}
              title={`${channel.name}: ${label}`}
              className={cn(
                'h-2.5 w-2.5 rounded-full border-2 transition-colors',
                state === 'no-idea' && 'bg-transparent',
                state === 'idea' && 'border-amber-400 bg-amber-400',
                state === 'posted' && 'border-emerald-500 bg-emerald-500'
              )}
              style={state === 'no-idea' ? { borderColor: channel.accentColor } : undefined}
            />
          );
        })}
      </div>
      <span className="text-xs font-light text-zinc-500">
        {postedCount} of {entries.length} posted today
      </span>
    </div>
  );
}
