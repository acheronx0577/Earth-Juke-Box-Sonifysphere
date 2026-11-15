import { NextResponse } from "next/server";
import { errorResult, loadPublicFrame } from "@/lib/listen/eicFrame";

export const runtime = "nodejs";

export async function GET() {
  try {
    const frame = await loadPublicFrame();
    return NextResponse.json(frame, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (error) {
    const result = errorResult(error);
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  }
}
