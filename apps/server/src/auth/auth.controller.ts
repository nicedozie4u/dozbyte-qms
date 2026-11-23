import { Body, Controller, Get, HttpCode, Inject, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { ZodBody } from '../common/zod-body.js';
import { AuthService } from './auth.service.js';
import type { SessionUser } from './auth.types.js';
import { AllowPasswordChangePending, CurrentUser, Public } from './decorators.js';
import { SESSION_COOKIE, SESSION_TTL_MS } from './session-token.js';

const LoginBody = z.object({ email: z.email(), password: z.string().min(1).max(200) });
const SetPasswordBody = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10, 'Use at least 10 characters').max(200),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodBody(LoginBody)) body: z.infer<typeof LoginBody>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser }> {
    const { token, user } = await this.auth.login(body.email, body.password);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.nodeEnv === 'production',
      maxAge: SESSION_TTL_MS,
      path: '/',
    });
    return { user };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @AllowPasswordChangePending()
  @Get('me')
  me(@CurrentUser() user: SessionUser): { user: SessionUser } {
    return { user };
  }

  @AllowPasswordChangePending()
  @Post('password')
  @HttpCode(204)
  async setPassword(
    @CurrentUser() user: SessionUser,
    @Body(new ZodBody(SetPasswordBody)) body: z.infer<typeof SetPasswordBody>,
  ): Promise<void> {
    await this.auth.setPassword(user.id, body.currentPassword, body.newPassword);
  }
}
