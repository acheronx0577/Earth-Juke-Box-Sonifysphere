/** One GIBS layer whose published colour map can be read back to a value. */

export const GIBS_AIR_LAYER = {
  id: "merra2-air-temp",
  wmts: "MERRA2_2m_Air_Temperature_Monthly",
  matrix: "GoogleMapsCompatible_Level6",
  maxZoom: 6,
  colormap: "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MERRA2_2m_Air_Temperature_Monthly.xml",
  title: "MERRA-2 2 m air temperature",
} as const;

export interface ColorEntry {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly nodata: boolean;
  readonly low: number | null;
  readonly high: number | null;
}

export interface ColorMap {
  readonly unit: string;
  readonly entries: readonly ColorEntry[];
}

export interface ColorValue {
  readonly value: number;
  readonly unit: string;
  readonly low: number | null;
  readonly high: number | null;
  readonly label: "image-derived";
}

const MAP_TTL = 30 * 24 * 60 * 60 * 1000;
let clock = () => Date.now();
let cached: { at: number; map: ColorMap } | null = null;

export function parseGibsColorMap(xml: string): ColorMap {
  const blocks = xml.matchAll(/<ColorMap\b([^>]*)>([\s\S]*?)<\/ColorMap>/g);
  let unit = "";
  const entries: ColorEntry[] = [];
  for (const block of blocks) {
    const units = attribute(block[1] ?? "", "units");
    if (units) unit = units;
    for (const entry of (block[2] ?? "").matchAll(/<ColorMapEntry\b([^>]*?)\/?>/g)) {
      const tag = entry[1] ?? "";
      const rgb = attribute(tag, "rgb")?.split(",").map((part) => Number(part.trim()));
      if (!rgb || rgb.length !== 3 || rgb.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) continue;
      const interval = parseInterval(attribute(tag, "value") ?? attribute(tag, "sourceValue") ?? "");
      entries.push({
        r: rgb[0] ?? 0,
        g: rgb[1] ?? 0,
        b: rgb[2] ?? 0,
        nodata: attribute(tag, "nodata") === "true" || attribute(tag, "transparent") === "true",
        low: interval.low,
        high: interval.high,
      });
    }
  }
  if (!unit || entries.length === 0) throw new GibsError(502, "The data service could not be reached");
  return { unit, entries };
}

export function valueForRgb(map: ColorMap, r: number, g: number, b: number): ColorValue | null {
  let best: ColorEntry | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const entry of map.entries) {
    const distance = (entry.r - r) ** 2 + (entry.g - g) ** 2 + (entry.b - b) ** 2;
    if (distance < bestDistance) {
      best = entry;
      bestDistance = distance;
    }
    if (distance === 0) break;
  }
  if (!best || best.nodata) return null;
  const value = representative(best);
  if (value === null) return null;
  return { value, unit: map.unit, low: best.low, high: best.high, label: "image-derived" };
}

export function rangeLabel(reading: Pick<ColorValue, "low" | "high" | "unit">): string {
  const { low, high, unit } = reading;
  if (low === null && high !== null) return `below ${format(high)} ${unit}`;
  if (low !== null && high === null) return `${format(low)} ${unit} and above`;
  if (low !== null && high !== null && low !== high) return `${format(low)}–${format(high)} ${unit}`;
  if (low !== null) return `${format(low)} ${unit}`;
  return unit;
}

export async function loadAirColorMap(): Promise<{ map: ColorMap; cached: boolean }> {
  if (cached && clock() - cached.at <= MAP_TTL) return { map: cached.map, cached: true };
  let response: Response;
  try {
    response = await fetch(GIBS_AIR_LAYER.colormap, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/xml,text/xml", "User-Agent": "SonifySphere/0.1 (NASA Space Apps prototype)" },
    });
  } catch (error) {
    if (cached) return { map: cached.map, cached: true };
    const status = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? 504 : 502;
    throw new GibsError(status, "The data service could not be reached");
  }
  if (!response.ok) {
    if (cached) return { map: cached.map, cached: true };
    throw new GibsError(502, "The data service could not be reached");
  }
  const map = parseGibsColorMap(await response.text());
  cached = { at: clock(), map };
  return { map, cached: false };
}

export function gibsTileUrl(date: string, z: number, x: number, y: number): URL {
  return new URL(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_AIR_LAYER.wmts}/default/${date}/${GIBS_AIR_LAYER.matrix}/${z}/${y}/${x}.png`);
}

export function isGibsDate(value: string, today = clock()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1980) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
  const now = new Date(today);
  return date.getTime() <= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function isTileIndex(z: number, x: number, y: number): boolean {
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (z < 0 || z > GIBS_AIR_LAYER.maxZoom) return false;
  const size = 2 ** z;
  return x >= 0 && y >= 0 && x < size && y < size;
}

export class GibsError extends Error {
  readonly status: 400 | 404 | 502 | 504;

  constructor(status: GibsError["status"], message: string) {
    super(message);
    this.name = "GibsError";
    this.status = status;
  }
}

export function resetGibsCacheForTests(): void {
  cached = null;
  clock = () => Date.now();
}

export function setGibsClockForTests(next: () => number): void {
  clock = next;
}

function representative(entry: ColorEntry): number | null {
  if (entry.low === null && entry.high === null) return null;
  if (entry.low === null) return entry.high;
  if (entry.high === null) return entry.low;
  return (entry.low + entry.high) / 2;
}

function parseInterval(value: string): { low: number | null; high: number | null } {
  const match = value.match(/^\[([^,\]]+),([^,\]]+)\)/);
  if (!match) return { low: null, high: null };
  return { low: bound(match[1] ?? ""), high: bound(match[2] ?? "") };
}

function bound(value: string): number | null {
  if (/inf/i.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function attribute(source: string, name: string): string | null {
  const match = source.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match?.[1] ?? null;
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
