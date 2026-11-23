/** How many recent service times the estimate averages (design doc: last 20 customers). */
export const SERVICE_TIME_WINDOW = 20;

/**
 * Average of the most recent service times in milliseconds.
 * `recentFirst` lists durations newest first. Falls back when there is no history yet.
 */
export function averageServiceTime(
  recentFirst: readonly number[],
  fallbackMs: number,
  window = SERVICE_TIME_WINDOW,
): number {
  const sample = recentFirst.filter((d) => Number.isFinite(d) && d > 0).slice(0, window);
  if (sample.length === 0) return fallbackMs;
  return sample.reduce((sum, d) => sum + d, 0) / sample.length;
}

/**
 * Estimated wait in whole minutes, rounded up (FR-12):
 * people ahead / counters open for the service x average service time.
 * Returns null when no counter is open, because no honest estimate exists.
 */
export function estimateWaitMinutes(input: {
  peopleAhead: number;
  countersOpen: number;
  averageServiceMs: number;
}): number | null {
  const { peopleAhead, countersOpen, averageServiceMs } = input;
  if (countersOpen <= 0) return null;
  if (peopleAhead <= 0) return 0;
  const ms = (peopleAhead / countersOpen) * averageServiceMs;
  return Math.ceil(ms / 60_000);
}
