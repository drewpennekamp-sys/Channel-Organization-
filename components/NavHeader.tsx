import Link from 'next/link';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/prospects', label: 'Prospects' },
  { href: '/clients', label: 'Clients' },
];

export function NavHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm font-semibold text-ink">
            AI Agency OS
          </Link>
          <nav className="flex gap-4">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-slate-600 hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="text-sm text-slate-500 hover:text-ink">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
