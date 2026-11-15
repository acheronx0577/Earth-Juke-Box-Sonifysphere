import { NextRequest, NextResponse } from "next/server";
import { cacheControl, errorResult, INVALID_QUERY, parseQuery, readPoint } from "@/lib/listen/planetaryComputer";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const query = parseQuery(request.nextUrl.searchParams, "point");
  if (!query) return NextResponse.json({ error: INVALID_QUERY }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const reading = await readPoint(query);
    return NextResponse.json(reading, { headers: { "Cache-Control": cacheControl("point") } });
  } catch (error) {
    const result = errorResult(error, "point");
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  }
}
