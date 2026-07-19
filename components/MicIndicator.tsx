import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/cn';

export function MicIndicator({ on, className }: { on: boolean; className?: string }) {
  return (
    <span
      title={on ? 'Needs voiceover' : 'No voiceover'}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-full',
        on ? 'bg-zinc-800 text-zinc-100' : 'bg-zinc-800/40 text-zinc-600',
        className
      )}
    >
      {on ? <Mic size={13} fill="currentColor" strokeWidth={1.5} /> : <MicOff size={13} strokeWidth={1.5} />}
    </span>
  );
}
