import { z } from 'zod';

export const UpdateBranchBody = z.object({
  /** Serve one normal ticket after this many priority tickets in a row; null turns the rule off. */
  normalAfterPriority: z.number().int().min(1).max(20).nullable(),
});
export type UpdateBranchBody = z.infer<typeof UpdateBranchBody>;

export const UpdateServiceBody = z.object({
  /** Most tickets that can reach this service in one day (FR-14); null means no limit. */
  dailyTicketLimit: z.number().int().min(1).max(10_000).nullable(),
});
export type UpdateServiceBody = z.infer<typeof UpdateServiceBody>;
