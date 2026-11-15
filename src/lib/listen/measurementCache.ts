/**
 * In-isolate cache for normalized Meteomatics readings.
 *
 * The key is the layer, latitude and longitude rounded to 4 decimal places
 * (the same coordinates already sent upstream), and the requested UTC instant.
 * Instants older than one hour are kept for 30 days. The current hour and any
 * forecast instant are kept for one hour. Failures are not stored.
 *
 * Entries live in this Node process, capped at 256, so a warm Vercel isolate
 * can answer a repeat probe without calling Meteomatics. The route also sets
 * CDN cache headers on successes. Nothing is written to disk (the serverless
 * filesystem does not persist), the key never includes credentials, and a
 * shared durable store waits for Azure.
 */

export const MEASUREMENT_COORD_DECIMALS = 4;
export const MEASUREMENT_CACHE_MAX_ENTRIES = 256;
export const MEASUREMENT_CURRENT_TTL_MS = 60 * 60 * 1000;
export const MEASUREMENT_CURRENT_WINDOW_MS = 60 * 60 * 1000;
export const MEASUREMENT_PAST_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface MeasurementCacheKeyInput {
  readonly layer: string;
  readonly lat: number;
  readonly lon: number;
  readonly time: string;
}

export interface CachedMeasurement {
  readonly value: number;
  readonly unit: string;
  readonly time: string;
}

interface Entry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

export function measurementCacheKey(input: MeasurementCacheKeyInput): string {
  const lat = input.lat.toFixed(MEASUREMENT_COORD_DECIMALS);
  const lon = input.lon.toFixed(MEASUREMENT_COORD_DECIMALS);
  return `${input.layer}|${lat}|${lon}|${input.time}`;
}

/** Long TTL for a past instant. One hour for the current hour and forecast. */
export function measurementTtlMs(requestedTime: string, now = Date.now()): number {
  const requested = Date.parse(requestedTime);
  if (Number.isNaN(requested) || requested > now - MEASUREMENT_CURRENT_WINDOW_MS) return MEASUREMENT_CURRENT_TTL_MS;
  return MEASUREMENT_PAST_TTL_MS;
}

export function measurementCacheControl(ttlMs: number): string {
  const seconds = Math.max(1, Math.round(ttlMs / 1000));
  const staleSeconds = ttlMs >= MEASUREMENT_PAST_TTL_MS ? 24 * 60 * 60 : 60;
  return `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${staleSeconds}`;
}

export class MeasurementCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly inflight = new Map<string, Promise<T>>();

  constructor(
    private readonly maxEntries = MEASUREMENT_CACHE_MAX_ENTRIES,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (!(ttlMs > 0)) return;
    const expiresAt = this.now() + ttlMs;
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt });
    this.evict();
  }

  /**
   * Return a fresh entry or run `load` once. Concurrent callers share that
   * one load. A rejection is not stored, so the next attempt calls `load` again.
   */
  async getOrLoad(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const job = load()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        if (this.inflight.get(key) === job) this.inflight.delete(key);
      });
    this.inflight.set(key, job);
    return job;
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.inflight.clear();
  }

  private evict(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

export const measurementCache = new MeasurementCache<CachedMeasurement>();
