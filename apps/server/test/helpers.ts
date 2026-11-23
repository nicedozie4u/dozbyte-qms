import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { createApp } from '../src/bootstrap.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedHospital, type SeedResult, type SeedUser } from '../src/seed/seed-hospital.js';

export const PASSWORD = 'correct-horse-battery';
const users: SeedUser[] = [
  { name: 'Admin', email: 'admin@test.local', role: 'business_admin', password: PASSWORD },
  { name: 'Front Desk', email: 'frontdesk@test.local', role: 'staff', password: PASSWORD },
  { name: 'Nurse', email: 'nurse@test.local', role: 'staff', password: PASSWORD },
  { name: 'Doctor', email: 'doctor@test.local', role: 'staff', password: PASSWORD },
  { name: 'Doctor Two', email: 'doctor2@test.local', role: 'staff', password: PASSWORD },
  { name: 'Pharmacist', email: 'pharmacist@test.local', role: 'staff', password: PASSWORD },
];

const databaseUrl = () =>
  process.env['TEST_DATABASE_URL'] ?? 'postgresql://dozbyte@localhost:5432/dozbyte_test';

export interface TestContext {
  app: INestApplication;
  url: string;
  prisma: PrismaClient;
  seed: SeedResult;
  login(email: string): Promise<ReturnType<typeof request.agent>>;
  cookieFor(email: string): Promise<string>;
  close(): Promise<void>;
}

export async function startTestApp(): Promise<TestContext> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
  await prisma.$executeRawUnsafe(
    'TRUNCATE audit_log, ticket_events, tickets, devices, counter_services, counters, services, users, branches, business CASCADE',
  );
  const seed = await seedHospital(prisma, {
    businessName: 'Test Hospital',
    branchName: 'Main',
    users,
  });

  const app = await createApp({
    nodeEnv: 'test',
    port: 0,
    databaseUrl: databaseUrl(),
    sessionSecret: 't'.repeat(32),
    webOrigin: 'http://localhost:3000',
    siteTimezone: 'Africa/Lagos',
  });
  await app.listen(0, '127.0.0.1');
  const url = await app.getUrl();

  const login = async (email: string) => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password: PASSWORD }).expect(200);
    return agent;
  };
  const cookieFor = async (email: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const set = res.headers['set-cookie'] as unknown as string[];
    return set.map((c) => c.split(';')[0]).join('; ');
  };

  return {
    app,
    url,
    prisma,
    seed,
    login,
    cookieFor,
    close: async () => {
      await app.close();
      await prisma.$disconnect();
    },
  };
}

/** Looks up a seeded counter or service ID by name, failing loudly on a typo. */
export function idOf(map: Record<string, string>, name: string): string {
  const id = map[name];
  if (!id) throw new Error(`no seeded entry named ${name}`);
  return id;
}
