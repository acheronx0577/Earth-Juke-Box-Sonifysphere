/**
 * Microsoft Planetary Computer reads for one collection: MODIS daily land
 * surface temperature. Calls stay on the server. Scale and offset come from
 * the scene's raster metadata, and fill values stay null.
 */

export const PC_COLLECTION = "modis-11A1-061";
export const PC_ASSET = "LST_Day_1km";
export const PC_SOURCE = "Microsoft Planetary Computer";
export const PC_LAYER = "land-surface-temperature";
export const PC_ATTRIBUTION =
  "MODIS Land Surface Temperature/Emissivity Daily (MOD11A1/MYD11A1) via Microsoft Planetary Computer";
export const PC_LICENSE = "https://planetarycomputer.microsoft.com/dataset/modis-11A1-061";
export const PC_QUALITY = "measured" as const;

export interface PcCollectionSpec {
  readonly id: string;
  readonly defaultAsset: string;
  readonly layer: string;
  readonly attribution: string;
  readonly license: string;
  readonly startDate: string;
  readonly documentedFills: readonly number[];
  readonly unitFallback: string;
}

export const PC_COLLECTIONS: Record<string, PcCollectionSpec> = {
  "modis-11A1-061": {
    id: "modis-11A1-061",
    defaultAsset: "LST_Day_1km",
    layer: "land-surface-temperature",
    attribution: "MODIS Land Surface Temperature/Emissivity Daily (MOD11A1/MYD11A1) via Microsoft Planetary Computer",
    license: "https://planetarycomputer.microsoft.com/dataset/modis-11A1-061",
    startDate: "2000-02-24",
    documentedFills: [0],
    unitFallback: "Kelvin",
  },
  "modis-14A1-061": {
    id: "modis-14A1-061",
    defaultAsset: "FireMask",
    layer: "thermal-anomalies",
    attribution: "MODIS Thermal Anomalies/Fire Daily (MOD14A1/MYD14A1) via Microsoft Planetary Computer",
    license: "https://planetarycomputer.microsoft.com/dataset/modis-14A1-061",
    startDate: "2000-02-24",
    documentedFills: [0],
    unitFallback: "class",
  },
  "sentinel-2-l2a": {
    id: "sentinel-2-l2a",
    defaultAsset: "B04",
    layer: "surface-reflectance",
    attribution: "Sentinel-2 Level-2A via Microsoft Planetary Computer",
    license: "https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a",
    startDate: "2015-06-27",
    documentedFills: [0],
    unitFallback: "reflectance",
  },
  "landsat-c2-l2": {
    id: "landsat-c2-l2",
    defaultAsset: "red",
    layer: "surface-reflectance",
    attribution: "Landsat Collection 2 Level-2 via Microsoft Planetary Computer",
    license: "https://planetarycomputer.microsoft.com/dataset/landsat-c2-l2",
    startDate: "1982-08-22",
    documentedFills: [0],
    unitFallback: "reflectance",
  },
  "era5-pds": {
    id: "era5-pds",
    defaultAsset: "air_temperature",
    layer: "air-temperature",
    attribution: "ECMWF ERA5 Reanalysis via Microsoft Planetary Computer",
    license: "https://planetarycomputer.microsoft.com/dataset/era5-pds",
    startDate: "1979-01-01",
    documentedFills: [-999],
    unitFallback: "Kelvin",
  },
  "noaa-cdr-sea-surface-temperature": {
    id: "noaa-cdr-sea-surface-temperature",
    defaultAsset: "sea_surface_temperature",
    layer: "sea-surface-temperature",
    attribution: "NOAA CDR Sea Surface Temperature via Microsoft Planetary Computer",
    license: "https://planetarycomputer.microsoft.com/dataset/noaa-cdr-sea-surface-temperature",
    startDate: "1981-09-01",
    documentedFills: [-999],
    unitFallback: "Celsius",
  },
};

const STAC_SEARCH = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
function stacItemsUrl(collection: string): string {
  return `https://planetarycomputer.microsoft.com/api/stac/v1/collections/${encodeURIComponent(collection)}/items`;
}
const DATA_POINT = "https://planetarycomputer.microsoft.com/api/data/v1/item/point";
const TIMEOUT_MS = 12_000;
const SEARCH_REVALIDATE_SECONDS = 6 * 60 * 60;
const POINT_REVALIDATE_SECONDS = 30 * 24 * 60 * 60;

/** Digital number 0 is the MODIS LST fill. This collection's STAC band omits nodata. */
const DOCUMENTED_FILLS = [0] as const;

export const INVALID_QUERY = "Provide a valid location, UTC time, and layer.";
export const NO_READING = "No reading for this place and time";
export const UNREACHABLE = "The data service could not be reached";
export const TOO_MANY = "Too many requests, try again in a minute";

