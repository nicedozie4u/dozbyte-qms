import { SocketEvents } from '@dozbyte/shared';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { idOf, startTestApp, type TestContext } from './helpers.js';

let ctx: TestContext;
const sockets: Socket[] = [];
beforeAll(async () => {
  ctx = await startTestApp();
});
afterAll(async () => {
  sockets.forEach((s) => s.close());
  await ctx.close();
});

function connect(cookie?: string): Socket {
  const s = io(ctx.url, {
    transports: ['websocket'],
    extraHeaders: cookie ? { cookie } : {},
    reconnection: false,
  });
  sockets.push(s);
  return s;
}

const once = <T>(s: Socket, event: string, ms = 2_000) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event} within ${ms} ms`)), ms);
    s.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

describe('live updates (NFR-1)', () => {
  it('turns away a socket with no login', async () => {
    const s = connect();
    await once(s, 'disconnect');
  });

  it('tells another console about a call within 2 seconds', async () => {
    const watcher = connect(await ctx.cookieFor('doctor@test.local'));
    await once(watcher, 'connect');

    const desk = await ctx.login('frontdesk@test.local');
    const issued = once<{ ticket: { number: string } }>(watcher, SocketEvents.ticketIssued);
    await desk
      .post('/tickets')
      .send({ serviceId: idOf(ctx.seed.services, 'records') })
      .expect(201);
    expect((await issued).ticket.number).toBe('R-001');

    const records = idOf(ctx.seed.counters, 'Records Desk 1');
    await desk.post(`/counters/${records}/sign-in`).expect(200);
    const started = Date.now();
    const called = once<{ ticket: { number: string }; counterName: string }>(
      watcher,
      SocketEvents.ticketCalled,
    );
    await desk.post(`/counters/${records}/call-next`).expect(200);
    const payload = await called;
    expect(payload.counterName).toBe('Records Desk 1');
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
