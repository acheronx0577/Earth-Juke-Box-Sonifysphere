import { NextRequest, NextResponse } from "next/server";
import { EonetError, loadEonetEvents, parseEonetQuery } from "@/lib/nasa/eonet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "no-store" };
const PUBLIC = "public, s-maxage=900, stale-while-revalidate=900";

export async function GET(request: NextRequest) {
  try {
    const query = parseEonetQuery(request.nextUrl.searchParams);
    const result = await loadEonetEvents(query);
    return NextResponse.json(result, { headers: { "Cache-Control": result.stale ? "no-store" : PUBLIC } });
  } catch (error) {
    if (error instanceof EonetError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: PRIVATE });
    }
    return NextResponse.json({ error: "The data service could not be reached" }, { status: 502, headers: PRIVATE });
  }
}
