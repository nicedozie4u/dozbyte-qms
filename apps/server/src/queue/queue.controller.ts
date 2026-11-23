import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { SessionUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { ZodBody } from '../common/zod-body.js';
import { DoneBody, IssueTicketBody } from './queue.schemas.js';
import { QueueService } from './queue.service.js';

const id = new ParseUUIDPipe({ version: '4' });

@Controller()
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  @Get('queue')
  branchQueue(@CurrentUser() user: SessionUser) {
    return this.queue.branchQueue(user);
  }

  @Post('tickets')
  issue(
    @CurrentUser() user: SessionUser,
    @Body(new ZodBody(IssueTicketBody)) body: IssueTicketBody,
  ) {
    return this.queue.issue(user, body);
  }

  @Post('tickets/:id/recall')
  @HttpCode(200)
  recall(@CurrentUser() user: SessionUser, @Param('id', id) ticketId: string) {
    return this.queue.recall(user, ticketId);
  }

  @Post('tickets/:id/start')
  @HttpCode(200)
  start(@CurrentUser() user: SessionUser, @Param('id', id) ticketId: string) {
    return this.queue.start(user, ticketId);
  }

  @Post('tickets/:id/no-show')
  @HttpCode(200)
  noShow(@CurrentUser() user: SessionUser, @Param('id', id) ticketId: string) {
    return this.queue.noShow(user, ticketId);
  }

  @Post('tickets/:id/done')
  @HttpCode(200)
  done(
    @CurrentUser() user: SessionUser,
    @Param('id', id) ticketId: string,
    @Body(new ZodBody(DoneBody)) body: DoneBody,
  ) {
    return this.queue.done(user, ticketId, body.choice);
  }

  @Post('tickets/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: SessionUser, @Param('id', id) ticketId: string) {
    return this.queue.cancel(user, ticketId);
  }

  @Get('counters/:id')
  counter(@CurrentUser() user: SessionUser, @Param('id', id) counterId: string) {
    return this.queue.counterState(user, counterId);
  }

  @Post('counters/:id/sign-in')
  @HttpCode(200)
  signIn(@CurrentUser() user: SessionUser, @Param('id', id) counterId: string) {
    return this.queue.signIn(user, counterId);
  }

  @Post('counters/:id/pause')
  @HttpCode(200)
  pause(@CurrentUser() user: SessionUser, @Param('id', id) counterId: string) {
    return this.queue.setCounterStatus(user, counterId, 'paused');
  }

  @Post('counters/:id/resume')
  @HttpCode(200)
  resume(@CurrentUser() user: SessionUser, @Param('id', id) counterId: string) {
    return this.queue.setCounterStatus(user, counterId, 'open');
  }

  @Post('counters/:id/sign-out')
  @HttpCode(200)
  signOut(@CurrentUser() user: SessionUser, @Param('id', id) counterId: string) {
    return this.queue.setCounterStatus(user, counterId, 'closed');
  }

  @Post('counters/:id/call-next')
  @HttpCode(200)
  callNext(@CurrentUser() user: SessionUser, @Param('id', id) counterId: string) {
    return this.queue.callNext(user, counterId);
  }
}
