import { NextResponse } from "next/server";
import { errorResult, loadFrameBytes } from "@/lib/listen/eicFrame";

export const runtime = "nodejs";

export async function GET() {
  try {
    const frame = await loadFrameBytes();
    return new NextResponse(Buffer.from(frame.bytes), {
      headers: {
        "Content-Type": frame.contentType,
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const result = errorResult(error);
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  }
}
