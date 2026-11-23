import { BusinessTemplate } from '@dozbyte/shared';
import { describe, expect, it } from 'vitest';
import { getTemplate, templates } from './index.js';

describe('templates', () => {
  it('every shipped template passes the schema', () => {
    for (const t of Object.values(templates)) {
      expect(BusinessTemplate.safeParse(t).success).toBe(true);
    }
  });

  it('hospital uses patient wording and the four-stage journey (FR-23, FR-24)', () => {
    const h = getTemplate('hospital');
    expect(h.wording.customer).toBe('patient');
    expect(h.journey.steps).toEqual(['records', 'triage', 'consultation', 'pharmacy']);
    expect(h.journey.sideStages['lab']?.returnTo).toBe('consultation');
  });

  it('rejects a journey that names a missing service', () => {
    const broken = {
      ...getTemplate('hospital'),
      journey: { steps: ['records', 'x-ray'], sideStages: {} },
    };
    expect(BusinessTemplate.safeParse(broken).success).toBe(false);
  });

  it('rejects two services with the same prefix', () => {
    const h = getTemplate('hospital');
    const broken = {
      ...h,
      services: h.services.map((s) => ({ ...s, prefix: 'A' })),
    };
    expect(BusinessTemplate.safeParse(broken).success).toBe(false);
  });
});
