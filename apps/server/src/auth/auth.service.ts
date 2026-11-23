import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SessionUser } from './auth.types.js';
import { hashPassword, verifyPassword } from './password.js';
import { createSessionToken, readSessionToken } from './session-token.js';

// Verified against when the email is unknown, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = hashPassword('dozbyte-timing-guard');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; user: SessionUser }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const ok = await verifyPassword(user?.passwordHash ?? (await DUMMY_HASH), password);
    if (!user || !user.active || !user.passwordHash || !ok) {
      throw new UnauthorizedException('Wrong email or password');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
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
