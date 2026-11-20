/**
 * Open-Meteo point elevation from the Copernicus DEM GLO-90.
 *
 * The API is keyless. Ocean and sea level come back as 0, and inland
 * depressions come back negative. Both are readings. Only a missing or
 * non-finite value is empty. Successful values are cached in this isolate
 * for 30 days. The key is the layer and coordinates rounded to 4 decimal
 * places. It does not include the probe time, because the DEM does not
 * change with the timeline, and it never includes a credential.
 */

export const ELEVATION_NO_READING = "No reading for this place and time.";
export const ELEVATION_UNREACHABLE = "The data service could not be reached.";
const DAY_MS = 24 * 60 * 60 * 1000;
const TTL_MS = 30 * DAY_MS;
const CACHE_MAX = 256;

export interface ElevationBody {
  readonly layer: "elevation";
  readonly value: number;
  readonly unit: "m";
  readonly time: string;
  readonly lat: number;
  readonly lon: number;
  readonly source: "Open-Meteo";
  readonly resolution: "dem";
}

export type ElevationResult =
  | { readonly ok: true; readonly body: ElevationBody; readonly cacheControl: string }
  | { readonly ok: false; readonly status: 404 | 502; readonly error: string };

interface Entry {
  readonly value: number;
  readonly expiresAt: number;
}

export function isElevationLayer(layer: string): layer is "elevation" {
  return layer === "elevation";
}

export function elevationPointUrl(lat: number, lon: number): string {
  const url = new URL("https://api.open-meteo.com/v1/elevation");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  return url.toString();
}

/** One elevation in metres. Zero and negative values are real terrain. */
export function parseOpenMeteoElevation(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const elevation = (body as { elevation?: unknown }).elevation;
  const value = Array.isArray(elevation) ? elevation[0] : elevation;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function elevationCacheKey(lat: number, lon: number): string {
  return `elevation|${lat.toFixed(4)}|${lon.toFixed(4)}`;
}

export function elevationCacheControl(): string {
  const seconds = Math.round(TTL_MS / 1000);
  return `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${24 * 60 * 60}`;
}

export class ElevationValueCache {
  private readonly entries = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<number | null>>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(maxEntries = CACHE_MAX, now: () => number = Date.now) {
    this.maxEntries = maxEntries;
    this.now = now;
  }

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

const elevationCache = new ElevationValueCache();

export function clearElevationCache(): void {
  elevationCache.clear();
}

async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  const response = await fetch(elevationPointUrl(lat, lon), {
    headers: { Accept: "application/json", "User-Agent": "SonifySphere (educational prototype)" },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (response.status >= 400 && response.status < 500) return null;
  if (!response.ok) throw new Error("Elevation request failed");
  return parseOpenMeteoElevation(await response.json());
}

export async function readElevationPoint(input: { lat: number; lon: number; time: string }): Promise<ElevationResult> {
  try {
    const value = await elevationCache.getOrLoad(
      elevationCacheKey(input.lat, input.lon),
      TTL_MS,
      () => fetchElevation(input.lat, input.lon),
    );
    if (value === null) return { ok: false, status: 404, error: ELEVATION_NO_READING };
    return {
      ok: true,
      cacheControl: elevationCacheControl(),
      body: {
        layer: "elevation",
        value,
        unit: "m",
        time: input.time,
        lat: input.lat,
        lon: input.lon,
        source: "Open-Meteo",
        resolution: "dem",
      },
    };
  } catch {
    return { ok: false, status: 502, error: ELEVATION_UNREACHABLE };
  }
}
