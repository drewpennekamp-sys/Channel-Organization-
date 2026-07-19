import { cn } from '@/lib/cn';
import type { Owner } from '@/lib/types';

export function OwnerBadge({ owner, className }: { owner: Owner; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300',
        className
      )}
    >
      {owner === 'you' ? 'You' : 'Friend'}
    </span>
  );
}
