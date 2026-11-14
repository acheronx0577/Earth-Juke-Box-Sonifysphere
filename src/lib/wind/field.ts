import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import { cachedText, fetchWithTimeout, HOUR } from "@/lib/live/fetchCache";
import { decodeGrib2 } from "@/lib/wind/grib2";

/**
 * Global 10 m wind field for one exact UTC hour, on a 1° grid (360 × 181):
 * columns lon −180 … 179 (step 1°), rows lat 90 … −90 (step 1°). u = eastward, v = northward, m/s.
 *
 * Sources (server-side only — none of them send CORS headers except AWS):
 *  - ERA5 / ERA5T hourly 0.25° reanalysis from the ARCO-ERA5 Zarr store on Google Cloud (1940 → ~6 days ago).
 *    Read with zarrita (MIT). One chunk = one global hour per variable. ERA5 data: CC-BY-4.0 (Copernicus C3S).
 *  - NOAA GFS 0.25° from AWS Open Data (noaa-gfs-bdp-pds) for hours newer than ERA5T: the analysis (f000) or
 *    short forecast hour (f001–f005) of the cycle that is valid at the requested hour. Decoded in pure TS
 *    (src/lib/wind/grib2.ts, template 5.3).
 * Downsampled 0.25° → 1° by taking the exact integer-degree grid points (stride 4), so a value at 38°N 121°W is
 * the model's own value at that grid point.
 */

export const WIDTH = 360;
export const HEIGHT = 181;
/** Fixed PNG encoding range (±40 m/s, 0.31 m/s per step) so colours compare across eras. */
export const PNG_RANGE = 40;

export type WindSourceKind = "era5" | "era5t" | "gfs";

export interface WindMeta {
  readonly kind: WindSourceKind;
  readonly source: string;
  readonly sourceUrl: string;
  readonly model: string;
  readonly requestedUtc: string;
  /** The hour the field is valid for (UTC ISO). */
  readonly validUtc: string;
  readonly cycleUtc?: string;
  readonly forecastHour?: number;
  readonly width: number;
  readonly height: number;
  readonly range: number;
  readonly note: string;
  readonly attribution: string;
  /** Set when the upstream failed and an older cached copy of this same hour is served. */
  readonly staleCachedAt?: string;
}

export interface WindField {
  readonly meta: WindMeta;
  readonly u: Float32Array;
  readonly v: Float32Array;
}

const ARCO = "https://storage.googleapis.com/gcp-public-data-arco-era5/ar/full_37-1h-0p25deg-chunk-1.zarr-v3";
const GFS = "https://noaa-gfs-bdp-pds.s3.amazonaws.com";
const CACHE = path.join(process.cwd(), ".cache", "wind");
const ERA5_ATTR = "Contains modified Copernicus Climate Change Service information (ERA5, CC-BY-4.0) via Google ARCO-ERA5";
const GFS_ATTR = "NOAA Global Forecast System (GFS), accessed from https://registry.opendata.aws/noaa-gfs-bdp-pds";

const pad = (n: number) => String(n).padStart(2, "0");
const hourIso = (ms: number) => new Date(ms).toISOString().slice(0, 13) + ":00:00Z";

/** 0.25° global grid (lat 90→−90 rows, lon 0→359.75 cols) → our 1° grid (lon −180…179). */
function downsampleQuarter(src: ArrayLike<number>): Float32Array {
  const out = new Float32Array(WIDTH * HEIGHT);
  for (let row = 0; row < HEIGHT; row += 1) {
    for (let col = 0; col < WIDTH; col += 1) {
      const lon360 = (col - 180 + 360) % 360; // our col 0 = −180° = 180° in 0–360
      out[row * WIDTH + col] = src[row * 4 * 1440 + lon360 * 4];
    }
  }
  return out;
}

// ---------- ERA5 (ARCO Zarr) ----------

type ZarrArray = { getChunk: (coords: number[]) => Promise<{ data: ArrayLike<number> }> };
let arcoArrays: Promise<{ u: ZarrArray; v: ZarrArray }> | null = null;

async function arco() {
  arcoArrays ??= (async () => {
    const zarr = await import("zarrita");
    const root = zarr.root(new zarr.FetchStore(ARCO));
    const [u, v] = await Promise.all([
      zarr.open.v2(root.resolve("10m_u_component_of_wind"), { kind: "array" }),
      zarr.open.v2(root.resolve("10m_v_component_of_wind"), { kind: "array" }),
    ]);
    return { u: u as unknown as ZarrArray, v: v as unknown as ZarrArray };
  })().catch((error: unknown) => {
    arcoArrays = null;
    throw error;
  });
  return arcoArrays;
}

