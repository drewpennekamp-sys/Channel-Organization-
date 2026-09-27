import { NextResponse, type NextRequest } from 'next/server';
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = form.get('password');
  const from = typeof form.get('from') === 'string' ? (form.get('from') as string) : '/';

  if (password !== process.env.AUTH_PASSWORD) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', '1');
    if (from) loginUrl.searchParams.set('from', from);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const token = await createSessionToken();
  const response = NextResponse.redirect(new URL(from || '/', request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return response;
}
