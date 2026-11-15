/** NASA EONET v3. No API key. */

const EONET = "https://eonet.gsfc.nasa.gov/api/v3/events";
const TTL = 15 * 60 * 1000;

export const EONET_CATEGORIES = [
  "drought",
  "dustHaze",
  "earthquakes",
  "floods",
  "landslides",
  "manmade",
  "seaLakeIce",
  "severeStorms",
  "snow",
  "tempExtremes",
  "volcanoes",
  "waterColor",
  "wildfires",
] as const;

export type EonetCategory = (typeof EONET_CATEGORIES)[number];

export interface EonetQuery {
  readonly status: "open" | "closed" | "all";
  readonly days: number;
  readonly category: EonetCategory | null;
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
  readonly limit: number;
}

export interface EonetEvent {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly categoryTitle: string;
  readonly open: boolean;
  readonly magnitude: number | null;
  readonly magnitudeUnit: string | null;
  readonly time: string;
  readonly lat: number;
  readonly lon: number;
  readonly link: string;
}

export interface EonetResult {
  readonly source: "NASA EONET";
  readonly quality: "measured";
  readonly cached: boolean;
  readonly stale: boolean;
  readonly attribution: string;
  readonly license: string;
  readonly bbox: readonly [number, number, number, number];
  readonly events: readonly EonetEvent[];
}

export class EonetError extends Error {
  readonly status: 400 | 502 | 504;

  constructor(status: EonetError["status"], message: string) {
    super(message);
    this.name = "EonetError";
    this.status = status;
  }
}

interface CacheEntry {
  at: number;
  events: EonetEvent[];
}

let clock = () => Date.now();
const cache = new Map<string, CacheEntry>();

export function parseEonetQuery(params: URLSearchParams): EonetQuery {
  const status = params.get("status") ?? "open";
  if (status !== "open" && status !== "closed" && status !== "all") {
    throw new EonetError(400, "Provide an event status of open, closed, or all.");
  }
  const days = params.has("days") ? Number(params.get("days")) : 30;
  if (!Number.isInteger(days) || days < 1 || days > 120) {
    throw new EonetError(400, "Provide a day count from 1 to 120.");
  }
  const categoryRaw = params.get("category");
  if (categoryRaw && !EONET_CATEGORIES.includes(categoryRaw as EonetCategory)) {
    throw new EonetError(400, "Provide a known event category.");
  }
  const limit = params.has("limit") ? Number(params.get("limit")) : 40;
  if (!Number.isInteger(limit) || limit < 1 || limit > 40) {
    throw new EonetError(400, "Provide a limit from 1 to 40.");
  }
  const bbox = parseBbox(params.get("bbox"));
  return {
    status,
    days,
    category: (categoryRaw as EonetCategory | null) ?? null,
    limit,
    ...bbox,
  };
}

export async function loadEonetEvents(query: EonetQuery): Promise<EonetResult> {
  const key = cacheKey(query);
  const saved = cache.get(key);
  const age = saved ? clock() - saved.at : Number.POSITIVE_INFINITY;
  if (saved && age <= TTL) return result(query, saved.events, true, false);
  try {
    const events = await fetchEvents(query);
    cache.set(key, { at: clock(), events });
    return result(query, events, false, false);
  } catch (error) {
    if (saved) return result(query, saved.events, true, true);
    if (error instanceof EonetError) throw error;
    throw new EonetError(502, "The data service could not be reached");
  }
}

export function resetEonetCacheForTests(): void {
  cache.clear();
  clock = () => Date.now();
}

export function setEonetClockForTests(next: () => number): void {
  clock = next;
}

function parseBbox(value: string | null): Pick<EonetQuery, "west" | "south" | "east" | "north"> {
  const parts = (value ?? "").split(",").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new EonetError(400, "Provide a view as west, south, east, north.");
  }
  const [west, south, east, north] = parts;
  if (west < -180 || east > 180 || south < -90 || north > 90 || south > north) {
    throw new EonetError(400, "Provide a view as west, south, east, north.");
  }
  if (west > east) throw new EonetError(400, "The view must not cross the date line.");
  return { west, south, east, north };
}

async function fetchEvents(query: EonetQuery): Promise<EonetEvent[]> {
  const url = new URL(EONET);
  url.searchParams.set("status", query.status);
  url.searchParams.set("days", String(query.days));
  url.searchParams.set("limit", String(query.limit));
  url.searchParams.set("bbox", [query.west, query.south, query.east, query.north].map((part) => trim(part)).join(","));
  if (query.category) url.searchParams.set("category", query.category);
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: "application/json",
        "User-Agent": "SonifySphere/0.1 (NASA Space Apps prototype)",
      },
    });
  } catch (error) {
    const status = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? 504 : 502;
    throw new EonetError(status, "The data service could not be reached");
  }
  if (!response.ok) throw new EonetError(502, "The data service could not be reached");
  return parseEvents(await response.json(), query);
}

