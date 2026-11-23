import { describe, expect, it } from 'vitest';
import { LoginLimiter } from './login-limiter.js';

const opts = { windowMs: 60_000, maxPerAccount: 3, maxPerAddress: 5 };

describe('LoginLimiter', () => {
  it('allows attempts below the limit', () => {
    const l = new LoginLimiter(opts, () => 0);
    l.recordFailure('a@x', '1.1.1.1');
    l.recordFailure('a@x', '1.1.1.1');
    expect(l.retryAfterMs('a@x', '1.1.1.1')).toBe(0);
  });

  it('blocks an account after too many failures, until the window passes', () => {
    let t = 0;
    const l = new LoginLimiter(opts, () => t);
    for (let i = 0; i < 3; i++) {
      t = i * 1000;
      l.recordFailure('a@x', '1.1.1.1');
    }
    expect(l.retryAfterMs('A@X', '1.1.1.1')).toBe(60_000 - 2000);
    t = 60_001;
    expect(l.retryAfterMs('a@x', '1.1.1.1')).toBe(0);
  });

  it('blocks an address guessing many accounts', () => {
    const l = new LoginLimiter(opts, () => 0);
    for (let i = 0; i < 5; i++) l.recordFailure(`u${i}@x`, '2.2.2.2');
    expect(l.retryAfterMs('fresh@x', '2.2.2.2')).toBeGreaterThan(0);
    expect(l.retryAfterMs('fresh@x', '3.3.3.3')).toBe(0);
  });

  it('clears an account on success', () => {
    const l = new LoginLimiter(opts, () => 0);
    for (let i = 0; i < 3; i++) l.recordFailure('a@x', '1.1.1.1');
    l.recordSuccess('a@x', '1.1.1.1');
    expect(l.retryAfterMs('a@x', '1.1.1.1')).toBe(0);
  });
});
