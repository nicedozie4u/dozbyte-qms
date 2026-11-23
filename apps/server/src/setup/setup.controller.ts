import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
} from '@nestjs/common';
import { SocketEvents } from '@dozbyte/shared';
import { getTemplate, type TemplateKey } from '@dozbyte/templates';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service.js';
import type { SessionUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { ZodBody } from '../common/zod-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { UpdateBranchBody, UpdateServiceBody } from './setup.schemas.js';

/** Read-only setup for the signed-in user's branch. Editing comes with the admin portal. */
@Controller('setup')
export class SetupController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get('branch')
  async branch(@CurrentUser() user: SessionUser) {
    const branchId = this.branchOf(user);
    const branch = await this.prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      include: {
        business: true,
        services: { where: { active: true }, orderBy: { name: 'asc' } },
        counters: { include: { counterServices: true }, orderBy: { name: 'asc' } },
      },
    });
    const template = getTemplate(branch.business.businessType as TemplateKey);
    const wording = { ...template.wording, ...(branch.business.wording as object) };
    return {
      branch: { id: branch.id, name: branch.name, normalAfterPriority: branch.normalAfterPriority },
      business: { name: branch.business.name, type: branch.business.businessType },
      wording,
      priorityReasons: template.priorityReasons,
      services: branch.services.map((s) => ({
        id: s.id,
        key: s.key,
        name: s.name,
        prefix: s.prefix,
        kioskStart: s.kioskStart,
        nextServiceId: s.nextServiceId,
        dailyTicketLimit: s.dailyTicketLimit,
        extraFields: s.extraFields,
      })),
      counters: branch.counters.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        signedInUserId: c.signedInUserId,
        serviceIds: c.counterServices.map((cs) => cs.serviceId),
      })),
    };
  }

  /** Priority fairness rule for the branch (design: how the queue engine decides who is next). */
  @Roles('branch_manager', 'business_admin')
  @Patch('branch')
  async updateBranch(
    @CurrentUser() user: SessionUser,
    @Body(new ZodBody(UpdateBranchBody)) body: UpdateBranchBody,
    @Req() req: Request,
  ) {
    const branchId = this.branchOf(user);
    const before = await this.prisma.branch.findUniqueOrThrow({ where: { id: branchId } });
    await this.prisma.branch.update({
      where: { id: branchId },
      data: { normalAfterPriority: body.normalAfterPriority },
    });
    await this.audit.record({
      tenantId: before.tenantId,
      userId: user.id,
      action: 'setup.branch.updated',
      target: `branch:${branchId}`,
      details: {
        normalAfterPriority: { from: before.normalAfterPriority, to: body.normalAfterPriority },
      },
      ip: req.ip ?? null,
    });
    this.realtime.emitToBranch(branchId, SocketEvents.setupChanged, {});
    return this.branch(user);
  }

  /** Daily ticket limit for one service (FR-14). */
  @Roles('branch_manager', 'business_admin')
  @Patch('services/:id')
  async updateService(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Body(new ZodBody(UpdateServiceBody)) body: UpdateServiceBody,
    @Req() req: Request,
  ) {
    const branchId = this.branchOf(user);
    const before = await this.prisma.service.findFirst({ where: { id: serviceId, branchId } });
    if (!before) throw new NotFoundException('Service not found');
    await this.prisma.service.update({
      where: { id: serviceId },
      data: { dailyTicketLimit: body.dailyTicketLimit },
    });
    await this.audit.record({
      tenantId: before.tenantId,
      userId: user.id,
      action: 'setup.service.updated',
      target: `service:${serviceId}`,
      details: { dailyTicketLimit: { from: before.dailyTicketLimit, to: body.dailyTicketLimit } },
      ip: req.ip ?? null,
    });
    this.realtime.emitToBranch(branchId, SocketEvents.setupChanged, {});
    return this.branch(user);
  }

  private branchOf(user: SessionUser): string {
    if (!user.branchId) throw new NotFoundException('You are not assigned to a branch');
    return user.branchId;
  }
}
