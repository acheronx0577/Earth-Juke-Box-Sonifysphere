/**
 * Per-instance fixed-window limiter for metered Listen routes.
 *
 * Vercel isolates do not share memory, so this stops a burst on one warm
 * function. A durable counter waits for Azure. The key is the client address
 * only; credentials are never stored or logged.
 */

export const RATE_LIMIT_MESSAGE = "Too many requests, try again in a minute";

/** Above the Listen probe debounce (350ms, about 3/s) so a person dragging the map is not cut off. */
export const MEASUREMENTS_LIMIT = 360;
export const MEASUREMENTS_WINDOW_MS = 60_000;

/** Sound generation is a metered call with a long timeout, so the burst cap is small. */
export const SOUND_VARIATION_LIMIT = 6;
export const SOUND_VARIATION_WINDOW_MS = 60_000;

const MAX_BUCKETS = 4096;

export type RateLimitDecision =
  | { readonly ok: true }
  | { readonly ok: false; readonly retryAfterSeconds: number };

interface Bucket {
  windowStart: number;
  count: number;
}

export function clientIp(getHeader: (name: string) => string | null): string {
  const real = getHeader("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = getHeader("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export class FixedWindowRateLimit {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly maxBuckets = MAX_BUCKETS,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitDecision {
    const now = this.now();
    const existing = this.buckets.get(key);
    if (!existing || now - existing.windowStart >= this.windowMs) {
      this.buckets.delete(key);
      this.buckets.set(key, { windowStart: now, count: 1 });
      this.trim();
      return { ok: true };
    }
    if (existing.count >= this.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.windowStart + this.windowMs - now) / 1000));
      return { ok: false, retryAfterSeconds };
    }
    existing.count += 1;
    return { ok: true };
  }

  clear(): void {
    this.buckets.clear();
  }

  private trim(): void {
    while (this.buckets.size > this.maxBuckets) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) break;
      this.buckets.delete(oldest);
    }
  }
}

export const measurementsRateLimit = new FixedWindowRateLimit(MEASUREMENTS_LIMIT, MEASUREMENTS_WINDOW_MS);
export const soundVariationRateLimit = new FixedWindowRateLimit(SOUND_VARIATION_LIMIT, SOUND_VARIATION_WINDOW_MS);
