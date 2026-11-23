import { defineConfig, devices } from '@playwright/test';
import { E2E_DATABASE_URL } from './seed.js';

/**
 * Runs the built server (port 3001) and web app (port 3000) against the e2e database.
 * Build first: `pnpm build`. Tests share one database, so they run one at a time.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './seed.ts',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node --enable-source-maps ../server/dist/main.js',
      url: 'http://localhost:3001/health',
      env: { DATABASE_URL: E2E_DATABASE_URL, PORT: '3001', NODE_ENV: 'test' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @dozbyte/web start',
      url: 'http://localhost:3000/login',
      env: { API_URL: 'http://localhost:3001' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
