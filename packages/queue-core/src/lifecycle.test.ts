import { describe, expect, it } from 'vitest';
import { canTransition, formatTicketNumber, isFinal } from './lifecycle.js';

describe('ticket lifecycle', () => {
  it('follows the normal path', () => {
    expect(canTransition('waiting', 'called')).toBe(true);
    expect(canTransition('called', 'serving')).toBe(true);
    expect(canTransition('serving', 'served')).toBe(true);
    expect(canTransition('serving', 'moved_on')).toBe(true);
  });

  it('allows recall and no-show only after a call', () => {
    expect(canTransition('called', 'called')).toBe(true);
    expect(canTransition('called', 'no_show')).toBe(true);
    expect(canTransition('waiting', 'no_show')).toBe(false);
  });

  it('never reopens an ended ticket', () => {
    for (const s of ['served', 'no_show', 'cancelled', 'moved_on'] as const) {
      expect(isFinal(s)).toBe(true);
      expect(canTransition(s, 'waiting')).toBe(false);
    }
  });

  it('does not skip the call', () => {
    expect(canTransition('waiting', 'serving')).toBe(false);
  });
});

describe('formatTicketNumber (FR-4)', () => {
  it('pads to three digits', () => {
    expect(formatTicketNumber('A', 23)).toBe('A-023');
    expect(formatTicketNumber('PH', 1)).toBe('PH-001');
  });

  it('allows four digits past 999', () => {
    expect(formatTicketNumber('A', 1000)).toBe('A-1000');
  });

  it('rejects a bad sequence', () => {
    expect(() => formatTicketNumber('A', 0)).toThrow();
    expect(() => formatTicketNumber('A', 1.5)).toThrow();
  });
});