export class ProviderError extends Error {
  readonly status: 404 | 429 | 502 | 504;

  constructor(
    status: 404 | 429 | 502 | 504,
    message: string,
    readonly sceneId: string | null = null,
    readonly date: string | null = null,
  ) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

export interface BandMeta {
  readonly scale: number;
  readonly offset: number;
  readonly nodata: number | null;
  readonly unit: string;
  readonly resolutionMeters: number | null;
}

export interface SceneSummary {
  readonly sceneId: string;
  readonly date: string;
  readonly time: string;
  readonly collection?: string;
  readonly asset: string;
  readonly scale: number;
  readonly offset: number;
  readonly nodata: number | null;
  readonly unit: string;
  readonly resolution: string | null;
}

export interface PointReading {
  readonly source: typeof PC_SOURCE;
  readonly layer: string;
  readonly value: number;
  readonly unit: string;
  readonly time: string;
  readonly date: string;
  readonly lat: number;
  readonly lon: number;
  readonly resolution: string | null;
  readonly quality: typeof PC_QUALITY;
  readonly cached: false;
  readonly attribution: string;
  readonly license: string;
  readonly sceneId: string;
  readonly collection: string;
  readonly asset: string;
}

interface ResolvedScene {
  readonly summary: SceneSummary;
  readonly band: BandMeta;
}

export function cacheControl(kind: "search" | "point"): string {
  if (kind === "search") return "public, s-maxage=21600, stale-while-revalidate=86400";
  return "public, s-maxage=2592000, stale-while-revalidate=604800";
}

export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Apply raster scale and offset. Fill, nodata, -999, and non-finite samples become null. */
export function scaleReading(raw: unknown, band: BandMeta, documentedFills: readonly number[] = DOCUMENTED_FILLS): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw === -999) return null;
  if (band.nodata !== null && Object.is(raw, band.nodata)) return null;
  if (documentedFills.includes(raw)) return null;
  const scaled = raw * band.scale + band.offset;
  if (!Number.isFinite(scaled)) return null;
  return Math.round(scaled * 10_000) / 10_000;
}

export function parseDay(input: string): string | null {
  const day = input.length === 10 ? input : input.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  if (input.length !== 10 && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(input)) return null;
  const parsed = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed)) return null;
  if (new Date(parsed).toISOString().slice(0, 10) !== day) return null;
  return day;
}

export function isSafeItemId(id: string): boolean {
  if (id.length < 1 || id.length > 180) return false;
  if (id.includes("..")) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id);
}

export interface ParsedQuery {
  readonly lat: number;
  readonly lon: number;
  readonly day: string | null;
  readonly limit: number;
  readonly item: string | null;
  readonly collection: string;
}

export function parseQuery(
  params: URLSearchParams,
  kind: "search" | "point",
  now = Date.now(),
): ParsedQuery | null {
  if (!params.has("lat") || !params.has("lon")) return null;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const collectionRaw = params.get("collection");
  const collection = collectionRaw === null || collectionRaw === "" ? PC_COLLECTION : collectionRaw;
  if (!Object.hasOwn(PC_COLLECTIONS, collection)) return null;
  const spec = PC_COLLECTIONS[collection];
  const itemRaw = params.get("item");
  const item = itemRaw === null || itemRaw === "" ? null : itemRaw;
  if (item !== null && !isSafeItemId(item)) return null;
  const timeRaw = params.get("time");
  const day = timeRaw === null || timeRaw === "" ? null : parseDay(timeRaw);
  if (timeRaw !== null && timeRaw !== "" && day === null) return null;
  if (day !== null && (day < spec.startDate || Date.parse(`${day}T00:00:00Z`) > now + 86_400_000)) return null;
  if (kind === "search" && day === null) return null;
  if (kind === "point" && day === null && item === null) return null;
  const limitRaw = params.get("limit");
  let limit = 1;
  if (limitRaw !== null && limitRaw !== "") {
    if (!/^[1-5]$/.test(limitRaw)) return null;
    limit = Number(limitRaw);
  }
  return { lat: roundCoord(lat), lon: roundCoord(lon), day, limit, item, collection };
}

