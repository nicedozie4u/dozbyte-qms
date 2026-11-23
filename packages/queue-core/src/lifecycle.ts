import type { TicketStatus } from '@dozbyte/shared';

/** Allowed ticket state changes (requirements: ticket lifecycle; design: user flow 4). */
const transitions: Record<TicketStatus, readonly TicketStatus[]> = {
  waiting: ['called', 'cancelled'],
  // Recall keeps the ticket in `called`; Start moves it to `serving`.
  called: ['called', 'serving', 'no_show', 'cancelled'],
  serving: ['served', 'moved_on'],
  served: [],
  no_show: [],
  cancelled: [],
  moved_on: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return transitions[from].includes(to);
}

export function isFinal(status: TicketStatus): boolean {
  return transitions[status].length === 0;
}

/** Formats a ticket number with its service prefix, for example A-023 (FR-4). */
export function formatTicketNumber(prefix: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`ticket sequence must be a positive whole number, got ${sequence}`);
  }
  return `${prefix}-${String(sequence).padStart(3, '0')}`;
}
