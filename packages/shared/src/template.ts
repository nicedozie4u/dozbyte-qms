import { z } from 'zod';

const Slug = z.string().regex(/^[a-z][a-z0-9-]*$/, 'lowercase letters, digits and dashes');

/** An extra field a business adds to the ticket form, for example a hospital card number (FR-24). */
export const ExtraField = z.object({
  key: Slug,
  label: z.string().min(1),
  type: z.enum(['text', 'number']),
  required: z.boolean().default(false),
  /** Personal data is erased after the retention period (NFR-7). */
  personal: z.boolean().default(true),
});

export const TemplateService = z.object({
  key: Slug,
  name: z.string().min(1),
  /** Ticket prefix, for example A (FR-4). */
  prefix: z.string().regex(/^[A-Z]{1,3}$/),
  /** Whether customers can pick this service at the kiosk to start a visit. */
  kioskStart: z.boolean().default(false),
  appointments: z.boolean().default(false),
  extraFields: z.array(ExtraField).default([]),
});

/**
 * The order of stages a visit goes through (FR-8, FR-23).
 * `steps` is the main path; a side stage (like Lab) returns to a named step when done.
 */
export const TemplateJourney = z.object({
  steps: z.array(Slug).min(1),
  sideStages: z.record(Slug, z.object({ returnTo: Slug })).default({}),
});

export const PriorityReason = z.object({
  key: Slug,
  label: z.string().min(1),
  level: z.number().int().min(1).max(9),
});

export const BusinessTemplate = z
  .object({
    key: Slug,
    name: z.string().min(1),
    /** Words shown on screens, for example customer -> "patient" (FR-24). */
    wording: z.object({
      customer: z.string().min(1),
      customers: z.string().min(1),
      counter: z.string().min(1),
    }),
    services: z.array(TemplateService).min(1),
    journey: TemplateJourney,
    priorityReasons: z.array(PriorityReason).default([]),
  })
  .superRefine((t, ctx) => {
    const keys = new Set(t.services.map((s) => s.key));
    const prefixes = new Set<string>();
    for (const s of t.services) {
      if (prefixes.has(s.prefix)) {
        ctx.addIssue({ code: 'custom', message: `duplicate ticket prefix ${s.prefix}` });
      }
      prefixes.add(s.prefix);
    }
    const check = (key: string, where: string) => {
      if (!keys.has(key)) {
        ctx.addIssue({ code: 'custom', message: `${where} names unknown service "${key}"` });
      }
    };
    t.journey.steps.forEach((k) => check(k, 'journey.steps'));
    for (const [side, { returnTo }] of Object.entries(t.journey.sideStages)) {
      check(side, 'journey.sideStages');
      check(returnTo, `journey.sideStages.${side}.returnTo`);
    }
  });
export type BusinessTemplate = z.infer<typeof BusinessTemplate>;