/** ERA5 final vs ERA5T (preliminary) extent, from the store's own attributes. */
async function arcoExtent(): Promise<{ stop: number; stopT: number }> {
  const res = await cachedText("arco-era5-zattrs.json", `${ARCO}/.zattrs`, 6 * HOUR, 10000);
  const attrs = JSON.parse(res.text) as { valid_time_stop?: string; valid_time_stop_era5t?: string };
  const end = (day?: string) => (day ? Date.parse(`${day}T23:00:00Z`) : 0);
  return { stop: end(attrs.valid_time_stop), stopT: end(attrs.valid_time_stop_era5t) };
}

async function era5Field(ms: number, requestedUtc: string, era5t: boolean): Promise<WindField> {
  const index = Math.round((ms - Date.UTC(1900, 0, 1)) / 3_600_000);
  const { u, v } = await arco();
  const [cu, cv] = await Promise.all([u.getChunk([index, 0, 0]), v.getChunk([index, 0, 0])]);
  // Chunks not yet written read back as the fill value (NaN) instead of failing: treat as "not published".
  let missing = 0;
  for (let i = 0; i < cu.data.length; i += 997) if (Number.isNaN(cu.data[i]) || Number.isNaN(cv.data[i])) missing += 1;
  if (missing > cu.data.length / 997 / 100) throw new Error(`ERA5 hour ${hourIso(ms)} not in the ARCO store yet (NaN chunk)`);
  return {
    meta: {
      kind: era5t ? "era5t" : "era5",
      source: era5t ? "ECMWF ERA5T (preliminary) via ARCO-ERA5" : "ECMWF ERA5 reanalysis via ARCO-ERA5",
      sourceUrl: "https://github.com/google-research/arco-era5",
      model: "ERA5 hourly 0.25°, sampled at 1° grid points",
      requestedUtc,
      validUtc: hourIso(ms),
      width: WIDTH,
      height: HEIGHT,
      range: PNG_RANGE,
      note: era5t ? "ERA5T is preliminary and is replaced by final ERA5 about 3 months later." : "Final ERA5 reanalysis (modelled, not station readings).",
      attribution: ERA5_ATTR,
    },
    u: downsampleQuarter(cu.data),
    v: downsampleQuarter(cv.data),
  };
}

// ---------- GFS (AWS, GRIB2) ----------

