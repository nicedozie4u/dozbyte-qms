import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { UserRole } from '../generated/prisma/enums.js';
import type { SessionUser } from './auth.types.js';

export const IS_PUBLIC = 'dozbyte:isPublic';
export const ROLES = 'dozbyte:roles';
export const ALLOW_PASSWORD_CHANGE_PENDING = 'dozbyte:allowPasswordChangePending';

/** Route needs no login. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route needs one of these roles (FR-21). Without it, any signed-in role may call it. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

/** Route stays open to a user who must still set their own password. */
export const AllowPasswordChangePending = () => SetMetadata(ALLOW_PASSWORD_CHANGE_PENDING, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: SessionUser }>();
  return req.user;
});
