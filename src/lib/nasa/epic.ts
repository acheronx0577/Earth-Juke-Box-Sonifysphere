import { nasaGet, nasaQuotaExhausted, NasaRequestError, preferNasaCache } from "@/lib/nasa/apiKey";
import type { EpicDatesResult, EpicFrame, EpicFramesResult, EpicImageResult } from "@/lib/nasa/epicTypes";

const EPIC_API = "https://api.nasa.gov/EPIC/api/natural";
const FRAME_TTL = 30 * 24 * 60 * 60 * 1000;
const DATES_TTL = 24 * 60 * 60 * 1000;
const IMAGE_TTL = FRAME_TTL;
const IMAGE_CAP = 8;
const IMAGE_NAME = /^epic_[a-z0-9]+(?:_[a-z0-9]+)*$/i;

const ATTRIBUTION = "NASA EPIC (DSCOVR)";
const LICENSE = "Public domain (US government work)";

export class EpicError extends Error {
  readonly status: 400 | 404 | 429 | 502 | 504;

  constructor(status: EpicError["status"], message: string) {
    super(message);
    this.name = "EpicError";
    this.status = status;
  }
}

interface CacheEntry<T> {
  at: number;
  value: T;
}

let clock = () => Date.now();
const frameCache = new Map<string, CacheEntry<EpicFrame[]>>();
let dateCache: CacheEntry<string[]> | null = null;
const imageCache = new Map<string, CacheEntry<{ bytes: Uint8Array; type: string }>>();

export function isEpicDate(value: string, today = clock()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 2015) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
  const now = new Date(today);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return date.getTime() <= end;
}

export function isEpicImageName(value: string): boolean {
  return IMAGE_NAME.test(value);
}

export async function loadEpicDates(count: number): Promise<EpicDatesResult> {
  const dates = await availableDates();
  return {
    source: "NASA EPIC",
    cached: dates.cached,
    stale: dates.stale,
    dates: dates.value.slice(-count),
  };
}

export async function loadEpicFrames(date: string | null): Promise<EpicFramesResult> {
  const resolved = date ?? (await availableDates()).value.at(-1) ?? null;
  if (!resolved || !isEpicDate(resolved)) {
    throw new EpicError(404, "No EPIC frames for this date.");
  }
  const frames = await framesFor(resolved);
  if (frames.value.length === 0) throw new EpicError(404, "No EPIC frames for this date.");
  return {
    source: "NASA EPIC",
    layer: "epic-natural",
    date: resolved,
    quality: "image-derived",
    cached: frames.cached,
    stale: frames.stale,
    attribution: ATTRIBUTION,
    license: LICENSE,
    frames: frames.value,
  };
}

export async function loadEpicImage(date: string, name: string): Promise<EpicImageResult> {
  if (!isEpicDate(date)) throw new EpicError(400, "Provide a valid UTC date.");
  if (!isEpicImageName(name)) throw new EpicError(400, "Provide a valid frame.");
  const key = `${date}/${name}`;
  const saved = read(imageCache.get(key), IMAGE_TTL);
  if (saved) return { ...saved.value, cached: true, stale: saved.stale };
  if (nasaQuotaExhausted()) throw new EpicError(429, "Too many requests, try again in a minute");

  const [year, month, day] = date.split("-");
  const endpoint = new URL(`https://api.nasa.gov/EPIC/archive/natural/${year}/${month}/${day}/png/${name}.png`);
  let response: Response;
  try {
    response = await nasaGet(endpoint, "image/png,image/*;q=0.8");
  } catch (error) {
    const fallback = imageCache.get(key);
    if (fallback && preferNasaCache()) return { ...fallback.value, cached: true, stale: true };
    throw asEpicError(error);
  }
  if (response.status === 429 || nasaQuotaExhausted()) {
    const fallback = imageCache.get(key);
    if (fallback) return { ...fallback.value, cached: true, stale: true };
    throw new EpicError(429, "Too many requests, try again in a minute");
  }
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.startsWith("image/")) {
    const fallback = imageCache.get(key);
    if (fallback && preferNasaCache()) return { ...fallback.value, cached: true, stale: true };
    throw new EpicError(response.status === 404 ? 404 : 502, response.status === 404 ? "No EPIC frames for this date." : "The data service could not be reached");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  rememberImage(key, { bytes, type });
  return { bytes, type, cached: false, stale: false };
}

export function resetEpicCacheForTests(): void {
  frameCache.clear();
  dateCache = null;
  imageCache.clear();
  clock = () => Date.now();
}

export function setEpicClockForTests(next: () => number): void {
  clock = next;
}

