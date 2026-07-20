'use client';

import { useState } from 'react';
import { Check, ChevronDown, Copy } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/cn';

export function CollapsibleSection({ title, content }: { title: string; content: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    const ok = await copyToClipboard(content);
    setCopyState(ok ? 'copied' : 'failed');
    setTimeout(() => setCopyState('idle'), 1500);
  }

  return (
    <div className="rounded-lg border border-zinc-800">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-zinc-300 hover:text-zinc-100"
      >
        <span>{title}</span>
        <ChevronDown
          size={15}
          className={cn('shrink-0 text-zinc-500 transition-transform duration-200', expanded && 'rotate-180')}
        />
      </button>

      <div className={cn('reveal', expanded && 'reveal-open')}>
        <div>
          <div className="border-t border-zinc-800 bg-zinc-950/50 p-3">
            <div className="mb-2 flex items-center justify-end gap-2">
              {copyState === 'failed' && (
                <span className="text-xs text-zinc-500">Copy blocked — select the text below</span>
              )}
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                {copyState === 'copied' ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="scrollbar-thin overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-zinc-300">
              {content}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
