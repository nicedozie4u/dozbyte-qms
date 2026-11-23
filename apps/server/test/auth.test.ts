import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { startTestApp, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await startTestApp();
});
afterAll(() => ctx.close());

describe('accounts and access (FR-21)', () => {
  it('needs a login for staff routes', async () => {
    await request(ctx.app.getHttpServer()).get('/setup/branch').expect(401);
  });

  it('leaves the health check open', async () => {
    await request(ctx.app.getHttpServer()).get('/health').expect(200, { ok: true });
  });

  it('rejects a wrong password with the same message as an unknown email', async () => {
    const a = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nurse@test.local', password: 'wrong' })
      .expect(401);
    const b = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@test.local', password: 'wrong' })
      .expect(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('stores only an Argon2 hash', async () => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'nurse@test.local' } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('logs in with a session cookie that is httpOnly', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'NURSE@test.local', password: 'correct-horse-battery' })
      .expect(200);
    expect(res.body.user.email).toBe('nurse@test.local');
    expect(String(res.headers['set-cookie'])).toMatch(/dz_session=.*HttpOnly/);
  });

  it('makes a user with a temporary password set their own first', async () => {
    await ctx.prisma.user.update({
      where: { email: 'pharmacist@test.local' },
      data: { mustSetPassword: true },
    });
    const agent = await ctx.login('pharmacist@test.local');
    await agent.get('/setup/branch').expect(403);
    await agent.get('/auth/me').expect(200);
    await agent
      .post('/auth/password')
      .send({ currentPassword: 'correct-horse-battery', newPassword: 'short' })
      .expect(400);
    await agent
      .post('/auth/password')
      .send({ currentPassword: 'correct-horse-battery', newPassword: 'a-much-longer-password' })
      .expect(204);
    await agent.get('/setup/branch').expect(200);
  });

  it('signs out a deactivated user straight away', async () => {
    const agent = await ctx.login('doctor2@test.local');
    await agent.get('/setup/branch').expect(200);
    await ctx.prisma.user.update({
      where: { email: 'doctor2@test.local' },
      data: { active: false },
    });
    await agent.get('/setup/branch').expect(401);
  });
});
