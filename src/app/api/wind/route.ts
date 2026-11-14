import { NextResponse, type NextRequest } from "next/server";
import { encodePng, windFieldAt, WindUnavailable } from "@/lib/wind/field";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/wind?time=<ISO>&format=png|json
 *  png  → 360×181 RGBA PNG, R = u, G = v on a fixed ±40 m/s scale (webgl-wind layout), lon −180…179, lat 90…−90.
 *         Metadata is repeated in the X-Wind-Meta header (JSON).
 *  json → the sidecar: source, valid hour, cycle/forecast hour, range, attribution.
 * Past ERA5 hours are immutable → cached forever; ERA5T / GFS hours → 6 h.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const raw = params.get("time") ?? params.get("t");
  const now = new Date();
  let date = raw ? new Date(raw) : now;
  if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "invalid time" }, { status: 400 });
  if (date > now) date = now;
  try {
    const field = await windFieldAt(date);
    const immutable = field.meta.kind === "era5" && !field.meta.staleCachedAt;
    const cache = immutable ? "public, max-age=31536000, immutable" : "public, max-age=21600";
    if (params.get("format") === "json") return NextResponse.json(field.meta, { headers: { "Cache-Control": cache } });
    const png = encodePng(field);
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": cache, "X-Wind-Meta": encodeURIComponent(JSON.stringify(field.meta)) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: error instanceof WindUnavailable ? 404 : 502 });
  }
}
