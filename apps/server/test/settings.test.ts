import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { idOf, startTestApp, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await startTestApp();
});
afterAll(() => ctx.close());

const service = (key: string) => idOf(ctx.seed.services, key);

describe('manager settings', () => {
  it('only managers and admins can change settings (FR-21)', async () => {
    const staff = await ctx.login('nurse@test.local');
    await staff.patch('/setup/branch').send({ normalAfterPriority: 2 }).expect(403);
    await staff
      .patch(`/setup/services/${service('records')}`)
      .send({ dailyTicketLimit: 5 })
      .expect(403);
  });

  it('sets the fairness rule, and Call next follows it', async () => {
    const admin = await ctx.login('admin@test.local');
    const res = await admin.patch('/setup/branch').send({ normalAfterPriority: 1 }).expect(200);
    expect(res.body.branch.normalAfterPriority).toBe(1);

    const desk = await ctx.login('frontdesk@test.local');
    const normal = await desk.post('/tickets').send({ serviceId: service('triage') });
    const p1 = await desk
      .post('/tickets')
      .send({ serviceId: service('triage'), priorityReason: 'elderly' });
    await desk.post('/tickets').send({ serviceId: service('triage'), priorityReason: 'pregnant' });

    const nurse = await ctx.login('nurse@test.local');
    const room = idOf(ctx.seed.counters, 'Triage Room');
    await nurse.post(`/counters/${room}/sign-in`).expect(200);
    const order: string[] = [];
    for (let i = 0; i < 2; i++) {
      const call = await nurse.post(`/counters/${room}/call-next`).expect(200);
      order.push(call.body.ticket.id);
      await nurse.post(`/tickets/${call.body.ticket.id}/start`).expect(200);
      await nurse
        .post(`/tickets/${call.body.ticket.id}/done`)
        .send({ choice: { kind: 'end' } })
        .expect(200);
    }
    // One priority, then the rule makes room for the normal ticket
    expect(order).toEqual([p1.body.ticket.id, normal.body.ticket.id]);
  });

  it('can turn the fairness rule off, and rejects silly values', async () => {
    const admin = await ctx.login('admin@test.local');
    await admin.patch('/setup/branch').send({ normalAfterPriority: 0 }).expect(400);
    const res = await admin.patch('/setup/branch').send({ normalAfterPriority: null }).expect(200);
    expect(res.body.branch.normalAfterPriority).toBeNull();
  });

  it('enforces a daily ticket limit (FR-14)', async () => {
    const admin = await ctx.login('admin@test.local');
    await admin
      .patch(`/setup/services/${service('pharmacy')}`)
      .send({ dailyTicketLimit: 2 })
      .expect(200);
    const desk = await ctx.login('frontdesk@test.local');
    await desk
      .post('/tickets')
      .send({ serviceId: service('pharmacy') })
      .expect(201);
    await desk
      .post('/tickets')
      .send({ serviceId: service('pharmacy') })
      .expect(201);
    const third = await desk
      .post('/tickets')
      .send({ serviceId: service('pharmacy') })
      .expect(409);
    expect(third.body.message).toMatch(/limit/);
  });

  it('records setting changes and logins in the audit log (NFR-6)', async () => {
    const entries = await ctx.prisma.auditLog.findMany({ orderBy: { at: 'asc' } });
    const actions = entries.map((e) => e.action);
    expect(actions).toContain('auth.login');
    expect(actions).toContain('setup.branch.updated');
    const limit = entries.find((e) => e.action === 'setup.service.updated');
    expect(limit?.details).toEqual({ dailyTicketLimit: { from: null, to: 2 } });
  });
});

describe('login protection', () => {
  it('refuses more attempts after repeated failures, and logs them', async () => {
    const server = ctx.app.getHttpServer();
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post('/auth/login')
        .send({ email: 'doctor@test.local', password: 'nope' })
        .expect(401);
    }
    const blocked = await request(server)
      .post('/auth/login')
      .send({ email: 'doctor@test.local', password: 'correct-horse-battery' })
      .expect(429);
    expect(blocked.body.message).toMatch(/Try again in 15 minutes/);
    const failed = await ctx.prisma.auditLog.count({ where: { action: 'auth.login_failed' } });
    expect(failed).toBe(5);
  });
});
