import { NextRequest, NextResponse } from "next/server";
import { EpicError, isEpicDate, loadEpicDates, loadEpicFrames } from "@/lib/nasa/epic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "no-store" };
const PUBLIC = "public, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    if (params.has("dates")) {
      const count = Number(params.get("dates"));
      if (!Number.isInteger(count) || count < 1 || count > 30) {
        return NextResponse.json({ error: "Provide a date count from 1 to 30." }, { status: 400, headers: PRIVATE });
      }
      const result = await loadEpicDates(count);
      return NextResponse.json(result, { headers: { "Cache-Control": result.stale ? "no-store" : PUBLIC } });
    }
    const date = params.get("date");
    if (date !== null && !isEpicDate(date)) {
      return NextResponse.json({ error: "Provide a valid UTC date." }, { status: 400, headers: PRIVATE });
    }
    const result = await loadEpicFrames(date);
    return NextResponse.json(result, { headers: { "Cache-Control": result.stale ? "no-store" : PUBLIC } });
  } catch (error) {
    return epicFailure(error);
  }
}

function epicFailure(error: unknown) {
  if (error instanceof EpicError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: PRIVATE });
  }
  return NextResponse.json({ error: "The data service could not be reached" }, { status: 502, headers: PRIVATE });
}
