import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Card Comp Tracker',
  description: 'Personal sports card collection tracker with comp-based valuations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
