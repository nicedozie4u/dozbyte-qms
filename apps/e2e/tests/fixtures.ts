import { type Browser, expect, type Page, test as base } from '@playwright/test';
import { E2E_PASSWORD, reseed } from '../seed.js';

export { expect };

/** Every test starts from a freshly seeded demo hospital. */
export const test = base.extend<{ fresh: null }>({
  fresh: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      reseed();
      await use(null);
    },
    { auto: true },
  ],
});

export type Who = 'admin' | 'frontdesk' | 'nurse' | 'doctor' | 'pharmacist';

/** A separate browser for one staff member, logged in, like a separate desk computer. */
export async function staff(browser: Browser, who: Who): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, who);
  return page;
}

export async function login(page: Page, who: Who, password = E2E_PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(`${who}@example.test`);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  // Wait for the redirect home, so it cannot overtake the test's next navigation
  if (password === E2E_PASSWORD) await page.waitForURL('/');
}

/** Opens the staff console at a counter or room. */
export async function atCounter(page: Page, name: string): Promise<void> {
  await page.goto('/console');
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole('button', { name: `Leave ${name}` })).toBeVisible();
}

/** Front desk issues a ticket and returns its number. */
export async function issueTicket(
  page: Page,
  service: string,
  opts: { priority?: string; card?: string } = {},
): Promise<string> {
  await page.goto('/front-desk');
  await page.getByRole('button', { name: new RegExp(`^${service}`) }).click();
  if (opts.priority) await page.getByLabel('Priority').selectOption({ label: opts.priority });
  if (opts.card) await page.getByLabel(/Hospital card number/).fill(opts.card);
  await page.getByRole('button', { name: `Issue ${service} ticket` }).click();
  const number = page.locator('.ticket-number');
  await expect(number).toHaveText(/^[A-Z]+-\d{3,}$/);
  return (await number.textContent()) ?? '';
}
