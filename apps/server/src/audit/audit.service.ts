import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditEntry {
  tenantId: string | null;
  userId: string | null;
  action: string;
  target?: string | null;
  details?: Prisma.InputJsonValue;
  ip?: string | null;
}

/** Writes sensitive actions to audit_log (NFR-6). A failed write is logged, never thrown. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          userId: entry.userId,
          action: entry.action,
          target: entry.target ?? null,
          details: entry.details ?? {},
          ip: entry.ip ?? null,
        },
      });
    } catch (e) {
      this.logger.error(`could not write audit entry ${entry.action}: ${(e as Error).message}`);
    }
  }
}
