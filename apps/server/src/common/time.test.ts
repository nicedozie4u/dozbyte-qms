import { describe, expect, it } from 'vitest';
import { siteDay } from './time.js';

describe('siteDay', () => {
  it('uses Lagos time, an hour ahead of UTC', () => {
    // 23:30 UTC on 1 Dec is 00:30 on 2 Dec in Lagos
    expect(siteDay(new Date('2026-12-01T23:30:00Z'), 'Africa/Lagos').toISOString()).toBe(
      '2026-12-02T00:00:00.000Z',
    );
    expect(siteDay(new Date('2026-12-01T22:30:00Z'), 'Africa/Lagos').toISOString()).toBe(
      '2026-12-01T00:00:00.000Z',
    );
  });
});
