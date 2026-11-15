import { type NextRequest, NextResponse } from "next/server";
import { allowedSvsUrl, isAllowedSvsId, SVS_REGISTRY } from "@/lib/listen/svsMedia";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id || !isAllowedSvsId(id)) {
    return NextResponse.json({ error: "Invalid or unsupported NASA SVS visualization ID." }, { status: 400 });
  }

  const record = SVS_REGISTRY[id];
  const url = allowedSvsUrl(record.stillUrl);
  if (!url) {
    return NextResponse.json({ error: "Visual asset URL not permitted." }, { status: 502 });
  }

  try {
    const upstream = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: 86_400 },
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: "NASA SVS image could not be reached." }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const bytes = await upstream.arrayBuffer();

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return NextResponse.json({ error: "NASA SVS image request timed out." }, { status: 504 });
    }
    return NextResponse.json({ error: "The data service could not be reached" }, { status: 502 });
  }
}
