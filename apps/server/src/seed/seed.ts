import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { seedHospital, type SeedUser } from './seed-hospital.js';

/**
 * Dev seed: one hospital, one branch, an admin and four staff accounts.
 * Passwords are random and printed once, unless SEED_PASSWORD sets one for all (browser tests).
 * Refuses a database that has a business, unless SEED_RESET=1 wipes it first (never in production).
 */
const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

if (process.env['SEED_RESET'] === '1') {
  if (process.env['NODE_ENV'] === 'production')
    throw new Error('SEED_RESET is refused in production');
  await prisma.$executeRawUnsafe(
    'TRUNCATE audit_log, ticket_events, tickets, devices, counter_services, counters, services, users, branches, business CASCADE',
  );
}

if ((await prisma.business.count()) > 0) {
  console.error('This database already has a business. Seed only runs on an empty database.');
  process.exit(1);
}

const fixed = process.env['SEED_PASSWORD'];
const pw = () => fixed ?? randomBytes(9).toString('base64url');
const users: SeedUser[] = [
  { name: 'Admin', email: 'admin@example.test', role: 'business_admin', password: pw() },
  { name: 'Front Desk', email: 'frontdesk@example.test', role: 'staff', password: pw() },
  { name: 'Nurse', email: 'nurse@example.test', role: 'staff', password: pw() },
  { name: 'Doctor', email: 'doctor@example.test', role: 'staff', password: pw() },
  { name: 'Pharmacist', email: 'pharmacist@example.test', role: 'staff', password: pw() },
];

await seedHospital(prisma, {
  businessName: 'Demo Hospital',
  branchName: 'Main Branch',
  users,
});
await prisma.$disconnect();

if (fixed) {
  console.warn(`Seeded Demo Hospital with ${users.length} users sharing SEED_PASSWORD.`);
} else {
  console.warn('Seeded Demo Hospital. Dev logins (shown once):');
  for (const u of users) console.warn(`  ${u.email.padEnd(26)} ${u.password}  (${u.role})`);
}
