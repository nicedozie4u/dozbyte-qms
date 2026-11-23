import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { idOf, startTestApp, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeEach(async () => {
  await ctx?.close();
  ctx = await startTestApp();
});
afterAll(() => ctx.close());

const counter = (name: string) => idOf(ctx.seed.counters, name);
const service = (key: string) => idOf(ctx.seed.services, key);

async function staffAt(email: string, counterName: string) {
  const agent = await ctx.login(email);
  await agent.post(`/counters/${counter(counterName)}/sign-in`).expect(200);
  return agent;
}

describe('issuing tickets (FR-1, FR-3, FR-4)', () => {
  it('numbers tickets per service prefix', async () => {
    const desk = await ctx.login('frontdesk@test.local');
    const a = await desk
      .post('/tickets')
      .send({ serviceId: service('records') })
      .expect(201);
    const b = await desk
      .post('/tickets')
      .send({ serviceId: service('records') })
      .expect(201);
    const c = await desk
      .post('/tickets')
      .send({ serviceId: service('consultation') })
      .expect(201);
    expect([a.body.ticket.number, b.body.ticket.number, c.body.ticket.number]).toEqual([
      'R-001',
      'R-002',
      'C-001',
    ]);
  });

  it('never repeats a number when many tickets are issued at once', async () => {
    const desk = await ctx.login('frontdesk@test.local');
    const results = await Promise.all(
      Array.from({ length: 15 }, () =>
        desk.post('/tickets').send({ serviceId: service('records') }),
      ),
    );
    const numbers = results.map((r) => r.body.ticket.number as string);
    expect(new Set(numbers).size).toBe(15);
  });

  it('returns people ahead and an estimated wait (FR-5, FR-12)', async () => {
    await staffAt('frontdesk@test.local', 'Records Desk 1');
    const desk = await ctx.login('nurse@test.local');
    await desk
      .post('/tickets')
      .send({ serviceId: service('records') })
      .expect(201);
    const second = await desk
      .post('/tickets')
      .send({ serviceId: service('records') })
      .expect(201);
    expect(second.body.peopleAhead).toBe(1);
    expect(second.body.waitMinutes).toBe(5); // 1 ahead / 1 counter open x 5 min default
  });

  it('rejects an unknown priority reason and bad input', async () => {
    const desk = await ctx.login('frontdesk@test.local');
    await desk
      .post('/tickets')
      .send({ serviceId: service('records'), priorityReason: 'vip' })
      .expect(400);
    await desk.post('/tickets').send({ serviceId: 'not-a-uuid' }).expect(400);
  });
});

describe('calling (FR-6, FR-7, FR-9)', () => {
  it('calls priority first, then first come first served', async () => {
    const desk = await ctx.login('frontdesk@test.local');
    const first = await desk.post('/tickets').send({ serviceId: service('records') });
    await desk.post('/tickets').send({ serviceId: service('records') });
    const elderly = await desk
      .post('/tickets')
      .send({ serviceId: service('records'), priorityReason: 'elderly' });

    const staff = await staffAt('nurse@test.local', 'Records Desk 1');
    const call1 = await staff.post(`/counters/${counter('Records Desk 1')}/call-next`).expect(200);
    expect(call1.body.ticket.id).toBe(elderly.body.ticket.id);

    await staff.post(`/tickets/${call1.body.ticket.id}/start`).expect(200);
    await staff
      .post(`/tickets/${call1.body.ticket.id}/done`)
      .send({ choice: { kind: 'end' } })
      .expect(200);
    const call2 = await staff.post(`/counters/${counter('Records Desk 1')}/call-next`).expect(200);
    expect(call2.body.ticket.id).toBe(first.body.ticket.id);
  });

  it('refuses call next until the current patient is finished', async () => {
    const desk = await ctx.login('frontdesk@test.local');
    await desk.post('/tickets').send({ serviceId: service('records') });
    await desk.post('/tickets').send({ serviceId: service('records') });
    const staff = await staffAt('nurse@test.local', 'Records Desk 1');
    await staff.post(`/counters/${counter('Records Desk 1')}/call-next`).expect(200);
    await staff.post(`/counters/${counter('Records Desk 1')}/call-next`).expect(409);
  });

  it('returns no ticket when nobody is waiting', async () => {
    const staff = await staffAt('nurse@test.local', 'Triage Room');
    const res = await staff.post(`/counters/${counter('Triage Room')}/call-next`).expect(200);
    expect(res.body.ticket).toBeNull();
  });

  it('only calls from a counter you are signed in to, and not while paused', async () => {
    const desk = await ctx.login('frontdesk@test.local');
    await desk.post('/tickets').send({ serviceId: service('records') });
    const other = await ctx.login('doctor@test.local');
    await other.post(`/counters/${counter('Records Desk 1')}/call-next`).expect(403);

    const staff = await staffAt('nurse@test.local', 'Records Desk 1');
    await staff.post(`/counters/${counter('Records Desk 1')}/pause`).expect(200);
    await staff.post(`/counters/${counter('Records Desk 1')}/call-next`).expect(409);
    await staff.post(`/counters/${counter('Records Desk 1')}/resume`).expect(200);
    await staff.post(`/counters/${counter('Records Desk 1')}/call-next`).expect(200);
  });

  it('never gives one patient to two rooms calling at the same moment', async () => {
    const desk = await ctx.login('frontdesk@test.local');
    for (let i = 0; i < 2; i++)
      await desk.post('/tickets').send({ serviceId: service('consultation') });
    const d1 = await staffAt('doctor@test.local', 'Consulting Room 1');
    const d2 = await staffAt('doctor2@test.local', 'Consulting Room 2');
    const [a, b] = await Promise.all([
      d1.post(`/counters/${counter('Consulting Room 1')}/call-next`),
      d2.post(`/counters/${counter('Consulting Room 2')}/call-next`),
    ]);
    expect(a.body.ticket.id).not.toBe(b.body.ticket.id);
  });

  it('recall works only on a called ticket; no-show ends it', async () => {
    const desk = await ctx.login('frontdesk@test.local');
    const t = await desk.post('/tickets').send({ serviceId: service('records') });
    const staff = await staffAt('nurse@test.local', 'Records Desk 1');
    const admin = await ctx.login('admin@test.local');
    await admin.post(`/tickets/${t.body.ticket.id}/recall`).expect(409); // still waiting
    await staff.post(`/counters/${counter('Records Desk 1')}/call-next`).expect(200);
    await staff.post(`/tickets/${t.body.ticket.id}/recall`).expect(200);
    const ns = await staff.post(`/tickets/${t.body.ticket.id}/no-show`).expect(200);
    expect(ns.body.ticket.status).toBe('no_show');
    await staff.post(`/tickets/${t.body.ticket.id}/start`).expect(409);
  });
});

describe('a patient moves stage to stage (FR-8)', () => {
  it('walks one ticket from Records to Pharmacy, via Lab, keeping its number', async () => {
    const desk = await ctx.login('frontdesk@test.local');
    const issued = await desk
      .post('/tickets')
      .send({ serviceId: service('records'), extraFields: { 'hospital-card-number': 'H-4471' } })
      .expect(201);
    const number = issued.body.ticket.number;

    const serve = async (
      agent: Awaited<ReturnType<typeof staffAt>>,
      counterName: string,
      choice: object = { kind: 'next' },
    ) => {
      const call = await agent.post(`/counters/${counter(counterName)}/call-next`).expect(200);
      expect(call.body.ticket.number).toBe(number);
      await agent.post(`/tickets/${call.body.ticket.id}/start`).expect(200);
      const done = await agent
        .post(`/tickets/${call.body.ticket.id}/done`)
        .send({ choice })
        .expect(200);
      return done.body.movedTo as { serviceName: string; number: string } | null;
    };

    const records = await staffAt('frontdesk@test.local', 'Records Desk 1');
    expect((await serve(records, 'Records Desk 1'))?.serviceName).toBe('Triage');

    const nurse = await staffAt('nurse@test.local', 'Triage Room');
    expect((await serve(nurse, 'Triage Room'))?.serviceName).toBe('Consultation');

    const doctor = await staffAt('doctor@test.local', 'Consulting Room 1');
    const toLab = await serve(doctor, 'Consulting Room 1', {
      kind: 'stage',
      serviceId: service('lab'),
    });
    expect(toLab?.serviceName).toBe('Lab');

    const lab = await staffAt('admin@test.local', 'Lab');
    expect((await serve(lab, 'Lab'))?.serviceName).toBe('Consultation');

    expect((await serve(doctor, 'Consulting Room 1'))?.serviceName).toBe('Pharmacy');

    const pharmacist = await staffAt('pharmacist@test.local', 'Pharmacy Window');
    expect(await serve(pharmacist, 'Pharmacy Window')).toBeNull();

    const stages = await ctx.prisma.ticket.findMany({
      where: { visitId: issued.body.ticket.visitId },
      orderBy: { issuedAt: 'asc' },
      include: { service: true },
    });
    expect(stages.map((s) => [s.service.key, s.status])).toEqual([
      ['records', 'moved_on'],
      ['triage', 'moved_on'],
      ['consultation', 'moved_on'],
      ['lab', 'moved_on'],
      ['consultation', 'moved_on'],
      ['pharmacy', 'served'],
    ]);
    expect(new Set(stages.map((s) => s.number))).toEqual(new Set([number]));
    expect(stages.at(-1)?.extraFields).toEqual({ 'hospital-card-number': 'H-4471' });

    // Every change is recorded: issued, then called, serving and done for each of 6 stages
    const events = await ctx.prisma.ticketEvent.count({
      where: { ticketId: { in: stages.map((s) => s.id) } },
    });
    expect(events).toBe(6 * 4);
  });

  it('lines up moved-on patients by when they finished the last stage', async () => {
    const desk = await ctx.login('frontdesk@test.local');
    const early = await desk.post('/tickets').send({ serviceId: service('triage') });
    const late = await desk.post('/tickets').send({ serviceId: service('triage') });
    const nurse = await staffAt('nurse@test.local', 'Triage Room');
    for (let i = 0; i < 2; i++) {
      const call = await nurse.post(`/counters/${counter('Triage Room')}/call-next`).expect(200);
      await nurse.post(`/tickets/${call.body.ticket.id}/start`).expect(200);
      await nurse
        .post(`/tickets/${call.body.ticket.id}/done`)
        .send({ choice: { kind: 'next' } })
        .expect(200);
    }
    const walkIn = await desk.post('/tickets').send({ serviceId: service('consultation') });
    const doctor = await staffAt('doctor@test.local', 'Consulting Room 1');
    const state = await doctor.get(`/counters/${counter('Consulting Room 1')}`).expect(200);
    expect(state.body.waiting.map((t: { number: string }) => t.number)).toEqual([
      early.body.ticket.number,
      late.body.ticket.number,
      walkIn.body.ticket.number,
    ]);
  });

  it('refuses Done before Start, and a move into the same stage', async () => {
    const desk = await ctx.login('frontdesk@test.local');
    await desk.post('/tickets').send({ serviceId: service('records') });
    const staff = await staffAt('nurse@test.local', 'Records Desk 1');
    const call = await staff.post(`/counters/${counter('Records Desk 1')}/call-next`);
    const id = call.body.ticket.id;
    await staff
      .post(`/tickets/${id}/done`)
      .send({ choice: { kind: 'next' } })
      .expect(409);
    await staff.post(`/tickets/${id}/start`).expect(200);
    await staff
      .post(`/tickets/${id}/done`)
      .send({ choice: { kind: 'stage', serviceId: service('records') } })
      .expect(400);
  });
});
