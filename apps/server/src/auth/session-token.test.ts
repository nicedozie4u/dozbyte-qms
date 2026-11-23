import { describe, expect, it } from 'vitest';
import {
  cookieFromHeader,
  createSessionToken,
  readSessionToken,
  SESSION_TTL_MS,
} from './session-token.js';

const secret = 'x'.repeat(32);

describe('session tokens', () => {
  it('round-trips a user ID', () => {
    expect(readSessionToken(createSessionToken('u1', secret), secret)).toBe('u1');
  });

  it('rejects a token signed with another secret', () => {
    expect(readSessionToken(createSessionToken('u1', 'y'.repeat(32)), secret)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const [, sig] = createSessionToken('u1', secret).split('.');
    const forged = Buffer.from(JSON.stringify({ uid: 'admin', exp: Date.now() + 1e6 })).toString(
      'base64url',
    );
    expect(readSessionToken(`${forged}.${sig}`, secret)).toBeNull();
  });

  it('expires', () => {
    const token = createSessionToken('u1', secret, 0);
    expect(readSessionToken(token, secret, SESSION_TTL_MS + 1)).toBeNull();
  });

  it('rejects junk', () => {
    expect(readSessionToken(undefined, secret)).toBeNull();
    expect(readSessionToken('nonsense', secret)).toBeNull();
  });

  it('reads a cookie from a header', () => {
    expect(cookieFromHeader('a=1; dz_session=abc.def; b=2', 'dz_session')).toBe('abc.def');
    expect(cookieFromHeader('a=1', 'dz_session')).toBeUndefined();
  });
});
