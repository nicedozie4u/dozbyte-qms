import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const E2E_PASSWORD = 'e2e-password-not-secret';
export const E2E_DATABASE_URL =
  process.env['E2E_DATABASE_URL'] ?? 'postgresql://dozbyte@localhost:5432/dozbyte_e2e';

const serverDir = fileURLToPath(new URL('../server', import.meta.url));

/** Migrates the browser-test database. */
export function migrate(): void {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: 'pipe',
  });
}

/** Wipes the browser-test database and seeds the demo hospital with one known password. */
export function reseed(): void {
  execFileSync('node', ['dist/seed/seed.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      DATABASE_URL: E2E_DATABASE_URL,
      SEED_RESET: '1',
      SEED_PASSWORD: E2E_PASSWORD,
    },
    stdio: 'pipe',
  });
}

export default function globalSetup(): void {
  migrate();
  reseed();
}
