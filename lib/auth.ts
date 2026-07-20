import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'sf_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getAuthSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      'AUTH_SECRET is not set. Add it to your environment (see README) — any long random string works.'
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ app: 'shorts-factory' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getAuthSecretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getAuthSecretKey());
    return true;
  } catch {
    return false;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
};
