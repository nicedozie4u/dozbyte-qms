import { describe, expect, it } from 'vitest';
import { averageServiceTime, estimateWaitMinutes, SERVICE_TIME_WINDOW } from './wait.js';

const min = 60_000;

describe('averageServiceTime', () => {
  it('uses the fallback with no history', () => {
    expect(averageServiceTime([], 5 * min)).toBe(5 * min);
  });

  it('averages only the most recent 20', () => {
    const recent = Array.from({ length: SERVICE_TIME_WINDOW }, () => 2 * min);
    const old = Array.from({ length: 50 }, () => 30 * min);
    expect(averageServiceTime([...recent, ...old], 5 * min)).toBe(2 * min);
  });

  it('ignores zero, negative and broken durations', () => {
    expect(averageServiceTime([0, -1, Number.NaN, 4 * min], 5 * min)).toBe(4 * min);
  });
});

describe('estimateWaitMinutes (FR-12)', () => {
  it('divides people ahead across open counters', () => {
    expect(
      estimateWaitMinutes({ peopleAhead: 8, countersOpen: 2, averageServiceMs: 5 * min }),
    ).toBe(20);
  });

  it('rounds up to whole minutes', () => {
    expect(estimateWaitMinutes({ peopleAhead: 1, countersOpen: 1, averageServiceMs: 90_000 })).toBe(
      2,
    );
  });

  it('is zero with nobody ahead', () => {
    expect(estimateWaitMinutes({ peopleAhead: 0, countersOpen: 1, averageServiceMs: min })).toBe(0);
  });

  it('is unknown when no counter is open', () => {
    expect(
      estimateWaitMinutes({ peopleAhead: 3, countersOpen: 0, averageServiceMs: min }),
    ).toBeNull();
  });
});