export function sceneFromFeature(feature: unknown, collection = PC_COLLECTION): ResolvedScene | null {
  if (!feature || typeof feature !== "object") return null;
  const record = feature as Record<string, unknown>;
  const sceneId = record.id;
  if (typeof sceneId !== "string" || !isSafeItemId(sceneId)) return null;
  const properties = record.properties;
  if (!properties || typeof properties !== "object") return null;
  const time = sceneTime(properties as Record<string, unknown>);
  if (!time) return null;
  const assets = record.assets;
  if (!assets || typeof assets !== "object") return null;
  const spec = PC_COLLECTIONS[collection] ?? PC_COLLECTIONS[PC_COLLECTION];
  const assetRecord = assets as Record<string, unknown>;
  const assetKey = Object.hasOwn(assetRecord, spec.defaultAsset) ? spec.defaultAsset : Object.keys(assetRecord)[0] ?? PC_ASSET;
  const asset = assetRecord[assetKey];
  const band = bandFromAsset(asset, spec.unitFallback);
  if (!band) return null;
  return {
    band,
    summary: {
      sceneId,
      date: time.slice(0, 10),
      time,
      collection: spec.id,
      asset: assetKey,
      scale: band.scale,
      offset: band.offset,
      nodata: band.nodata ?? spec.documentedFills[0] ?? 0,
      unit: band.unit,
      resolution: band.resolutionMeters === null ? null : `${band.resolutionMeters} m`,
    },
  };
}

export async function searchScenes(query: ParsedQuery, fetchImpl: typeof fetch = fetch): Promise<SceneSummary[]> {
  if (!query.day) return [];
  const body = await fetchJson(
    STAC_SEARCH,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchBody(query, query.day)),
      next: { revalidate: SEARCH_REVALIDATE_SECONDS },
    },
    fetchImpl,
  );
  const features = featureList(body);
  return features
    .flatMap((feature) => {
      const scene = sceneFromFeature(feature, query.collection);
      return scene && scene.summary.date === query.day ? [scene.summary] : [];
    })
    .sort(compareScenes)
    .slice(0, query.limit);
}

export async function readPoint(query: ParsedQuery, fetchImpl: typeof fetch = fetch): Promise<PointReading> {
  const spec = PC_COLLECTIONS[query.collection] ?? PC_COLLECTIONS[PC_COLLECTION];
  const scene = query.item ? await loadItem(query.item, query.collection, fetchImpl) : await firstScene(query, fetchImpl);
  if (!scene) throw new ProviderError(404, NO_READING);
  if (query.day && scene.summary.date !== query.day) throw new ProviderError(404, NO_READING, scene.summary.sceneId, scene.summary.date);
  const point = await fetchJson(
    pointUrl(query.lon, query.lat, scene.summary.sceneId, spec.id, scene.summary.asset),
    { method: "GET", next: { revalidate: POINT_REVALIDATE_SECONDS } },
    fetchImpl,
  );
  const value = scaleReading(rawFromPoint(point), scene.band, spec.documentedFills);
  if (value === null) throw new ProviderError(404, NO_READING, scene.summary.sceneId, scene.summary.date);
  return {
    source: PC_SOURCE,
    layer: spec.layer,
    value,
    unit: scene.summary.unit,
    time: scene.summary.time,
    date: scene.summary.date,
    lat: query.lat,
    lon: query.lon,
    resolution: scene.summary.resolution,
    quality: PC_QUALITY,
    cached: false,
    attribution: spec.attribution,
    license: spec.license,
    sceneId: scene.summary.sceneId,
    collection: spec.id,
    asset: scene.summary.asset,
  };
}

export function noReadingBody(sceneId: string | null = null, date: string | null = null) {
  return { error: NO_READING, value: null as null, sceneId, date };
}

export function errorResult(error: unknown, kind: "search" | "point"): {
  status: number;
  body: { error: string; value?: null; sceneId?: string | null; date?: string | null };
  headers: HeadersInit;
} {
  if (error instanceof ProviderError) {
    const headers = error.status === 404 ? { "Cache-Control": cacheControl(kind) } : { "Cache-Control": "no-store" };
    if (error.status === 404) return { status: 404, body: noReadingBody(error.sceneId, error.date), headers };
    if (error.status === 429) return { status: 429, body: { error: TOO_MANY }, headers };
    if (error.status === 504) return { status: 504, body: { error: UNREACHABLE }, headers };
    return { status: 502, body: { error: UNREACHABLE }, headers };
  }
  return { status: 502, body: { error: UNREACHABLE }, headers: { "Cache-Control": "no-store" } };
}

function searchBody(query: ParsedQuery, day: string) {
  const spec = PC_COLLECTIONS[query.collection] ?? PC_COLLECTIONS[PC_COLLECTION];
  const assetName = spec.defaultAsset;
  return {
    collections: [query.collection],
    intersects: { type: "Point", coordinates: [query.lon, query.lat] },
    datetime: `${day}T00:00:00Z/${day}T23:59:59Z`,
    limit: 5,
    fields: {
      include: [
        "id",
        "properties.datetime",
        "properties.start_datetime",
        `assets.${assetName}.raster:bands`,
        `assets.${assetName}.title`,
      ],
      exclude: ["links", "geometry", "bbox", `assets.${assetName}.href`],
    },
  };
}

