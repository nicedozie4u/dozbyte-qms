/**
 * Slows down password guessing: after too many failed logins for one email from one address,
 * or from one address overall, further attempts are refused for a while. Kept in memory: a
 * site server is one process, and a restart clearing it is acceptable.
 */
export interface LimiterOptions {
  windowMs: number;
  maxPerAccount: number;
  maxPerAddress: number;
}

export const DEFAULT_LIMITS: LimiterOptions = {
  windowMs: 15 * 60_000,
  maxPerAccount: 5,
  maxPerAddress: 20,
};

export class LoginLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly opts: LimiterOptions = DEFAULT_LIMITS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Milliseconds until another attempt is allowed, or 0 if one is allowed now. */
  retryAfterMs(email: string, ip: string): number {
    return Math.max(
      this.wait(this.accountKey(email, ip), this.opts.maxPerAccount),
      this.wait(this.addressKey(ip), this.opts.maxPerAddress),
    );
  }

  recordFailure(email: string, ip: string): void {
    for (const key of [this.accountKey(email, ip), this.addressKey(ip)]) {
      this.failures.set(key, [...this.recent(key), this.now()]);
    }
  }

  recordSuccess(email: string, ip: string): void {
    this.failures.delete(this.accountKey(email, ip));
  }

  private wait(key: string, max: number): number {
    const times = this.recent(key);
    if (times.length < max) return 0;
    const oldestCounted = times[times.length - max] ?? this.now();
    return Math.max(0, oldestCounted + this.opts.windowMs - this.now());
  }

  private recent(key: string): number[] {
    const cutoff = this.now() - this.opts.windowMs;
    const times = (this.failures.get(key) ?? []).filter((t) => t > cutoff);
    if (times.length) this.failures.set(key, times);
    else this.failures.delete(key);
    return times;
  }

  private accountKey(email: string, ip: string) {
    return `acct:${email.toLowerCase()}|${ip}`;
  }

  private addressKey(ip: string) {
    return `addr:${ip}`;
  }
}
