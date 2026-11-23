/**
 * The site's calendar day for a moment, as a Date at UTC midnight (what Prisma stores in a
 * `@db.Date` column). Ticket numbers restart each local day.
 */
export function siteDay(at: Date, timeZone: string): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
  return new Date(`${ymd}T00:00:00.000Z`);
}