async function firstScene(query: ParsedQuery, fetchImpl: typeof fetch): Promise<ResolvedScene | null> {
  if (!query.day) return null;
  const body = await fetchJson(
    STAC_SEARCH,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchBody(query, query.day)),
      next: { revalidate: SEARCH_REVALIDATE_SECONDS },
    },
    fetchImpl,
  );
  const scenes = featureList(body)
    .flatMap((feature) => {
      const scene = sceneFromFeature(feature, query.collection);
      return scene && scene.summary.date === query.day ? [scene] : [];
    })
    .sort((a, b) => compareScenes(a.summary, b.summary));
  return scenes[0] ?? null;
}

async function loadItem(itemId: string, collection = PC_COLLECTION, fetchImpl: typeof fetch = fetch): Promise<ResolvedScene | null> {
  const body = await fetchJson(
    `${stacItemsUrl(collection)}/${encodeURIComponent(itemId)}`,
    { method: "GET", next: { revalidate: POINT_REVALIDATE_SECONDS } },
    fetchImpl,
  );
  return sceneFromFeature(body, collection);
}

function pointUrl(lon: number, lat: number, itemId: string, collection: string = PC_COLLECTION, asset: string = PC_ASSET): string {
  const params = new URLSearchParams({
    collection,
    item: itemId,
    assets: asset,
  });
  return `${DATA_POINT}/${lon.toFixed(2)},${lat.toFixed(2)}?${params.toString()}`;
}

function featureList(body: unknown): unknown[] {
  if (!body || typeof body !== "object" || !Array.isArray((body as { features?: unknown }).features)) {
    throw new ProviderError(502, UNREACHABLE);
  }
  return (body as { features: unknown[] }).features;
}

function rawFromPoint(body: unknown): unknown {
  if (!body || typeof body !== "object") return undefined;
  const values = (body as { values?: unknown }).values;
  if (!Array.isArray(values) || values.length === 0) return undefined;
  return values[0];
}

function bandFromAsset(asset: unknown, unitFallback = "Kelvin"): BandMeta | null {
  if (!asset || typeof asset !== "object") return null;
  const bands = (asset as { "raster:bands"?: unknown })["raster:bands"];
  if (!Array.isArray(bands) || !bands[0] || typeof bands[0] !== "object") return null;
  const band = bands[0] as Record<string, unknown>;
  const scale = finiteNumber(band.scale) ?? 1;
  const offset = band.offset === undefined ? 0 : (finiteNumber(band.offset) ?? 0);
  if (scale === 0) return null;
  const unit = typeof band.unit === "string" && band.unit.trim() ? band.unit.trim() : unitFallback;
  const resolution = finiteNumber(band.spatial_resolution);
  return {
    scale,
    offset,
    nodata: band.nodata === undefined || band.nodata === null ? null : finiteNumber(band.nodata),
    unit,
    resolutionMeters: resolution !== null && resolution > 0 ? resolution : null,
  };
}

function sceneTime(properties: Record<string, unknown>): string | null {
  for (const candidate of [properties.datetime, properties.start_datetime]) {
    if (typeof candidate !== "string") continue;
    const parsed = Date.parse(candidate);
    if (Number.isNaN(parsed)) continue;
    return new Date(parsed).toISOString().replace(".000Z", "Z");
  }
  return null;
}

function compareScenes(a: SceneSummary, b: SceneSummary): number {
  return a.time.localeCompare(b.time) || a.sceneId.localeCompare(b.sceneId);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchJson(url: string, init: RequestInit & { next?: { revalidate?: number } }, fetchImpl: typeof fetch): Promise<unknown> {
  let response: Response;
  const apiKey = process.env.PLANETARY_COMPUTER_API_KEY || process.env.PC_SDK_KEY || process.env.AZURE_PLANETARY_COMPUTER_KEY;
  const headers: Record<string, string> = { Accept: "application/json", ...(init.headers as Record<string, string>) };
  if (apiKey) {
    headers["Ocp-Apim-Subscription-Key"] = apiKey;
  }
  try {
    response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), headers });
  } catch (error) {
    if (isTimeout(error)) throw new ProviderError(504, UNREACHABLE);
    throw new ProviderError(502, UNREACHABLE);
  }
  if (response.status === 404) throw new ProviderError(404, NO_READING);
  if (response.status === 429) throw new ProviderError(429, TOO_MANY);
  if (!response.ok) throw new ProviderError(502, UNREACHABLE);
  try {
    return await response.json();
  } catch {
    throw new ProviderError(502, UNREACHABLE);
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}
