import { createHmac, timingSafeEqual } from 'node:crypto';

/** Session lifetime: one working day plus a margin. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'dz_session';

interface SessionPayload {
  uid: string;
  exp: number;
}

const sign = (data: string, secret: string) =>
  createHmac('sha256', secret).update(data).digest('base64url');

/** A signed, expiring token: base64url(payload).signature. No session table needed. */
export function createSessionToken(userId: string, secret: string, now = Date.now()): string {
  const payload: SessionPayload = { uid: userId, exp: now + SESSION_TTL_MS };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data, secret)}`;
}

/** Returns the user ID, or null when the token is missing, tampered with or expired. */
export function readSessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): string | null {
  if (!token) return null;
  const [data, signature] = token.split('.');
  if (!data || !signature) return null;
  const expected = Buffer.from(sign(data, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(data, 'base64url').toString(),
    ) as Partial<SessionPayload>;
    if (typeof payload.uid !== 'string' || typeof payload.exp !== 'number') return null;
    return payload.exp > now ? payload.uid : null;
  } catch {
    return null;
  }
}

/** Reads one cookie from a raw Cookie header (used by the socket handshake). */
export function cookieFromHeader(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}
