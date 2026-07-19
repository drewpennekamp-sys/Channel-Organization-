import type { Metadata } from 'next';
import { Sora, Inter } from 'next/font/google';
import './globals.css';

const heading = Sora({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-heading',
  display: 'swap',
});

const body = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Shorts Factory — Channels',
  description: 'Manage the channels Shorts Factory produces content for.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable} dark`}>
      <body className="min-h-screen bg-zinc-950 font-body text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
