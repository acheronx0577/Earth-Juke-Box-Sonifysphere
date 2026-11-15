import { NextRequest, NextResponse } from "next/server";
import { gibsTileUrl, isGibsDate, isTileIndex } from "@/lib/nasa/gibsColormap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? "";
  const z = Number(request.nextUrl.searchParams.get("z"));
  const x = Number(request.nextUrl.searchParams.get("x"));
  const y = Number(request.nextUrl.searchParams.get("y"));
  if (!isGibsDate(date) || !isTileIndex(z, x, y)) {
    return new NextResponse(null, { status: 400, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
  const url = gibsTileUrl(date, z, x, y);
  if (url.hostname !== "gibs.earthdata.nasa.gov") {
    return new NextResponse(null, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "image/png", "User-Agent": "SonifySphere/0.1 (NASA Space Apps prototype)" },
    });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/png") || !response.body) {
      return new NextResponse(null, { status: response.status === 404 ? 404 : 502, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
}
