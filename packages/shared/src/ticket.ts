import { z } from 'zod';

/**
 * The states a ticket moves through (requirements: ticket lifecycle).
 * Each stage of a visit is its own ticket row, linked by a visit ID and keeping the same number.
 */
export const TicketStatus = z.enum([
  'waiting',
  'called',
  'serving',
  'served',
  'no_show',
  'cancelled',
  'moved_on',
]);
export type TicketStatus = z.infer<typeof TicketStatus>;

/** Where a ticket came from. */
export const TicketSource = z.enum(['kiosk', 'staff', 'appointment']);
export type TicketSource = z.infer<typeof TicketSource>;

/**
 * Priority level: 0 is a normal ticket; higher numbers are served first (FR-6).
 * Reasons are business wording, so they live on the ticket, not in this enum.
 */
export const PriorityLevel = z.number().int().min(0).max(9);

/** A ticket number with a service prefix, for example A-023 (FR-4). */
export const TicketNumber = z.string().regex(/^[A-Z]{1,3}-\d{3,4}$/);
