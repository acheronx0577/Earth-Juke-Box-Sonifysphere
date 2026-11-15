import { NextRequest, NextResponse } from "next/server";
import { measurementCache, measurementCacheControl, measurementCacheKey, measurementTtlMs } from "@/lib/listen/measurementCache";
import { RATE_LIMIT_MESSAGE, clientIp, measurementsRateLimit } from "@/lib/listen/rateLimit";

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

class UpstreamFailure extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "UpstreamFailure";
    this.status = status;
  }
}

async function loadMeteomatics(endpoint: string, unit: string, time: string, username: string, password: string) {
  const response = await fetch(endpoint, {
    headers: { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new UpstreamFailure(
      502,
      response.status === 401
        ? "Meteomatics credentials were rejected."
        : "No matched reading is available for this layer, place, and time.",
    );
  }
  const body = await response.json() as { data?: Array<{ coordinates?: Array<{ dates?: Array<{ value?: number; date?: string }> }> }> };
  const reading = body.data?.[0]?.coordinates?.[0]?.dates?.[0];
  const value = reading?.value;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new UpstreamFailure(404, "No valid reading was returned.");
  return { value, unit, time: reading?.date ?? time };
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
  if (!username || !password) return jsonError("Meteomatics is not configured on this server.", 503);

  const decision = measurementsRateLimit.check(clientIp((name) => request.headers.get(name)));
  if (!decision.ok) {
    return NextResponse.json(
      { error: RATE_LIMIT_MESSAGE },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  }

  const { parameter, unit } = PARAMETERS[layer as Layer];
  const endpoint = `https://api.meteomatics.com/${encodeURIComponent(time)}/${parameter}/${lat.toFixed(4)},${lon.toFixed(4)}/json`;
  const key = measurementCacheKey({ layer, lat, lon, time });
  const ttlMs = measurementTtlMs(time);
  try {
    const reading = await measurementCache.getOrLoad(key, ttlMs, () => loadMeteomatics(endpoint, unit, time, username, password));
    return NextResponse.json(
      { layer, value: reading.value, unit: reading.unit, time: reading.time, lat, lon, source: "Meteomatics" },
      { headers: { "Cache-Control": measurementCacheControl(ttlMs) } },
    );
  } catch (error) {
    if (error instanceof UpstreamFailure) return jsonError(error.message, error.status);
    return jsonError("The measurement service could not be reached.", 502);
  }
}
