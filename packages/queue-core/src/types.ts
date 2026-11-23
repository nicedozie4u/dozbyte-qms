/** Minimal view of a waiting ticket that the queue rules need. Times are epoch milliseconds. */
export interface WaitingTicket {
  id: string;
  serviceId: string;
  /** 0 = normal; higher is served first (FR-6). */
  priorityLevel: number;
  /**
   * Issue time for a walk-in, slot time for a checked-in appointment (FR-31),
   * or the time the previous stage ended for a patient moved on (FR-8).
   */
  sortTime: number;
  /** Ticket number such as A-023, used only to break exact ties so the order is stable. */
  number: string;
}

/**
 * Fairness rule set by the admin: serve at least one normal ticket after every
 * `normalAfterPriority` priority tickets in a row. null turns the rule off.
 */
export interface PriorityRule {
  normalAfterPriority: number | null;
}
