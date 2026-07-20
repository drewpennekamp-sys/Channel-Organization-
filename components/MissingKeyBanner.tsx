import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';

export function MissingKeyBanner({ keyLabel, reason }: { keyLabel: string; reason: string }) {
  return (
    <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
      <p className="text-sm leading-relaxed text-amber-200">
        {keyLabel} isn&apos;t set — {reason}.{' '}
        <Link
          href="/settings"
          className="font-medium underline underline-offset-2 hover:text-amber-100"
        >
          Fix it in Settings
        </Link>
      </p>
    </div>
  );
}
