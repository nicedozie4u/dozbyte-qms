import type { TicketSource, TicketStatus } from './ticket.js';

/** A ticket as the API returns it to screens. Times are ISO strings in UTC. */
export interface TicketView {
  id: string;
  visitId: string;
  number: string;
  serviceId: string;
  serviceName: string;
  status: TicketStatus;
  priorityLevel: number;
  priorityReason: string | null;
  source: TicketSource;
  sortTime: string;
  counterId: string | null;
  counterName: string | null;
  issuedAt: string;
  calledAt: string | null;
  servingAt: string | null;
  extraFields: unknown;
  visitReason: string | null;
}

export type UserRoleName = 'platform_support' | 'business_admin' | 'branch_manager' | 'staff';

export interface SessionUserView {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  name: string;
  email: string;
  role: UserRoleName;
  mustSetPassword: boolean;
}

export interface ExtraFieldView {
  key: string;
  label: string;
  type: 'text' | 'number';
  required: boolean;
}

export interface BranchSetupView {
  branch: { id: string; name: string };
  business: { name: string; type: string };
  wording: { customer: string; customers: string; counter: string };
  priorityReasons: { key: string; label: string; level: number }[];
  services: {
    id: string;
    key: string;
    name: string;
    prefix: string;
    kioskStart: boolean;
    nextServiceId: string | null;
    extraFields: ExtraFieldView[];
  }[];
  counters: {
    id: string;
    name: string;
    status: 'open' | 'paused' | 'closed';
    signedInUserId: string | null;
    serviceIds: string[];
  }[];
}

export interface CounterStateView {
  counter: {
    id: string;
    name: string;
    status: 'open' | 'paused' | 'closed';
    signedInUserId: string | null;
    signedInByMe: boolean;
    serviceIds: string[];
  };
  current: TicketView | null;
  waiting: TicketView[];
}

export interface IssuedTicketView {
  ticket: TicketView;
  peopleAhead: number | null;
  waitMinutes: number | null;
}

export interface BranchQueueView {
  services: {
    id: string;
    name: string;
    waiting: number;
    countersOpen: number;
    nextWaitMinutes: number | null;
  }[];
}
