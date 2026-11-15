import { NextRequest, NextResponse } from "next/server";
import { isPowerLayer, readPowerPoint } from "@/lib/listen/power";

const PARAMETERS = {
  "air-temp": { parameter: "t_2m:C", unit: "°C" },
  "sea-temp": { parameter: "t_sea_sfc:C", unit: "°C" },
  currents: { parameter: "ocean_current_speed:ms", unit: "m/s" },
  wind: { parameter: "wind_speed_10m:ms", unit: "m/s" },
} as const;

type Layer = keyof typeof PARAMETERS;

const NO_STORE = { "Cache-Control": "no-store" };

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

async function powerFallback(lat: number, lon: number, time: string, layer: string) {
  const result = await readPowerPoint({ layer, lat, lon, time });
  if (!result.ok) return jsonError(result.error, result.status);
  return NextResponse.json(result.body, { headers: { "Cache-Control": result.cacheControl } });
}

export async function GET(request: NextRequest) {
  if (!request.nextUrl.searchParams.has("lat") || !request.nextUrl.searchParams.has("lon")) return jsonError("Provide a latitude and longitude.", 400);
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  const time = request.nextUrl.searchParams.get("time") ?? "";
  const layer = request.nextUrl.searchParams.get("layer") ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 ||
      !Object.hasOwn(PARAMETERS, layer) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(time) ||
      Number.isNaN(Date.parse(time)) || Date.parse(time) > Date.now() + 86_400_000) {
    return jsonError("Provide a valid location, UTC time, and layer.", 400);
  }
  const username = process.env.METEOMATICS_USERNAME;
  const password = process.env.METEOMATICS_PASSWORD;
  // Air temperature and wind use NASA POWER when Meteomatics is absent or fails.
  if (!username || !password) {
    if (isPowerLayer(layer)) return powerFallback(lat, lon, time, layer);
    return jsonError("Meteomatics is not configured on this server.", 503);
  }

  const { parameter, unit } = PARAMETERS[layer as Layer];
  const endpoint = `https://api.meteomatics.com/${encodeURIComponent(time)}/${parameter}/${lat.toFixed(4)},${lon.toFixed(4)}/json`;
  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) {
      if (isPowerLayer(layer)) return powerFallback(lat, lon, time, layer);
      return jsonError(response.status === 401 ? "Meteomatics credentials were rejected." : "No matched reading is available for this layer, place, and time.", 502);
    }
    const body = await response.json() as { data?: Array<{ coordinates?: Array<{ dates?: Array<{ value?: number; date?: string }> }> }> };
    const reading = body.data?.[0]?.coordinates?.[0]?.dates?.[0];
    const value = reading?.value;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      if (isPowerLayer(layer)) return powerFallback(lat, lon, time, layer);
      return jsonError("No valid reading was returned.", 404);
    }
    return NextResponse.json({ layer, value, unit, time: reading?.date ?? time, lat, lon, source: "Meteomatics" });
  } catch {
    if (isPowerLayer(layer)) return powerFallback(lat, lon, time, layer);
    return jsonError("The measurement service could not be reached.", 502);
  }
}
