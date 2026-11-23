import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { SetupController } from './setup.controller.js';

@Module({ imports: [RealtimeModule], controllers: [SetupController] })
export class SetupModule {}
