import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '../generated/prisma/enums.js';
import { AuthService } from './auth.service.js';
import type { SessionUser } from './auth.types.js';
import { ALLOW_PASSWORD_CHANGE_PENDING, IS_PUBLIC, ROLES } from './decorators.js';
import { SESSION_COOKIE } from './session-token.js';

/** Applied to every route: login required unless @Public, then role checks from @Roles. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const user = await this.auth.userFromToken(cookies?.[SESSION_COOKIE]);
    if (!user) throw new UnauthorizedException('Please log in');
    req.user = user;

    if (
      user.mustSetPassword &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_PENDING, targets)
    ) {
      throw new ForbiddenException('Set your own password first');
    }

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(user.role)) {
      throw new ForbiddenException('Your role cannot do this');
    }
    return true;
  }
}