function parseEvents(body: unknown, query: EonetQuery): EonetEvent[] {
  const events = typeof body === "object" && body && "events" in body ? body.events : null;
  if (!Array.isArray(events)) throw new EonetError(502, "The data service could not be reached");
  return events.flatMap((item) => {
    const event = normalizeEvent(item);
    if (!event) return [];
    if (event.lon < query.west || event.lon > query.east || event.lat < query.south || event.lat > query.north) return [];
    return [event];
  }).slice(0, query.limit);
}

function normalizeEvent(item: unknown): EonetEvent | null {
  if (typeof item !== "object" || !item) return null;
  const row = item as {
    id?: unknown;
    title?: unknown;
    link?: unknown;
    closed?: unknown;
    categories?: Array<{ id?: unknown; title?: unknown }>;
    geometry?: Array<{ date?: unknown; type?: unknown; coordinates?: unknown; magnitudeValue?: unknown; magnitudeUnit?: unknown }>;
  };
  const id = typeof row.id === "string" ? row.id : "";
  const title = typeof row.title === "string" ? row.title.replace(/\s+/g, " ").trim().slice(0, 180) : "";
  if (!id || !title) return null;
  const geometry = [...(row.geometry ?? [])].sort((a, b) => Date.parse(String(b.date ?? "")) - Date.parse(String(a.date ?? "")));
  const place = geometry.map(pointOf).find((point) => point !== null) ?? null;
  if (!place) return null;
  const latest = geometry[0];
  const magnitude = typeof latest?.magnitudeValue === "number" && Number.isFinite(latest.magnitudeValue) ? latest.magnitudeValue : null;
  const magnitudeUnit = magnitude !== null && typeof latest?.magnitudeUnit === "string" ? latest.magnitudeUnit.slice(0, 24) : null;
  const category = row.categories?.find((entry) => typeof entry?.id === "string");
  return {
    id,
    title,
    category: typeof category?.id === "string" ? category.id : "other",
    categoryTitle: typeof category?.title === "string" ? category.title : "Event",
    open: row.closed == null,
    magnitude,
    magnitudeUnit,
    time: typeof latest?.date === "string" && !Number.isNaN(Date.parse(latest.date)) ? new Date(latest.date).toISOString() : "",
    lat: place.lat,
    lon: place.lon,
    link: safeLink(id, row.link),
  };
}

function pointOf(geometry: { type?: unknown; coordinates?: unknown }): { lat: number; lon: number } | null {
  if (!Array.isArray(geometry.coordinates)) return null;
  if (geometry.type === "Point") return pair(geometry.coordinates);
  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates[0])) return ringCenter(geometry.coordinates[0]);
  return null;
}

function ringCenter(ring: unknown): { lat: number; lon: number } | null {
  if (!Array.isArray(ring)) return null;
  const points = ring.flatMap((item) => {
    const point = pair(item);
    return point ? [point] : [];
  });
  if (points.length === 0) return null;
  const closed = points.length > 1 && points[0].lat === points[points.length - 1].lat && points[0].lon === points[points.length - 1].lon;
  const unique = closed ? points.slice(0, -1) : points;
  const lon = unique.reduce((sum, point) => sum + point.lon, 0) / unique.length;
  const lat = unique.reduce((sum, point) => sum + point.lat, 0) / unique.length;
  return { lat, lon };
}

function pair(value: unknown): { lat: number; lon: number } | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = value[0];
  const lat = value[1];
  if (typeof lon !== "number" || typeof lat !== "number" || !Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

function safeLink(id: string, link: unknown): string {
  const fallback = `https://eonet.gsfc.nasa.gov/api/v3/events/${encodeURIComponent(id)}`;
  if (typeof link !== "string") return fallback;
  try {
    const url = new URL(link);
    if (url.protocol !== "https:") return fallback;
    if (url.hostname !== "eonet.gsfc.nasa.gov" && url.hostname !== "earthobservatory.nasa.gov") return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function result(query: EonetQuery, events: readonly EonetEvent[], cached: boolean, stale: boolean): EonetResult {
  return {
    source: "NASA EONET",
    quality: "measured",
    cached,
    stale,
    attribution: "NASA Earth Observatory Natural Event Tracker (EONET) v3",
    license: "Public domain (US government work)",
    bbox: [trim(query.west), trim(query.south), trim(query.east), trim(query.north)],
    events,
  };
}

function cacheKey(query: EonetQuery): string {
  return [
    query.status,
    query.days,
    query.category ?? "",
    query.limit,
    trim(query.west),
    trim(query.south),
    trim(query.east),
    trim(query.north),
  ].join("|");
}

function trim(value: number): number {
  return Number(value.toFixed(4));
}
