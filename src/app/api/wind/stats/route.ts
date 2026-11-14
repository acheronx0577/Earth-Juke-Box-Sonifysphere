import { NextResponse, type NextRequest } from "next/server";
import { MAP_REGIONS } from "@/data/exploreMap";
import { regionPlace } from "@/lib/live/geo";
import type { LivePlace } from "@/lib/live/types";
import { windFieldAt, WindUnavailable } from "@/lib/wind/field";
import { compass, windStats } from "@/lib/wind/stats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parsePlace(params: URLSearchParams): LivePlace | string {
  const region = params.get("region");
  if (region) {
    if (!MAP_REGIONS.some((item) => item.id === region)) return `unknown region "${region}"`;
    return regionPlace(region);
  }
  const nums = ["w", "s", "e", "n"].map((key) => Number(params.get(key)));
  if (nums.some((value) => !Number.isFinite(value))) return "pass region=<id> or w,s,e,n";
  const [west, south, east, north] = nums;
  if (south >= north || south < -90 || north > 90 || Math.abs(west) > 180 || Math.abs(east) > 180) return "invalid box";
  return { kind: "area", name: "Custom area", west, south, east, north };
}

/**
 * GET /api/wind/stats?region=<id>|w=&s=&e=&n=&time=<ISO>
 * Wind speed for a region or box from the exact 1° field the particle layer draws:
 * cos(lat)-weighted mean speed, direction (from), max, steadiness and gust spread.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const place = parsePlace(params);
  if (typeof place === "string") return NextResponse.json({ error: place }, { status: 400 });
  const raw = params.get("time") ?? params.get("t");
  const now = new Date();
  let date = raw ? new Date(raw) : now;
  if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "invalid time" }, { status: 400 });
  if (date > now) date = now;
  try {
    const field = await windFieldAt(date);
    const stats = windStats(field, place);
    if (!stats) return NextResponse.json({ error: "The selected area has no 1° grid points." }, { status: 404 });
    const { meta } = field;
    const immutable = meta.kind === "era5" && !meta.staleCachedAt;
    return NextResponse.json(
      {
        place,
        stats,
        display: `${stats.meanSpeed.toFixed(1)} m/s from ${compass(stats.directionFrom)} (${Math.round(stats.directionFrom)}°)`,
        source: meta.source,
        sourceUrl: meta.sourceUrl,
        kind: meta.kind,
        validUtc: meta.validUtc,
        staleCachedAt: meta.staleCachedAt ?? null,
      },
      { headers: { "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=21600" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: error instanceof WindUnavailable ? 404 : 502 });
  }
}
