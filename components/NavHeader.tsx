'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useOwnerFilter } from './OwnerFilterProvider';
import { SegmentedControl } from './SegmentedControl';
import type { OwnerView } from '@/lib/types';

const LINKS = [
  { href: '/today', label: 'Today' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/video-log', label: 'Video Log' },
  { href: '/insights', label: 'Insights' },
  { href: '/channels', label: 'Channels' },
  { href: '/settings', label: 'Settings' },
];

export function NavHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { view, setView } = useOwnerFilter();
  const [loggingOut, setLoggingOut] = useState(false);

  if (pathname === '/login') return null;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3.5 sm:px-8 lg:px-10">
        <span className="font-heading text-sm font-semibold tracking-tight text-zinc-100">
          Shorts Factory
        </span>
        <nav className="flex flex-wrap items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-light text-zinc-500">Viewing</span>
          <SegmentedControl<OwnerView>
            name="Viewing"
            value={view}
            onChange={setView}
            options={[
              { value: 'you', label: 'You' },
              { value: 'friend', label: 'Friend' },
              { value: 'all', label: 'All' },
            ]}
          />
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Log out"
            title="Log out"
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
