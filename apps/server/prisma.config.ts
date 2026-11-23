import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Local dev reads apps/server/.env (copy .env.example). On a site server the variables come from
// the Docker Compose environment, so no file is needed.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
