import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  /** Signs session cookies. Required in production; dev and test get a random one per start. */
  SESSION_SECRET: z.string().min(32).optional(),
  /** The web app's origin, allowed to call the API and open sockets. */
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  /** Local time zone of the site, used for the ticket day (numbers restart daily). */
  SITE_TIMEZONE: z.string().default('Africa/Lagos'),
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  webOrigin: string;
  siteTimezone: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = Env.parse(env);
  if (parsed.NODE_ENV === 'production' && !parsed.SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be set in production (at least 32 characters)');
  }
  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    sessionSecret: parsed.SESSION_SECRET ?? randomBytes(32).toString('hex'),
    webOrigin: parsed.WEB_ORIGIN,
    siteTimezone: parsed.SITE_TIMEZONE,
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
