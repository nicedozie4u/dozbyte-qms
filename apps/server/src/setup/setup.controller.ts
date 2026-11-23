import { Controller, Get, NotFoundException } from '@nestjs/common';
import { getTemplate, type TemplateKey } from '@dozbyte/templates';
import type { SessionUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Read-only setup for the signed-in user's branch. Editing comes with the admin portal. */
@Controller('setup')
export class SetupController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('branch')
  async branch(@CurrentUser() user: SessionUser) {
    if (!user.branchId) throw new NotFoundException('You are not assigned to a branch');
    const branch = await this.prisma.branch.findUniqueOrThrow({
      where: { id: user.branchId },
      include: {
        business: true,
        services: { where: { active: true }, orderBy: { name: 'asc' } },
        counters: { include: { counterServices: true }, orderBy: { name: 'asc' } },
      },
    });
    const template = getTemplate(branch.business.businessType as TemplateKey);
    const wording = { ...template.wording, ...(branch.business.wording as object) };
    return {
      branch: { id: branch.id, name: branch.name },
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
}
