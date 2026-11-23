import { nextStage } from '@dozbyte/queue-core';
import { getTemplate } from '@dozbyte/templates';
import { hashPassword } from '../auth/password.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { UserRole } from '../generated/prisma/enums.js';

export interface SeedUser {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}

export interface SeedResult {
  businessId: string;
  branchId: string;
  services: Record<string, string>;
  counters: Record<string, string>;
}

/** Counters for a small hospital branch, and the services each one handles. */
const COUNTERS: { name: string; services: string[] }[] = [
  { name: 'Records Desk 1', services: ['records'] },
  { name: 'Triage Room', services: ['triage'] },
  { name: 'Consulting Room 1', services: ['consultation'] },
  { name: 'Consulting Room 2', services: ['consultation'] },
  { name: 'Lab', services: ['lab'] },
  { name: 'Pharmacy Window', services: ['pharmacy'] },
];

/**
 * Creates one hospital business with one branch from the hospital template (FR-23):
 * services with their journey links, counters mapped to services, and the given users.
 * Sprint 1 stand-in for the admin portal's setup checklist.
 */
export async function seedHospital(
  prisma: PrismaClient,
  opts: { businessName: string; branchName: string; users: SeedUser[] },
): Promise<SeedResult> {
  const template = getTemplate('hospital');
  return prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: { name: opts.businessName, businessType: template.key },
    });
    const branch = await tx.branch.create({
      data: { tenantId: business.id, name: opts.branchName, normalAfterPriority: 3 },
    });

    const services: Record<string, string> = {};
    for (const s of template.services) {
      const row = await tx.service.create({
        data: {
          tenantId: business.id,
          branchId: branch.id,
          key: s.key,
          name: s.name,
          prefix: s.prefix,
          kioskStart: s.kioskStart,
          appointments: s.appointments,
          extraFields: s.extraFields,
        },
      });
      services[s.key] = row.id;
    }
    for (const s of template.services) {
      const next = nextStage(template.journey, s.key);
      if (next) {
        await tx.service.update({
          where: { id: services[s.key] },
          data: { nextServiceId: services[next] ?? null },
        });
      }
    }

    const counters: Record<string, string> = {};
    for (const c of COUNTERS) {
      const row = await tx.counter.create({
        data: {
          tenantId: business.id,
          branchId: branch.id,
          name: c.name,
          counterServices: {
            create: c.services.map((key) => {
              const serviceId = services[key];
              if (!serviceId) throw new Error(`unknown service ${key}`);
              return { tenantId: business.id, serviceId };
            }),
          },
        },
      });
      counters[c.name] = row.id;
    }

    for (const u of opts.users) {
      await tx.user.create({
        data: {
          tenantId: business.id,
          branchId: branch.id,
          name: u.name,
          email: u.email.toLowerCase(),
          role: u.role,
          passwordHash: await hashPassword(u.password),
          mustSetPassword: false,
        },
      });
    }

    return { businessId: business.id, branchId: branch.id, services, counters };
  });
}
