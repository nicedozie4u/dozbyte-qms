import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  averageServiceTime,
  canTransition,
  compareTickets,
  estimateWaitMinutes,
  formatTicketNumber,
  nextPriorityStreak,
  onDone,
  peopleAhead,
  pickNext,
  queueFor,
  type DoneChoice,
  type WaitingTicket,
} from '@dozbyte/queue-core';
import { SocketEvents, type SocketEventName, type TicketView } from '@dozbyte/shared';
import { getTemplate, type TemplateKey } from '@dozbyte/templates';
import { randomUUID } from 'node:crypto';
import type { SessionUser } from '../auth/auth.types.js';
import { siteDay } from '../common/time.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { TicketSource, TicketStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import type { IssueTicketBody } from './queue.schemas.js';

type Tx = Prisma.TransactionClient;

/** Used for wait estimates until a service has served anyone today. */
const DEFAULT_SERVICE_MS = 5 * 60_000;

const ticketInclude = {
  service: { select: { name: true } },
  counter: { select: { name: true } },
} as const;

type TicketRow = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

function view(t: TicketRow): TicketView {
  return {
    id: t.id,
    visitId: t.visitId,
    number: t.number,
    serviceId: t.serviceId,
    serviceName: t.service.name,
    status: t.status,
    priorityLevel: t.priorityLevel,
    priorityReason: t.priorityReason,
    source: t.source,
    sortTime: t.sortTime.toISOString(),
    counterId: t.counterId,
    counterName: t.counter?.name ?? null,
    issuedAt: t.issuedAt.toISOString(),
    calledAt: t.calledAt?.toISOString() ?? null,
    servingAt: t.servingAt?.toISOString() ?? null,
    extraFields: t.extraFields,
    visitReason: t.visitReason,
  };
}

const toWaiting = (
  t:
    | TicketRow
    | { id: string; serviceId: string; priorityLevel: number; sortTime: Date; number: string },
): WaitingTicket => ({
  id: t.id,
  serviceId: t.serviceId,
  priorityLevel: t.priorityLevel,
  sortTime: t.sortTime.getTime(),
  number: t.number,
});

