import { describe, expect, it } from 'vitest';
import { nextStage, onDone, type Journey } from './journey.js';

const hospital: Journey = {
  steps: ['records', 'triage', 'consultation', 'pharmacy'],
  sideStages: { lab: { returnTo: 'consultation' } },
};

describe('nextStage', () => {
  it('follows the main path', () => {
    expect(nextStage(hospital, 'records')).toBe('triage');
    expect(nextStage(hospital, 'triage')).toBe('consultation');
    expect(nextStage(hospital, 'consultation')).toBe('pharmacy');
  });

  it('ends the visit after the last step', () => {
    expect(nextStage(hospital, 'pharmacy')).toBeNull();
  });

  it('returns from a side stage to its named step', () => {
    expect(nextStage(hospital, 'lab')).toBe('consultation');
  });

  it('ends the visit for a service outside the journey', () => {
    expect(nextStage(hospital, 'billing')).toBeNull();
  });
});

describe('onDone', () => {
  const base = { priorityLevel: 0, finishedAt: 5_000 };
  const at = (serviceId: string) => ({ serviceId, defaultNext: nextStage(hospital, serviceId) });

  it('moves the patient to the next stage, at the back by finish time (FR-8)', () => {
    expect(onDone({ ...base, ...at('triage'), choice: { kind: 'next' } })).toEqual({
      action: 'enqueue',
      serviceId: 'consultation',
      sortTime: 5_000,
      priorityLevel: 0,
    });
  });

  it('keeps the priority level across stages', () => {
    const out = onDone({
      ...base,
      priorityLevel: 2,
      ...at('records'),
      choice: { kind: 'next' },
    });
    expect(out).toMatchObject({ action: 'enqueue', priorityLevel: 2 });
  });

  it('lets staff pick a different stage, such as Lab', () => {
    expect(
      onDone({ ...base, ...at('consultation'), choice: { kind: 'stage', serviceId: 'lab' } }),
    ).toMatchObject({ action: 'enqueue', serviceId: 'lab' });
  });

  it('lets staff end the visit early', () => {
    expect(onDone({ ...base, ...at('triage'), choice: { kind: 'end' } })).toEqual({
      action: 'end',
    });
  });

  it('ends the visit after pharmacy', () => {
    expect(onDone({ ...base, ...at('pharmacy'), choice: { kind: 'next' } })).toEqual({
      action: 'end',
    });
  });

  it('refuses to move a patient into the stage they are already in', () => {
    expect(() =>
      onDone({ ...base, ...at('lab'), choice: { kind: 'stage', serviceId: 'lab' } }),
    ).toThrow(/already in/);
  });
});