async function availableDates(): Promise<{ value: string[]; cached: boolean; stale: boolean }> {
  const saved = read(dateCache ?? undefined, DATES_TTL);
  if (saved) return saved;
  if (nasaQuotaExhausted()) throw new EpicError(429, "Too many requests, try again in a minute");
  let response: Response;
  try {
    response = await nasaGet(new URL(`${EPIC_API}/all`));
  } catch (error) {
    if (dateCache && preferNasaCache()) return { value: dateCache.value, cached: true, stale: true };
    throw asEpicError(error);
  }
  if (response.status === 429) {
    if (dateCache) return { value: dateCache.value, cached: true, stale: true };
    throw new EpicError(429, "Too many requests, try again in a minute");
  }
  if (!response.ok) {
    if (dateCache && preferNasaCache()) return { value: dateCache.value, cached: true, stale: true };
    throw new EpicError(502, "The data service could not be reached");
  }
  const dates = parseDates(await response.json());
  if (dates.length === 0) throw new EpicError(404, "No EPIC frames for this date.");
  dateCache = { at: clock(), value: dates };
  return { value: dates, cached: false, stale: false };
}

async function framesFor(date: string): Promise<{ value: EpicFrame[]; cached: boolean; stale: boolean }> {
  const saved = read(frameCache.get(date), FRAME_TTL);
  if (saved) return saved;
  if (nasaQuotaExhausted()) throw new EpicError(429, "Too many requests, try again in a minute");
  let response: Response;
  try {
    response = await nasaGet(new URL(`${EPIC_API}/date/${date}`));
  } catch (error) {
    const fallback = frameCache.get(date);
    if (fallback && preferNasaCache()) return { value: fallback.value, cached: true, stale: true };
    throw asEpicError(error);
  }
  if (response.status === 429) {
    const fallback = frameCache.get(date);
    if (fallback) return { value: fallback.value, cached: true, stale: true };
    throw new EpicError(429, "Too many requests, try again in a minute");
  }
  if (response.status === 404) throw new EpicError(404, "No EPIC frames for this date.");
  if (!response.ok) {
    const fallback = frameCache.get(date);
    if (fallback && preferNasaCache()) return { value: fallback.value, cached: true, stale: true };
    throw new EpicError(502, "The data service could not be reached");
  }
  const frames = parseFrames(await response.json(), date);
  if (frames.length > 0) frameCache.set(date, { at: clock(), value: frames });
  return { value: frames, cached: false, stale: false };
}

function read<T>(entry: CacheEntry<T> | undefined, ttl: number): { value: T; cached: true; stale: boolean } | null {
  if (!entry) return null;
  const age = clock() - entry.at;
  if (age <= ttl) return { value: entry.value, cached: true, stale: false };
  if (preferNasaCache() || nasaQuotaExhausted()) return { value: entry.value, cached: true, stale: true };
  return null;
}

function rememberImage(key: string, value: { bytes: Uint8Array; type: string }): void {
  imageCache.delete(key);
  imageCache.set(key, { at: clock(), value });
  while (imageCache.size > IMAGE_CAP) {
    const oldest = imageCache.keys().next().value;
    if (oldest === undefined) break;
    imageCache.delete(oldest);
  }
}

function parseDates(body: unknown): string[] {
  if (!Array.isArray(body)) return [];
  const dates = body.flatMap((item) => {
    const date = typeof item === "object" && item && "date" in item && typeof item.date === "string" ? item.date : "";
    return isEpicDate(date) ? [date] : [];
  });
  dates.sort();
  return dates;
}

function parseFrames(body: unknown, date: string): EpicFrame[] {
  if (!Array.isArray(body)) throw new EpicError(502, "The data service could not be reached");
  return body.flatMap((item) => {
    if (typeof item !== "object" || !item) return [];
    const row = item as {
      identifier?: unknown;
      caption?: unknown;
      image?: unknown;
      date?: unknown;
      centroid_coordinates?: { lat?: unknown; lon?: unknown };
    };
    const name = typeof row.image === "string" ? row.image : "";
    if (!isEpicImageName(name)) return [];
    const lat = row.centroid_coordinates?.lat;
    const lon = row.centroid_coordinates?.lon;
    const centroid = typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon)
      ? { lat, lon }
      : null;
    const caption = typeof row.caption === "string" ? row.caption.replace(/\s+/g, " ").trim().slice(0, 400) : "EPIC natural color";
    return [{
      id: typeof row.identifier === "string" && row.identifier ? row.identifier : name,
      caption: caption || "EPIC natural color",
      time: epicTime(typeof row.date === "string" ? row.date : "", date),
      centroid,
      image: `/api/listen/epic/image?date=${encodeURIComponent(date)}&name=${encodeURIComponent(name)}`,
    }];
  });
}

function epicTime(value: string, date: string): string {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withZone = /Z$|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const parsed = Date.parse(withZone);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return `${date}T00:00:00.000Z`;
}

function asEpicError(error: unknown): EpicError {
  if (error instanceof EpicError) return error;
  if (error instanceof NasaRequestError) return new EpicError(error.status, "The data service could not be reached");
  return new EpicError(502, "The data service could not be reached");
}
