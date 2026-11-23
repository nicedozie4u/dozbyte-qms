import { describe, expect, it } from 'vitest';
import { compareTickets, nextPriorityStreak, peopleAhead, pickNext, queueFor } from './order.js';
import type { WaitingTicket } from './types.js';

const t = (
  id: string,
  serviceId: string,
  sortTime: number,
  priorityLevel = 0,
  number = id,
): WaitingTicket => ({ id, serviceId, sortTime, priorityLevel, number });

const off = { normalAfterPriority: null };

describe('pickNext', () => {
  it('returns null when nobody waits for the counter services', () => {
    expect(pickNext({ waiting: [], serviceIds: ['a'], priorityStreak: 0, rule: off })).toBeNull();
    expect(
      pickNext({ waiting: [t('1', 'b', 1)], serviceIds: ['a'], priorityStreak: 0, rule: off }),
    ).toBeNull();
  });

  it('serves first come, first served within a service', () => {
    const waiting = [t('late', 'a', 300), t('early', 'a', 100), t('mid', 'a', 200)];
    expect(pickNext({ waiting, serviceIds: ['a'], priorityStreak: 0, rule: off })?.id).toBe(
      'early',
    );
  });

  it('serves a priority ticket ahead of earlier normal tickets (FR-6)', () => {
    const waiting = [t('normal', 'a', 100), t('elderly', 'a', 500, 1)];
    expect(pickNext({ waiting, serviceIds: ['a'], priorityStreak: 0, rule: off })?.id).toBe(
      'elderly',
    );
  });

  it('serves a higher priority level first', () => {
    const waiting = [t('elderly', 'a', 100, 1), t('emergency', 'a', 500, 3)];
    expect(pickNext({ waiting, serviceIds: ['a'], priorityStreak: 0, rule: off })?.id).toBe(
      'emergency',
    );
  });

  it('looks across every service the counter handles (FR-13)', () => {
    const waiting = [t('a1', 'a', 200), t('b1', 'b', 100), t('c1', 'c', 50)];
    expect(pickNext({ waiting, serviceIds: ['a', 'b'], priorityStreak: 0, rule: off })?.id).toBe(
      'b1',
    );
  });

  it('puts a checked-in appointment ahead of walk-ins who came after its slot (FR-31)', () => {
    const slot = 1_000;
    const waiting = [
      t('walk-in-before', 'a', 900),
      t('walk-in-after', 'a', 1_100),
      t('appt', 'a', slot),
    ];
    const order = queueFor(waiting, 'a').map((x) => x.id);
    expect(order).toEqual(['walk-in-before', 'appt', 'walk-in-after']);
  });

  it('breaks exact ties by ticket number, numerically', () => {
    const waiting = [t('x', 'a', 100, 0, 'A-010'), t('y', 'a', 100, 0, 'A-009')];
    expect(pickNext({ waiting, serviceIds: ['a'], priorityStreak: 0, rule: off })?.id).toBe('y');
  });

  describe('fairness rule: one normal after every N priority', () => {
    const rule = { normalAfterPriority: 3 };
    const waiting = [t('p1', 'a', 300, 1), t('n1', 'a', 100), t('p2', 'a', 400, 1)];

    it('keeps serving priority below the limit', () => {
      expect(pickNext({ waiting, serviceIds: ['a'], priorityStreak: 2, rule })?.id).toBe('p1');
    });

    it('serves the earliest normal ticket once the limit is reached', () => {
      expect(pickNext({ waiting, serviceIds: ['a'], priorityStreak: 3, rule })?.id).toBe('n1');
    });

    it('still serves priority at the limit when no normal ticket waits', () => {
      const onlyPriority = waiting.filter((x) => x.priorityLevel > 0);
      expect(
        pickNext({ waiting: onlyPriority, serviceIds: ['a'], priorityStreak: 5, rule })?.id,
      ).toBe('p1');
    });

    it('runs a full day pattern: P P P N P', () => {
      const queue = [
        t('p1', 'a', 10, 1),
        t('p2', 'a', 20, 1),
        t('p3', 'a', 30, 1),
        t('p4', 'a', 40, 1),
        t('n1', 'a', 1),
      ];
      const called: string[] = [];
      let streak = 0;
      let remaining = [...queue];
      for (;;) {
        const next = pickNext({
          waiting: remaining,
          serviceIds: ['a'],
          priorityStreak: streak,
          rule,
        });
        if (!next) break;
        called.push(next.id);
        streak = nextPriorityStreak(streak, next);
        remaining = remaining.filter((x) => x.id !== next.id);
      }
      expect(called).toEqual(['p1', 'p2', 'p3', 'n1', 'p4']);
    });
  });
});

describe('nextPriorityStreak', () => {
  it('grows on priority and resets on normal', () => {
    expect(nextPriorityStreak(2, t('p', 'a', 1, 1))).toBe(3);
    expect(nextPriorityStreak(2, t('n', 'a', 1))).toBe(0);
  });
});

describe('peopleAhead', () => {
  const waiting = [t('a1', 'a', 100), t('a2', 'a', 200), t('b1', 'b', 50), t('a3', 'a', 300)];

  it('counts only tickets ahead in the same service', () => {
    expect(peopleAhead(waiting, 'a1')).toBe(0);
    expect(peopleAhead(waiting, 'a3')).toBe(2);
    expect(peopleAhead(waiting, 'b1')).toBe(0);
  });

  it('counts a later priority ticket as ahead', () => {
    expect(peopleAhead([...waiting, t('ap', 'a', 999, 1)], 'a1')).toBe(1);
  });

  it('returns null for a ticket that is not waiting', () => {
    expect(peopleAhead(waiting, 'missing')).toBeNull();
  });
});

describe('compareTickets', () => {
  it('is a stable total order for sorting', () => {
    const a = t('a', 's', 1, 0, 'A-001');
    expect(compareTickets(a, a)).toBe(0);
  });
});
