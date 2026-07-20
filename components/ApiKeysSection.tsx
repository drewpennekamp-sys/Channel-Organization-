import { KeyRound } from 'lucide-react';
import type { KeyStatus } from '@/lib/types';
import { cn } from '@/lib/cn';

function KeyRow({
  label,
  envVar,
  status,
}: {
  label: string;
  envVar: string;
  status: KeyStatus;
}) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        <p className="mt-0.5 font-mono text-xs font-light text-zinc-500">{envVar}</p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium tabular-nums',
            status.present ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-800 text-zinc-500'
          )}
        >
          {status.present ? status.masked : 'Not set'}
        </span>
      </div>
    </div>
  );
}

export function ApiKeysSection({
  keys,
}: {
  keys: { anthropic: KeyStatus; vidiq: KeyStatus };
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center gap-2">
        <KeyRound size={15} className="text-zinc-400" />
        <h2 className="font-heading text-sm font-semibold tracking-tight text-zinc-200">
          API keys
        </h2>
      </div>
      <p className="mt-1 text-xs font-light leading-relaxed text-zinc-500">
        Read from environment variables — never stored or echoed by the app itself. To add or
        change one, edit <code className="font-mono text-zinc-400">.env.local</code> in the
        project root and restart the server.
      </p>

      <div className="mt-3 divide-y divide-zinc-800 border-t border-zinc-800">
        <KeyRow label="Anthropic API key" envVar="ANTHROPIC_API_KEY" status={keys.anthropic} />
        <KeyRow label="vidIQ credentials" envVar="VIDIQ_API_KEY" status={keys.vidiq} />
      </div>

      {(!keys.anthropic.present || !keys.vidiq.present) && (
        <div className="mt-4 rounded-lg bg-zinc-800/50 px-3 py-2.5 text-xs font-light leading-relaxed text-zinc-400">
          <p className="font-medium text-zinc-300">How to set these:</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            <li>
              Create (or open) <code className="font-mono">.env.local</code> in the project root.
            </li>
            <li>
              Add a line like <code className="font-mono">ANTHROPIC_API_KEY=sk-ant-...</code>.
            </li>
            <li>Restart the dev server so it picks up the new value.</li>
          </ol>
        </div>
      )}
    </section>
  );
}
