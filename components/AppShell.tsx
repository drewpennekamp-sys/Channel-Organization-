'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
        <rect x="1.5" y="1.5" width="6" height="6" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9.5" y="1.5" width="6" height="9" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
        <rect x="1.5" y="9.5" width="6" height="6" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9.5" y="12.5" width="6" height="3" rx="1.1" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    href: '/collection',
    label: 'Collection',
    icon: (
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
        <rect x="1.5" y="5" width="10" height="11" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M4.5 5V3.2C4.5 2.3 5.2 1.6 6.1 1.6H12.4C13.3 1.6 14 2.3 14 3.2V11.7C14 12.6 13.3 13.3 12.4 13.3H11.5"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    ),
  },
  {
    href: '/value',
    label: 'Value',
    icon: (
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
        <path
          d="M1.8 14.5L6 8.6L9.2 11.2L15.2 3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M11 3H15.2V7.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/comps',
    label: 'Comps',
    icon: (
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
        <circle cx="7.3" cy="7.3" r="5.3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11.3 11.3L15.3 15.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">
          <svg className="brand-mark" width="26" height="26" viewBox="0 0 26 26" fill="none">
            <rect x="3" y="2" width="16" height="22" rx="3" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 8.5H15" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="9" cy="14.5" r="2.6" stroke="currentColor" strokeWidth="1.4" />
            <path d="M21 6L23.4 3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>
            <span className="brand-word">Card Vault</span>
            <span className="brand-sub">Comp Tracker</span>
          </span>
        </div>
        <div className="navlist">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`navitem${pathname === item.href ? ' active' : ''}`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>
        <div className="nav-foot">
          <div className="nav-foot-label">Beta · you &amp; 1 other</div>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
