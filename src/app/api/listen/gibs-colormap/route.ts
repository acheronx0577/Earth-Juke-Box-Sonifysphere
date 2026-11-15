import { NextRequest, NextResponse } from "next/server";
import { PNG } from "pngjs";
import {
  GIBS_AIR_LAYER,
  GibsError,
  gibsTileUrl,
  isGibsDate,
  isTileIndex,
  loadAirColorMap,
  rangeLabel,
  valueForRgb,
} from "@/lib/nasa/gibsColormap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "no-store" };
const PUBLIC = "public, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const rgb = parseRgb(params.get("rgb"));
    const pixel = rgb ?? await pixelFromTile(params);
    const { map, cached } = await loadAirColorMap();
    const reading = valueForRgb(map, pixel.r, pixel.g, pixel.b);
    if (!reading) {
      return NextResponse.json({ error: "No reading for this place and time" }, { status: 404, headers: PRIVATE });
    }
    return NextResponse.json({
      source: "NASA GIBS",
      layer: GIBS_AIR_LAYER.wmts,
      title: GIBS_AIR_LAYER.title,
      value: reading.value,
      unit: reading.unit,
      range: rangeLabel(reading),
      quality: "image-derived",
      label: "image-derived",
      r: pixel.r,
      g: pixel.g,
      b: pixel.b,
      cached,
      attribution: "NASA GIBS / MERRA-2",
      license: "Public domain (US government work)",
    }, { headers: { "Cache-Control": PUBLIC } });
  } catch (error) {
    if (error instanceof GibsError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: PRIVATE });
    }
    return NextResponse.json({ error: "The data service could not be reached" }, { status: 502, headers: PRIVATE });
  }
}

function parseRgb(value: string | null): { r: number; g: number; b: number } | null {
  if (value === null) return null;
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    throw new GibsError(400, "Provide a colour as red, green, blue.");
  }
  return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0 };
}

async function pixelFromTile(params: URLSearchParams): Promise<{ r: number; g: number; b: number }> {
  const date = params.get("date") ?? "";
  const z = Number(params.get("z"));
  const x = Number(params.get("x"));
  const y = Number(params.get("y"));
  const px = Number(params.get("px"));
  const py = Number(params.get("py"));
  if (!isGibsDate(date) || !isTileIndex(z, x, y) || !Number.isInteger(px) || !Number.isInteger(py)) {
    throw new GibsError(400, "Provide a colour or a tile pixel.");
  }
  const url = gibsTileUrl(date, z, x, y);
  if (url.hostname !== "gibs.earthdata.nasa.gov" || url.protocol !== "https:") {
    throw new GibsError(400, "Provide a colour or a tile pixel.");
  }
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "image/png", "User-Agent": "SonifySphere/0.1 (NASA Space Apps prototype)" },
    });
  } catch (error) {
    const status = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? 504 : 502;
    throw new GibsError(status, "The data service could not be reached");
  }
  const type = response.headers.get("content-type") ?? "";
  if (response.status === 404) throw new GibsError(404, "No reading for this place and time");
  if (!response.ok || !type.startsWith("image/png")) throw new GibsError(502, "The data service could not be reached");
  const png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
  if (px < 0 || py < 0 || px >= png.width || py >= png.height) {
    throw new GibsError(400, "Provide a pixel inside the tile.");
  }
  const index = (png.width * py + px) << 2;
  if ((png.data[index + 3] ?? 0) === 0) throw new GibsError(404, "No reading for this place and time");
  return { r: png.data[index] ?? 0, g: png.data[index + 1] ?? 0, b: png.data[index + 2] ?? 0 };
}
