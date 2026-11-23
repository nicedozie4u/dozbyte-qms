import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { QueueController } from './queue.controller.js';
import { QueueService } from './queue.service.js';

@Module({
  imports: [RealtimeModule],
  controllers: [QueueController],
  providers: [QueueService],
})
export class QueueModule {}
