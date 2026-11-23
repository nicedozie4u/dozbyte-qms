import { execFileSync } from 'node:child_process';

/** Points tests at their own database and brings it up to the latest migration. */
export default function setup(): void {
  const url =
    process.env['TEST_DATABASE_URL'] ?? 'postgresql://dozbyte@localhost:5432/dozbyte_test';
  process.env['DATABASE_URL'] = url;
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
