import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SessionUser } from './auth.types.js';
import { hashPassword, verifyPassword } from './password.js';
import { LoginLimiter } from './login-limiter.js';
import { createSessionToken, readSessionToken } from './session-token.js';

// Verified against when the email is unknown, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = hashPassword('dozbyte-timing-guard');

@Injectable()
export class AuthService {
  private readonly limiter = new LoginLimiter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async login(
    email: string,
    password: string,
    ip: string,
  ): Promise<{ token: string; user: SessionUser }> {
    const wait = this.limiter.retryAfterMs(email, ip);
    if (wait > 0) {
      const minutes = Math.ceil(wait / 60_000);
      throw new HttpException(
        `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const ok = await verifyPassword(user?.passwordHash ?? (await DUMMY_HASH), password);
    if (!user || !user.active || !user.passwordHash || !ok) {
      this.limiter.recordFailure(email, ip);
      await this.audit.record({
        tenantId: user?.tenantId ?? null,
        userId: user?.id ?? null,
        action: 'auth.login_failed',
        details: { email: email.toLowerCase() },
        ip,
      });
      throw new UnauthorizedException('Wrong email or password');
    }

    this.limiter.recordSuccess(email, ip);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.record({ tenantId: user.tenantId, userId: user.id, action: 'auth.login', ip });
    return {
      token: createSessionToken(user.id, this.config.sessionSecret),
      user: toSessionUser(user),
    };
  }

  /** The user behind a session token, or null if the token or the account is no longer valid. */
  async userFromToken(token: string | undefined): Promise<SessionUser | null> {
    const id = readSessionToken(token, this.config.sessionSecret);
    if (!id) return null;
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user?.active ? toSessionUser(user) : null;
  }

  async setPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Current password is wrong');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword), mustSetPassword: false },
    });
    await this.audit.record({ tenantId: user.tenantId, userId, action: 'auth.password_changed' });
  }
}

export function toSessionUser(u: {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  name: string;
  email: string;
  role: SessionUser['role'];
  mustSetPassword: boolean;
}): SessionUser {
  return {
    id: u.id,
    tenantId: u.tenantId,
    branchId: u.branchId,
    name: u.name,
    email: u.email,
    role: u.role,
    mustSetPassword: u.mustSetPassword,
  };
}
