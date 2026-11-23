/**
 * Socket.IO event names, in the form area.thing.action (see CONTRIBUTING.md).
 * Screens and the server import these constants so a rename is caught by the type checker.
 */
export const SocketEvents = {
  ticketIssued: 'queue.ticket.issued',
  ticketCalled: 'queue.ticket.called',
  ticketRecalled: 'queue.ticket.recalled',
  ticketServing: 'queue.ticket.serving',
  ticketEnded: 'queue.ticket.ended',
  ticketMovedOn: 'queue.ticket.moved-on',
  counterStatusChanged: 'setup.counter.status-changed',
  waitEstimateUpdated: 'queue.wait.updated',
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

/** Socket.IO room names: one per branch, counter and ticket. */
export const Rooms = {
  branch: (branchId: string) => `branch:${branchId}`,
  counter: (counterId: string) => `counter:${counterId}`,
  ticket: (ticketId: string) => `ticket:${ticketId}`,
} as const;
