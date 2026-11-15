import { NextRequest, NextResponse } from "next/server";
import { cacheControl, errorResult, INVALID_QUERY, noReadingBody, parseQuery, PC_COLLECTION, PC_SOURCE, searchScenes } from "@/lib/listen/planetaryComputer";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const query = parseQuery(request.nextUrl.searchParams, "search");
  if (!query) return NextResponse.json({ error: INVALID_QUERY }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const items = await searchScenes(query);
    if (!items.length) {
      return NextResponse.json(noReadingBody(), { status: 404, headers: { "Cache-Control": cacheControl("search") } });
    }
    return NextResponse.json(
      { source: PC_SOURCE, collection: PC_COLLECTION, items },
      { headers: { "Cache-Control": cacheControl("search") } },
    );
  } catch (error) {
    const result = errorResult(error, "search");
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  }
}
