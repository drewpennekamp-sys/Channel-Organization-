import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Card Comp Tracker',
  description: 'Personal sports card collection tracker with comp-based valuations.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Card Comp Tracker',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="container flex h-12 items-center">
            <Link href="/" className="text-sm font-semibold">
              🃏 Card Comp Tracker
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
