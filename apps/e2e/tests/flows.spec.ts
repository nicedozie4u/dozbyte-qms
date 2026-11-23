import { atCounter, expect, issueTicket, login, staff, test } from './fixtures.js';

test('front desk issues a priority ticket with a card number (FR-1, FR-3, FR-6)', async ({
  browser,
}) => {
  const desk = await staff(browser, 'frontdesk');
  const number = await issueTicket(desk, 'Records', { priority: 'Elderly', card: 'H-4471' });
  expect(number).toBe('R-001');
  await expect(desk.locator('.ticket-card .badge-priority')).toHaveText('Priority');
  await expect(desk.getByText('Next in line')).toBeVisible();
});

test('a patient walks from Records to Pharmacy, and each room sees them live (FR-8, NFR-1)', async ({
  browser,
}) => {
  const desk = await staff(browser, 'frontdesk');
  const nurse = await staff(browser, 'nurse');
  const doctor = await staff(browser, 'doctor');
  const pharmacist = await staff(browser, 'pharmacist');
  await atCounter(nurse, 'Triage Room');
  await atCounter(doctor, 'Consulting Room 1');
  await atCounter(pharmacist, 'Pharmacy Window');

  const number = await issueTicket(desk, 'Records', { card: 'H-9001' });
  await atCounter(desk, 'Records Desk 1');

  const serve = async (page: typeof desk, done: string) => {
    await expect(page.getByRole('listitem').filter({ hasText: number })).toBeVisible();
    await page.getByRole('button', { name: 'Call next' }).click();
    await expect(page.locator('.ticket-number')).toHaveText(number);
    await page.getByRole('button', { name: /Start/ }).click();
    await page.getByRole('button', { name: done }).click();
  };

  await serve(desk, 'Done: send to Triage');
  // The nurse's console was already open: the patient appears without a reload
  await serve(nurse, 'Done: send to Consultation');
  await serve(doctor, 'Done: send to Pharmacy');
  await serve(pharmacist, 'Done: end visit');
  await expect(pharmacist.getByText('Nobody is waiting right now.')).toBeVisible();
});

test('the doctor sends a patient to Lab, and Lab sends them back (FR-8)', async ({ browser }) => {
  const desk = await staff(browser, 'frontdesk');
  const number = await issueTicket(desk, 'Consultation');
  const doctor = await staff(browser, 'doctor');
  await atCounter(doctor, 'Consulting Room 1');
  await doctor.getByRole('button', { name: 'Call next' }).click();
  await doctor.getByRole('button', { name: /Start/ }).click();
  await doctor.getByLabel('Send to a different stage').selectOption({ label: 'Lab' });
  await doctor.getByRole('button', { name: 'Send', exact: true }).click();

  const lab = await staff(browser, 'admin');
  await atCounter(lab, 'Lab');
  await lab.getByRole('button', { name: 'Call next' }).click();
  await expect(lab.locator('.ticket-number')).toHaveText(number);
  await lab.getByRole('button', { name: /Start/ }).click();
  await lab.getByRole('button', { name: 'Done: send to Consultation' }).click();

  await expect(doctor.getByRole('listitem').filter({ hasText: number })).toBeVisible();
});

test('recall, then no-show, frees the room for the next patient (FR-8)', async ({ browser }) => {
  const desk = await staff(browser, 'frontdesk');
  const first = await issueTicket(desk, 'Triage');
  const second = await issueTicket(desk, 'Triage');
  const nurse = await staff(browser, 'nurse');
  await atCounter(nurse, 'Triage Room');
  await nurse.getByRole('button', { name: 'Call next' }).click();
  await expect(nurse.locator('.ticket-number')).toHaveText(first);
  await nurse.getByRole('button', { name: 'Recall' }).click();
  await nurse.getByRole('button', { name: 'No-show' }).click();
  await nurse.getByRole('button', { name: 'Call next' }).click();
  await expect(nurse.locator('.ticket-number')).toHaveText(second);
});

test('a paused room cannot call until it resumes (FR-9)', async ({ browser }) => {
  const desk = await staff(browser, 'frontdesk');
  await issueTicket(desk, 'Triage');
  const nurse = await staff(browser, 'nurse');
  await atCounter(nurse, 'Triage Room');
  await nurse.getByRole('button', { name: 'Pause for a break' }).click();
  await expect(nurse.getByRole('button', { name: 'Call next' })).toBeDisabled();
  await expect(nurse.getByText('You are on a break')).toBeVisible();
  await nurse.getByRole('button', { name: 'Resume' }).click();
  await expect(nurse.getByRole('button', { name: 'Call next' })).toBeEnabled();
});

test('a manager sets a daily limit and the front desk is stopped at it (FR-14)', async ({
  browser,
}) => {
  const admin = await staff(browser, 'admin');
  await admin.getByRole('link', { name: /Settings/ }).click();
  await admin.getByLabel('Pharmacy').fill('1');
  await admin.getByRole('button', { name: 'Save settings' }).click();
  await expect(admin.getByText('Saved.')).toBeVisible();

  const desk = await staff(browser, 'frontdesk');
  await issueTicket(desk, 'Pharmacy');
  await desk.getByRole('button', { name: 'Issue Pharmacy ticket' }).click();
  await expect(desk.getByText("Pharmacy has reached today's ticket limit")).toBeVisible();
});

test('staff cannot open settings, and a wrong password is refused (FR-21)', async ({ page }) => {
  await login(page, 'nurse', 'wrong-password');
  await expect(page.getByText('Wrong email or password')).toBeVisible();
  await login(page, 'nurse');
  await expect(page.getByRole('link', { name: /Staff console/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Settings/ })).toHaveCount(0);
});
