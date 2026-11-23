import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config.js';

export async function createApp(config: AppConfig): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(config), {
    logger: config.nodeEnv === 'test' ? ['error'] : ['log', 'warn', 'error'],
  });
  app.use(cookieParser());
  app.enableCors({ origin: config.webOrigin, credentials: true });
  app.enableShutdownHooks();
  return app;
}
