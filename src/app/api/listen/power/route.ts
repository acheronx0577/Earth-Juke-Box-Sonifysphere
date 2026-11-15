import { NextRequest, NextResponse } from "next/server";
import { isPowerLayer, readPowerPoint } from "@/lib/listen/power";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  if (!request.nextUrl.searchParams.has("lat") || !request.nextUrl.searchParams.has("lon")) {
    return NextResponse.json({ error: "Provide a latitude and longitude." }, { status: 400, headers: NO_STORE });
  }
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  const time = request.nextUrl.searchParams.get("time") ?? "";
  const layer = request.nextUrl.searchParams.get("layer") ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 ||
      !isPowerLayer(layer) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(time) ||
      Number.isNaN(Date.parse(time)) || Date.parse(time) > Date.now() + 86_400_000) {
    return NextResponse.json({ error: "Provide a valid location, UTC time, and layer." }, { status: 400, headers: NO_STORE });
  }
  const result = await readPowerPoint({ layer, lat, lon, time });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
  return NextResponse.json(result.body, { headers: { "Cache-Control": result.cacheControl } });
}
