import { NextRequest, NextResponse } from "next/server";

const PARAMETERS = {
  "air-temp": { parameter: "t_2m:C", unit: "°C" },
  "sea-temp": { parameter: "t_sea_sfc:C", unit: "°C" },
  currents: { parameter: "ocean_current_speed:ms", unit: "m/s" },
  wind: { parameter: "wind_speed_10m:ms", unit: "m/s" },
} as const;

type Layer = keyof typeof PARAMETERS;

export async function GET(request: NextRequest) {
  if (!request.nextUrl.searchParams.has("lat") || !request.nextUrl.searchParams.has("lon")) return NextResponse.json({ error: "Provide a latitude and longitude." }, { status: 400 });
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  const time = request.nextUrl.searchParams.get("time") ?? "";
  const layer = request.nextUrl.searchParams.get("layer") ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 ||
      !Object.hasOwn(PARAMETERS, layer) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(time) ||
      Number.isNaN(Date.parse(time)) || Date.parse(time) > Date.now() + 86_400_000) {
    return NextResponse.json({ error: "Provide a valid location, UTC time, and layer." }, { status: 400 });
  }
  const username = process.env.METEOMATICS_USERNAME;
  const password = process.env.METEOMATICS_PASSWORD;
  if (!username || !password) return NextResponse.json({ error: "Meteomatics is not configured on this server." }, { status: 503 });

  const { parameter, unit } = PARAMETERS[layer as Layer];
  const endpoint = `https://api.meteomatics.com/${encodeURIComponent(time)}/${parameter}/${lat.toFixed(4)},${lon.toFixed(4)}/json`;
  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: response.status === 401 ? "Meteomatics credentials were rejected." : "No matched reading is available for this layer, place, and time." }, { status: 502 });
    const body = await response.json() as { data?: Array<{ coordinates?: Array<{ dates?: Array<{ value?: number; date?: string }> }> }> };
    const reading = body.data?.[0]?.coordinates?.[0]?.dates?.[0];
    if (!Number.isFinite(reading?.value)) return NextResponse.json({ error: "No valid reading was returned." }, { status: 404 });
    return NextResponse.json({ layer, value: reading?.value, unit, time: reading?.date ?? time, lat, lon, source: "Meteomatics" });
  } catch { return NextResponse.json({ error: "The measurement service could not be reached." }, { status: 502 }); }
}
