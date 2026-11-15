/**
 * NASA POWER daily point reads for air temperature and wind.
 *
 * POWER is the keyless fallback when Meteomatics is not configured or fails.
 * Values are daily means for the requested UTC date (T2M in °C, WS10M in m/s).
 * A missing day or the fill value -999 is no reading. Successful values are
 * cached in this isolate: completed days (two or more days old) for 30 days,
 * and today, yesterday, or a future day for one day. Failures are not stored.
 * The cache key is the layer, coordinates rounded to 4 decimal places, the
 * UTC day, and the time standard. It never includes a credential.
 */

export const POWER_NO_READING = "No reading for this place and time.";
export const POWER_UNREACHABLE = "The data service could not be reached.";
export const POWER_CACHE_MAX_ENTRIES = 256;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAST_TTL_MS = 30 * DAY_MS;

export const POWER_PARAMETERS = {
  "air-temp": { parameter: "T2M", unit: "°C" },
  wind: { parameter: "WS10M", unit: "m/s" },
} as const;

export type PowerLayer = keyof typeof POWER_PARAMETERS;

export interface PowerBody {
  readonly layer: PowerLayer;
  readonly value: number;
  readonly unit: string;
  readonly time: string;
  readonly lat: number;
  readonly lon: number;
  readonly source: "POWER";
  readonly resolution: "daily";
}

export type PowerResult =
  | { readonly ok: true; readonly body: PowerBody; readonly cacheControl: string }
  | { readonly ok: false; readonly status: 404 | 502; readonly error: string };

interface Entry {
  readonly value: number;
  readonly expiresAt: number;
}

export function isPowerLayer(layer: string): layer is PowerLayer {
  return Object.hasOwn(POWER_PARAMETERS, layer);
}

export function powerDay(time: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.exec(time);
  if (!match || Number.isNaN(Date.parse(time))) return null;
  return `${match[1]}${match[2]}${match[3]}`;
}

export function powerCacheKey(layer: string, lat: number, lon: number, day: string): string {
  return `${layer}|${lat.toFixed(4)}|${lon.toFixed(4)}|${day}|UTC`;
}

/** Completed days stay for 30 days. A range that includes a recent day stays for one day. */
export function powerTtlMs(day: string, now = Date.now()): number {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(4, 6));
  const date = Number(day.slice(6, 8));
  if (!year || month < 1 || month > 12 || date < 1 || date > 31) return DAY_MS;
  const dayStart = Date.UTC(year, month - 1, date);
  const today = new Date(now);
  const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if ((todayStart - dayStart) / DAY_MS >= 2) return PAST_TTL_MS;
  return DAY_MS;
}

export function powerCacheControl(ttlMs: number): string {
  const seconds = Math.max(1, Math.round(ttlMs / 1000));
  const staleSeconds = ttlMs >= PAST_TTL_MS ? 24 * 60 * 60 : 60 * 60;
  return `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${staleSeconds}`;
}

export function powerPointUrl(lat: number, lon: number, parameter: string, day: string): string {
  const url = new URL("https://power.larc.nasa.gov/api/temporal/daily/point");
  url.searchParams.set("parameters", parameter);
  url.searchParams.set("community", "RE");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  url.searchParams.set("start", day);
  url.searchParams.set("end", day);
  url.searchParams.set("format", "JSON");
  url.searchParams.set("time-standard", "UTC");
  return url.toString();
}

export function parsePowerDaily(body: unknown, parameter: string, day: string): number | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { header?: { fill_value?: unknown }; properties?: { parameter?: unknown } };
  const table = record.properties?.parameter;
  if (!table || typeof table !== "object") return null;
  const series = (table as Record<string, unknown>)[parameter];
  if (!series || typeof series !== "object") return null;
  const value = (series as Record<string, unknown>)[day];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const fill = record.header?.fill_value;
  if (value === -999 || (typeof fill === "number" && value === fill)) return null;
  return value;
}

export class PowerValueCache {
  private readonly entries = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<number | null>>();

  constructor(
    private readonly maxEntries = POWER_CACHE_MAX_ENTRIES,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): number | undefined {
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

  set(key: string, value: number, ttlMs: number): void {
    if (!(ttlMs > 0)) return;
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    const now = this.now();
    for (const [stored, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(stored);
    }
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  async getOrLoad(key: string, ttlMs: number, load: () => Promise<number | null>): Promise<number | null> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const job = load()
      .then((value) => {
        if (value !== null) this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        if (this.inflight.get(key) === job) this.inflight.delete(key);
      });
    this.inflight.set(key, job);
    return job;
  }

  clear(): void {
    this.entries.clear();
    this.inflight.clear();
  }
}

const powerCache = new PowerValueCache();

export function clearPowerCache(): void {
  powerCache.clear();
}

async function fetchPowerValue(lat: number, lon: number, parameter: string, day: string): Promise<number | null> {
  const response = await fetch(powerPointUrl(lat, lon, parameter, day), {
    headers: { Accept: "application/json", "User-Agent": "SonifySphere (educational prototype)" },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (response.status >= 400 && response.status < 500) return null;
  if (!response.ok) throw new Error("POWER request failed");
  return parsePowerDaily(await response.json(), parameter, day);
}

export async function readPowerPoint(input: { layer: string; lat: number; lon: number; time: string }, now = Date.now()): Promise<PowerResult> {
  if (!isPowerLayer(input.layer)) return { ok: false, status: 404, error: POWER_NO_READING };
  const day = powerDay(input.time);
  if (!day) return { ok: false, status: 404, error: POWER_NO_READING };
  const spec = POWER_PARAMETERS[input.layer];
  const ttlMs = powerTtlMs(day, now);
  try {
    const value = await powerCache.getOrLoad(
      powerCacheKey(input.layer, input.lat, input.lon, day),
      ttlMs,
      () => fetchPowerValue(input.lat, input.lon, spec.parameter, day),
    );
    if (value === null) return { ok: false, status: 404, error: POWER_NO_READING };
    return {
      ok: true,
      cacheControl: powerCacheControl(ttlMs),
      body: {
        layer: input.layer,
        value,
        unit: spec.unit,
        time: input.time,
        lat: input.lat,
        lon: input.lon,
        source: "POWER",
        resolution: "daily",
      },
    };
  } catch {
    return { ok: false, status: 502, error: POWER_UNREACHABLE };
  }
}
