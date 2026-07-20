import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Hashing both sides to a fixed-length digest before comparing keeps this
// timing-safe even though the submitted password and the real one are
// rarely the same length (timingSafeEqual requires equal-length buffers).
function safeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export async function POST(request: Request) {
  const authPassword = process.env.AUTH_PASSWORD;
  if (!authPassword) {
    return NextResponse.json(
      { error: 'AUTH_PASSWORD is not configured on the server.' },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!password || !safeCompare(password, authPassword)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  let token: string;
  try {
    token = await createSessionToken();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create a session.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return res;
}
