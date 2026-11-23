import { z } from 'zod';

export const IssueTicketBody = z.object({
  serviceId: z.uuid(),
  /** Key of one of the template's priority reasons, e.g. "elderly" (FR-6). */
  priorityReason: z.string().max(40).optional(),
  /** Short visit reason only, no medical details (NFR-7). */
  visitReason: z.string().max(120).optional(),
  /** Answers to the service's extra fields, e.g. hospital card number (FR-24). */
  extraFields: z.record(z.string(), z.union([z.string().max(120), z.number()])).optional(),
});
export type IssueTicketBody = z.infer<typeof IssueTicketBody>;

export const DoneBody = z.object({
  choice: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('next') }),
    z.object({ kind: z.literal('stage'), serviceId: z.uuid() }),
    z.object({ kind: z.literal('end') }),
  ]),
});
export type DoneBody = z.infer<typeof DoneBody>;
