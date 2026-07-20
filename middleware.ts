import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';

const PUBLIC_PATHS = new Set(['/login', '/api/auth/login']);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The cron route authenticates itself with CRON_SECRET (checked inside the
  // route handler) rather than the user session cookie — Vercel Cron isn't a
  // logged-in browser, so it can't carry one.
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isAuthenticated = await verifySessionToken(token);

  if (isAuthenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
