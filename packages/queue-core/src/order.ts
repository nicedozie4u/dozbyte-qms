import type { PriorityRule, WaitingTicket } from './types.js';

/** Queue order: highest priority first, then earliest sort time, then ticket number. */
export function compareTickets(a: WaitingTicket, b: WaitingTicket): number {
  return (
    b.priorityLevel - a.priorityLevel ||
    a.sortTime - b.sortTime ||
    a.number.localeCompare(b.number, 'en', { numeric: true })
  );
}

export interface PickInput {
  waiting: readonly WaitingTicket[];
  /** Services the calling counter handles (FR-7, FR-13). */
  serviceIds: readonly string[];
  /** Priority tickets called in a row so far, from `nextPriorityStreak`. */
  priorityStreak: number;
  rule: PriorityRule;
}

/**
 * Who is next for a counter (design doc: "How the queue engine decides who is next").
 * Returns null when nobody is waiting for the counter's services.
 */
export function pickNext({
  waiting,
  serviceIds,
  priorityStreak,
  rule,
}: PickInput): WaitingTicket | null {
  const services = new Set(serviceIds);
  const eligible = waiting.filter((t) => services.has(t.serviceId)).sort(compareTickets);
  const first = eligible[0];
  if (!first) return null;

  const limit = rule.normalAfterPriority;
  if (limit !== null && limit > 0 && first.priorityLevel > 0 && priorityStreak >= limit) {
    const firstNormal = eligible.find((t) => t.priorityLevel === 0);
    if (firstNormal) return firstNormal;
  }
  return first;
}

/** Updates the priority streak after a call: grows on a priority ticket, resets on a normal one. */
export function nextPriorityStreak(streak: number, called: WaitingTicket): number {
  return called.priorityLevel > 0 ? streak + 1 : 0;
}

/** Sorted queue for one service, as the staff console and TV list it. */
export function queueFor(waiting: readonly WaitingTicket[], serviceId: string): WaitingTicket[] {
  return waiting.filter((t) => t.serviceId === serviceId).sort(compareTickets);
}

/** People ahead of a ticket in its own service's queue (FR-5). Returns null if it is not waiting. */
export function peopleAhead(waiting: readonly WaitingTicket[], ticketId: string): number | null {
  const ticket = waiting.find((t) => t.id === ticketId);
  if (!ticket) return null;
  const index = queueFor(waiting, ticket.serviceId).findIndex((t) => t.id === ticketId);
  return index;
}