async function gfsMessage(url: string, idx: string, name: "UGRD" | "VGRD"): Promise<Uint8Array> {
  const lines = idx.trim().split("\n");
  const at = lines.findIndex((line) => line.includes(`:${name}:10 m above ground:`));
  if (at < 0) throw new Error(`${name} 10 m not in index`);
  const start = Number(lines[at].split(":")[1]);
  const next = lines[at + 1] ? Number(lines[at + 1].split(":")[1]) - 1 : undefined;
  const response = await fetchWithTimeout(url, 30000, { headers: { Range: `bytes=${start}-${next ?? ""}` } });
  if (response.status !== 206 && response.status !== 200) throw new Error(`GFS range ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function gfsField(ms: number, requestedUtc: string): Promise<WindField> {
  const firstCycle = Math.floor(ms / (6 * HOUR)) * 6 * HOUR;
  let lastError = "no cycle";
  for (let back = 0; back < 5; back += 1) {
    const cycle = firstCycle - back * 6 * HOUR;
    const fhr = Math.round((ms - cycle) / HOUR);
    const d = new Date(cycle);
    const ymd = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
    const hh = pad(d.getUTCHours());
    const url = `${GFS}/gfs.${ymd}/${hh}/atmos/gfs.t${hh}z.pgrb2.0p25.f${String(fhr).padStart(3, "0")}`;
    const idxResponse = await fetchWithTimeout(`${url}.idx`, 10000).catch(() => null);
    if (!idxResponse?.ok) {
      lastError = `cycle ${ymd} ${hh}Z f${fhr} not published (${idxResponse?.status ?? "timeout"})`;
      continue;
    }
    const idx = await idxResponse.text();
    const [mu, mv] = await Promise.all([gfsMessage(url, idx, "UGRD"), gfsMessage(url, idx, "VGRD")]);
    const fu = decodeGrib2(mu);
    const fv = decodeGrib2(mv);
    if (fu.ni !== 1440 || fu.nj !== 721) throw new Error(`unexpected GFS grid ${fu.ni}×${fu.nj}`);
    return {
      meta: {
        kind: "gfs",
        source: "NOAA GFS 0.25° (AWS Open Data)",
        sourceUrl: "https://registry.opendata.aws/noaa-gfs-bdp-pds/",
        model: fhr === 0 ? "GFS analysis (f000), sampled at 1° grid points" : `GFS +${fhr} h forecast, sampled at 1° grid points`,
        requestedUtc,
        validUtc: hourIso(ms),
        cycleUtc: hourIso(cycle),
        forecastHour: fhr,
        width: WIDTH,
        height: HEIGHT,
        range: PNG_RANGE,
        note: `Newer than ERA5T, so the GFS ${hh}Z ${ymd} cycle is used${fhr ? ` (forecast +${fhr} h valid at this hour)` : " (analysis)"}.`,
        attribution: GFS_ATTR,
      },
      u: downsampleQuarter(fu.values),
      v: downsampleQuarter(fv.values),
    };
  }
  throw new Error(`GFS: ${lastError}`);
}

// ---------- cache + dispatch ----------

const memory = new Map<string, { field: WindField; at: number }>();
const inflight = new Map<string, Promise<WindField>>();

function ttlFor(kind: WindSourceKind): number {
  return kind === "era5" ? Number.POSITIVE_INFINITY : kind === "era5t" ? 24 * HOUR : 6 * HOUR;
}

async function readDisk(key: string, ignoreTtl = false): Promise<WindField | null> {
  try {
    const [meta, bin] = await Promise.all([readFile(path.join(CACHE, `${key}.json`), "utf8"), readFile(path.join(CACHE, `${key}.bin`))]);
    const parsed = JSON.parse(meta) as WindMeta & { cachedAt: number; staleCachedAt?: string };
    if (!ignoreTtl && Date.now() - parsed.cachedAt > ttlFor(parsed.kind)) return null;
    if (ignoreTtl) parsed.staleCachedAt = new Date(parsed.cachedAt).toISOString();
    const floats = new Float32Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
    return { meta: parsed, u: floats.subarray(0, WIDTH * HEIGHT), v: floats.subarray(WIDTH * HEIGHT) };
  } catch {
    return null;
  }
}

async function writeDisk(key: string, field: WindField): Promise<void> {
  await mkdir(CACHE, { recursive: true });
  const both = new Float32Array(WIDTH * HEIGHT * 2);
  both.set(field.u, 0);
  both.set(field.v, WIDTH * HEIGHT);
  await Promise.all([
    writeFile(path.join(CACHE, `${key}.json`), JSON.stringify({ ...field.meta, cachedAt: Date.now() })),
    writeFile(path.join(CACHE, `${key}.bin`), Buffer.from(both.buffer)),
  ]);
}

export class WindUnavailable extends Error {}

/** Field for the hour containing `date` (floored to the hour, UTC). */
export async function windFieldAt(date: Date): Promise<WindField> {
  const ms = Math.floor(date.getTime() / HOUR) * HOUR;
  if (ms < Date.UTC(1940, 0, 1)) throw new WindUnavailable("No wind field before 1940 (ERA5 starts 1 Jan 1940).");
  const key = hourIso(ms).replace(/[:]/g, "");
  const hot = memory.get(key);
  if (hot && Date.now() - hot.at < ttlFor(hot.field.meta.kind)) return hot.field;
  const running = inflight.get(key);
  if (running) return running;
  const job = (async () => {
    const disk = await readDisk(key);
    if (disk) return disk;
    const requestedUtc = date.toISOString();
    const extent = await arcoExtent().catch(() => ({ stop: 0, stopT: 0 }));
    let field: WindField;
    try {
      field = await fetchField(ms, requestedUtc, extent);
    } catch (error) {
      const old = await readDisk(key, true);
      if (old) return old;
      throw error;
    }
    await writeDisk(key, field).catch(() => undefined);
    return field;
  })();
  inflight.set(key, job);
  try {
    const field = await job;
    memory.set(key, { field, at: Date.now() });
    if (memory.size > 48) memory.delete(memory.keys().next().value as string);
    return field;
  } finally {
    inflight.delete(key);
  }
}

/** ERA5/ERA5T while the store covers the hour; GFS (archive on AWS from 2021) after that or if ERA5 fails. */
async function fetchField(ms: number, requestedUtc: string, extent: { stop: number; stopT: number }): Promise<WindField> {
  if (extent.stopT !== 0 && ms > extent.stopT) return gfsField(ms, requestedUtc);
  try {
    return await era5Field(ms, requestedUtc, extent.stop > 0 && ms > extent.stop);
  } catch (error) {
    if (ms < Date.UTC(2021, 0, 1)) throw error;
    return gfsField(ms, requestedUtc);
  }
}

/** webgl-wind convention: R = u, G = v, fixed ±40 m/s; B = speed/40 (handy for debugging); A = 255. */
export function encodePng(field: WindField): Buffer {
  const png = new PNG({ width: WIDTH, height: HEIGHT });
  const q = (value: number) => Math.max(0, Math.min(255, Math.round(((value + PNG_RANGE) / (2 * PNG_RANGE)) * 255)));
  for (let i = 0; i < WIDTH * HEIGHT; i += 1) {
    const u = field.u[i];
    const v = field.v[i];
    png.data[i * 4] = q(u);
    png.data[i * 4 + 1] = q(v);
    png.data[i * 4 + 2] = Math.min(255, Math.round((Math.hypot(u, v) / PNG_RANGE) * 255));
    png.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(png);
}
