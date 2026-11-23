import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';

const config = loadConfig();
if (!process.env['SESSION_SECRET']) {
  Logger.warn('SESSION_SECRET is not set: using a random one, so restarts sign everyone out');
}
const app = await createApp(config);
await app.listen(config.port);
Logger.log(`Dozbyte server listening on port ${config.port}`);