/** Serialises changes that pick or number tickets, per key, until the transaction ends. */
async function lock(tx: Tx, key: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${key}))) AS l`;
}

interface Emit {
  branchId: string;
  event: SocketEventName;
  payload: unknown;
}

@Injectable()
export class QueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ---------- Tickets ----------

  /** Front desk issues a ticket (FR-1, FR-3, FR-4, FR-6). */
  async issue(user: SessionUser, body: IssueTicketBody, source: TicketSource = 'staff') {
    const branchId = this.branchOf(user);
    const service = await this.prisma.service.findFirst({
      where: { id: body.serviceId, branchId, active: true },
      include: { branch: { include: { business: true } } },
    });
    if (!service) throw new NotFoundException('Service not found');

    let priorityLevel = 0;
    let priorityReason: string | null = null;
    if (body.priorityReason) {
      const template = getTemplate(service.branch.business.businessType as TemplateKey);
      const reason = template.priorityReasons.find((r) => r.key === body.priorityReason);
      if (!reason)
        throw new BadRequestException(`Unknown priority reason "${body.priorityReason}"`);
      priorityLevel = reason.level;
      priorityReason = reason.key;
    }

    const now = new Date();
    const day = siteDay(now, this.config.siteTimezone);
    const ticket = await this.prisma.$transaction(async (tx) => {
      await lock(tx, `number:${branchId}:${service.prefix}:${day.toISOString()}`);

      // The limit counts every ticket that reached this service today (FR-14).
      if (service.dailyTicketLimit !== null) {
        const issuedToday = await tx.ticket.count({
          where: { serviceId: service.id, serviceDay: day },
        });
        if (issuedToday >= service.dailyTicketLimit) {
          throw new ConflictException(`${service.name} has reached today's ticket limit`);
        }
      }

      const [row] = await tx.$queryRaw<{ max: number | null }[]>`
        SELECT MAX(split_part(number, '-', 2)::int) AS max FROM tickets
        WHERE branch_id = ${branchId}::uuid AND service_day = ${day}::date
          AND split_part(number, '-', 1) = ${service.prefix}`;
      const number = formatTicketNumber(service.prefix, (row?.max ?? 0) + 1);

      const created = await tx.ticket.create({
        data: {
          tenantId: service.tenantId,
          branchId,
          visitId: randomUUID(),
          serviceId: service.id,
          number,
          serviceDay: day,
          source,
          priorityLevel,
          priorityReason,
          status: 'waiting',
          sortTime: now,
          issuedAt: now,
          extraFields: body.extraFields ?? {},
          visitReason: body.visitReason ?? null,
        },
        include: ticketInclude,
      });
      await this.event(tx, created, null, 'waiting', user, null);
      return created;
    });

    this.emit({ branchId, event: SocketEvents.ticketIssued, payload: { ticket: view(ticket) } });
    const estimate = await this.estimateFor(ticket.id);
    return { ticket: view(ticket), ...estimate };
  }

  /** People ahead and estimated wait for a waiting ticket (FR-5, FR-12). */
  async estimateFor(
    ticketId: string,
  ): Promise<{ peopleAhead: number | null; waitMinutes: number | null }> {
    const ticket = await this.prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    if (ticket.status !== 'waiting') return { peopleAhead: null, waitMinutes: null };
    const waiting = await this.prisma.ticket.findMany({
      where: { serviceId: ticket.serviceId, status: 'waiting' },
    });
    const ahead = peopleAhead(waiting.map(toWaiting), ticket.id);
    const stats = await this.serviceStats(ticket.serviceId);
    return {
      peopleAhead: ahead,
      waitMinutes:
        ahead === null
          ? null
          : estimateWaitMinutes({
              peopleAhead: ahead,
              countersOpen: stats.countersOpen,
              averageServiceMs: stats.averageServiceMs,
            }),
    };
  }

  async cancel(user: SessionUser, ticketId: string) {
    return this.transition(user, ticketId, 'cancelled', SocketEvents.ticketEnded, {
      requireCounterOwner: false,
      from: ['waiting', 'called'],
    });
  }

  // ---------- Counters ----------

  async signIn(user: SessionUser, counterId: string) {
    const counter = await this.counterInBranch(user, counterId);
    await this.prisma.$transaction(async (tx) => {
      // A staff member works at one counter at a time.
      await tx.counter.updateMany({
        where: { signedInUserId: user.id, id: { not: counter.id } },
        data: { signedInUserId: null, status: 'closed' },
      });
      await tx.counter.update({
        where: { id: counter.id },
        data: { signedInUserId: user.id, status: 'open', priorityStreak: 0 },
      });
    });
    this.emitCounter(counter.branchId, counter.id);
    return this.counterState(user, counter.id);
  }

  async setCounterStatus(
    user: SessionUser,
    counterId: string,
    status: 'open' | 'paused' | 'closed',
  ) {
    const counter = await this.counterInBranch(user, counterId);
    this.assertSignedIn(user, counter);
    await this.prisma.counter.update({
      where: { id: counter.id },
      data: status === 'closed' ? { status, signedInUserId: null } : { status },
    });
    this.emitCounter(counter.branchId, counter.id);
    return this.counterState(user, counter.id);
  }

  /** Everything the staff console shows for one counter (design: user flow 4). */
  async counterState(user: SessionUser, counterId: string) {
    const counter = await this.counterInBranch(user, counterId, true);
    const serviceIds = counter.counterServices.map((cs) => cs.serviceId);
    const [current, waitingRows] = await Promise.all([
      this.prisma.ticket.findFirst({
        where: { counterId: counter.id, status: { in: ['called', 'serving'] } },
        include: ticketInclude,
      }),
      this.prisma.ticket.findMany({
        where: { serviceId: { in: serviceIds }, status: 'waiting' },
        include: ticketInclude,
      }),
    ]);
    const all = waitingRows.map(toWaiting);
    const byId = new Map(waitingRows.map((t) => [t.id, t]));
    const ordered = all
      .slice()
      .sort(compareTickets)
      .map((w) => byId.get(w.id))
      .filter((t): t is TicketRow => t !== undefined);
    return {
      counter: {
        id: counter.id,
        name: counter.name,
        status: counter.status,
        signedInUserId: counter.signedInUserId,
        signedInByMe: counter.signedInUserId === user.id,
        serviceIds,
      },
      current: current ? view(current) : null,
      waiting: ordered.map(view),
    };
  }

  /** Waiting tickets per service with estimates, for the dashboard and (later) the TV. */
  async branchQueue(user: SessionUser) {
    const branchId = this.branchOf(user);
    const services = await this.prisma.service.findMany({
      where: { branchId, active: true },
      orderBy: { name: 'asc' },
    });
    const waiting = await this.prisma.ticket.findMany({
      where: { branchId, status: 'waiting' },
      include: ticketInclude,
    });
    const all = waiting.map(toWaiting);
    return {
      services: await Promise.all(
        services.map(async (s) => {
          const q = queueFor(all, s.id);
          const stats = await this.serviceStats(s.id);
          return {
            id: s.id,
            name: s.name,
            waiting: q.length,
            countersOpen: stats.countersOpen,
            nextWaitMinutes: estimateWaitMinutes({
              peopleAhead: q.length,
              countersOpen: stats.countersOpen,
              averageServiceMs: stats.averageServiceMs,
            }),
          };
        }),
      ),
    };
  }

  // ---------- Calling ----------

  /** Call next (FR-7): highest priority, then earliest sort time, across the counter's services. */
  async callNext(user: SessionUser, counterId: string) {
    const counter = await this.counterInBranch(user, counterId, true);
    this.assertSignedIn(user, counter);
    if (counter.status !== 'open') throw new ConflictException('Open your counter to call next');

    const called = await this.prisma.$transaction(async (tx) => {
      await lock(tx, `call:${counter.branchId}`);
      const busy = await tx.ticket.findFirst({
        where: { counterId: counter.id, status: { in: ['called', 'serving'] } },
      });
      if (busy) throw new ConflictException(`Finish ${busy.number} before calling the next one`);

      const fresh = await tx.counter.findUniqueOrThrow({
        where: { id: counter.id },
        include: { branch: true },
      });
      const serviceIds = counter.counterServices.map((cs) => cs.serviceId);
      const waiting = await tx.ticket.findMany({
        where: { serviceId: { in: serviceIds }, status: 'waiting' },
        select: { id: true, serviceId: true, priorityLevel: true, sortTime: true, number: true },
      });
      const next = pickNext({
        waiting: waiting.map(toWaiting),
        serviceIds,
        priorityStreak: fresh.priorityStreak,
        rule: { normalAfterPriority: fresh.branch.normalAfterPriority },
      });
      if (!next) return null;

      const ticket = await tx.ticket.update({
        where: { id: next.id },
        data: { status: 'called', counterId: counter.id, staffId: user.id, calledAt: new Date() },
        include: ticketInclude,
      });
      await tx.counter.update({
        where: { id: counter.id },
        data: { priorityStreak: nextPriorityStreak(fresh.priorityStreak, next) },
      });
      await this.event(tx, ticket, 'waiting', 'called', user, counter.id);
      return ticket;
    });

    if (called) {
      this.emit({
        branchId: counter.branchId,
        event: SocketEvents.ticketCalled,
        payload: { ticket: view(called), counterId: counter.id, counterName: counter.name },
      });
    }
    return { ticket: called ? view(called) : null };
  }

  recall(user: SessionUser, ticketId: string) {
    return this.transition(user, ticketId, 'called', SocketEvents.ticketRecalled, {
      requireCounterOwner: true,
      from: ['called'],
    });
  }

  start(user: SessionUser, ticketId: string) {
    return this.transition(user, ticketId, 'serving', SocketEvents.ticketServing);
  }

  noShow(user: SessionUser, ticketId: string) {
    return this.transition(user, ticketId, 'no_show', SocketEvents.ticketEnded);
  }

  /**
   * Done (FR-8): the patient joins the next stage's queue with the same number, or the visit ends.
   * The staff member is free to call next straight away.
   */
  async done(user: SessionUser, ticketId: string, choice: DoneChoice) {
    const ticket = await this.ticketForCounterOwner(user, ticketId);
    if (ticket.status !== 'serving') {
      throw new ConflictException(`Start ${ticket.number} before marking it done`);
    }
    const service = await this.prisma.service.findUniqueOrThrow({
      where: { id: ticket.serviceId },
    });
    const finishedAt = new Date();
    const outcome = (() => {
      try {
        return onDone({
          serviceId: service.id,
          defaultNext: service.nextServiceId,
          priorityLevel: ticket.priorityLevel,
          finishedAt: finishedAt.getTime(),
          choice,
        });
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
    })();

    if (outcome.action === 'enqueue') {
      const target = await this.prisma.service.findFirst({
        where: { id: outcome.serviceId, branchId: ticket.branchId, active: true },
      });
      if (!target) throw new BadRequestException('That stage is not available');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const endStatus: TicketStatus = outcome.action === 'enqueue' ? 'moved_on' : 'served';
      const ended = await tx.ticket.updateMany({
        where: { id: ticket.id, status: 'serving' },
        data: { status: endStatus, endedAt: finishedAt },
      });
      if (ended.count !== 1)
        throw new ConflictException('This ticket changed; refresh and try again');
      await this.event(tx, ticket, 'serving', endStatus, user, ticket.counterId);

      if (outcome.action === 'end') return { next: null };
      const next = await tx.ticket.create({
        data: {
          tenantId: ticket.tenantId,
          branchId: ticket.branchId,
          visitId: ticket.visitId,
          serviceId: outcome.serviceId,
          number: ticket.number,
          serviceDay: ticket.serviceDay,
          source: ticket.source,
          priorityLevel: outcome.priorityLevel,
          priorityReason: ticket.priorityReason,
          status: 'waiting',
          sortTime: new Date(outcome.sortTime),
          extraFields: ticket.extraFields ?? {},
          visitReason: ticket.visitReason,
          printed: ticket.printed,
        },
        include: ticketInclude,
      });
      await this.event(tx, next, null, 'waiting', user, null);
      return { next };
    });

    this.emit({
      branchId: ticket.branchId,
      event: result.next ? SocketEvents.ticketMovedOn : SocketEvents.ticketEnded,
      payload: { ticketId: ticket.id, next: result.next ? view(result.next) : null },
    });
    return { movedTo: result.next ? view(result.next) : null };
  }

  // ---------- Helpers ----------

  private async transition(
    user: SessionUser,
    ticketId: string,
    to: TicketStatus,
    event: SocketEventName,
    opts: { requireCounterOwner: boolean; from?: TicketStatus[] } = { requireCounterOwner: true },
  ) {
    const ticket = opts.requireCounterOwner
      ? await this.ticketForCounterOwner(user, ticketId)
      : await this.ticketInBranch(user, ticketId);
    if ((opts.from && !opts.from.includes(ticket.status)) || !canTransition(ticket.status, to)) {
      throw new ConflictException(
        `${ticket.number} is ${ticket.status.replace('_', ' ')} and cannot become ${to.replace('_', ' ')}`,
      );
    }
    const now = new Date();
    const data: Prisma.TicketUpdateManyMutationInput = { status: to };
    if (to === 'serving') data.servingAt = now;
    if (to === 'called') data.calledAt = now;
    if (to === 'no_show' || to === 'cancelled') data.endedAt = now;

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.ticket.updateMany({
        where: { id: ticket.id, status: ticket.status },
        data,
      });
      if (res.count !== 1)
        throw new ConflictException('This ticket changed; refresh and try again');
      await this.event(tx, ticket, ticket.status, to, user, ticket.counterId);
      return tx.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include: ticketInclude });
    });
    this.emit({ branchId: ticket.branchId, event, payload: { ticket: view(updated) } });
    return { ticket: view(updated) };
  }

  private branchOf(user: SessionUser): string {
    if (!user.branchId) throw new ForbiddenException('You are not assigned to a branch');
    return user.branchId;
  }

  private async counterInBranch(
    user: SessionUser,
    counterId: string,
    withServices?: false,
  ): Promise<Prisma.CounterGetPayload<object>>;
  private async counterInBranch(
    user: SessionUser,
    counterId: string,
    withServices: true,
  ): Promise<Prisma.CounterGetPayload<{ include: { counterServices: true } }>>;
  private async counterInBranch(user: SessionUser, counterId: string, withServices = false) {
    const counter = await this.prisma.counter.findFirst({
      where: { id: counterId, branchId: this.branchOf(user) },
      include: withServices ? { counterServices: true } : null,
    });
    if (!counter) throw new NotFoundException('Counter not found');
    return counter;
  }

  private assertSignedIn(
    user: SessionUser,
    counter: { signedInUserId: string | null; name: string },
  ) {
    if (counter.signedInUserId !== user.id) {
      throw new ForbiddenException(`Sign in to ${counter.name} first`);
    }
  }

  private async ticketInBranch(user: SessionUser, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, branchId: this.branchOf(user) },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  /** Only the person signed in at the ticket's counter acts on it; managers can step in. */
  private async ticketForCounterOwner(user: SessionUser, ticketId: string) {
    const ticket = await this.ticketInBranch(user, ticketId);
    if (user.role === 'branch_manager' || user.role === 'business_admin') return ticket;
    if (!ticket.counterId) throw new ConflictException(`${ticket.number} has not been called yet`);
    const counter = await this.prisma.counter.findUniqueOrThrow({
      where: { id: ticket.counterId },
    });
    this.assertSignedIn(user, counter);
    return ticket;
  }

  private async serviceStats(serviceId: string) {
    const [countersOpen, recent] = await Promise.all([
      this.prisma.counter.count({
        where: { status: 'open', counterServices: { some: { serviceId } } },
      }),
      this.prisma.ticket.findMany({
        where: {
          serviceId,
          status: { in: ['served', 'moved_on'] },
          servingAt: { not: null },
          endedAt: { not: null },
        },
        orderBy: { endedAt: 'desc' },
        take: 20,
        select: { servingAt: true, endedAt: true },
      }),
    ]);
    const durations = recent.map(
      (t) => (t.endedAt?.getTime() ?? 0) - (t.servingAt?.getTime() ?? 0),
    );
    return { countersOpen, averageServiceMs: averageServiceTime(durations, DEFAULT_SERVICE_MS) };
  }

  private async event(
    tx: Tx,
    ticket: { id: string; tenantId: string },
    from: TicketStatus | null,
    to: TicketStatus,
    user: SessionUser,
    counterId: string | null,
  ) {
    await tx.ticketEvent.create({
      data: {
        tenantId: ticket.tenantId,
        ticketId: ticket.id,
        fromStatus: from,
        toStatus: to,
        counterId,
        staffId: user.id,
      },
    });
  }

  private emitCounter(branchId: string, counterId: string) {
    this.emit({ branchId, event: SocketEvents.counterStatusChanged, payload: { counterId } });
  }

  private emit({ branchId, event, payload }: Emit) {
    this.realtime.emitToBranch(branchId, event, payload);
  }
}
