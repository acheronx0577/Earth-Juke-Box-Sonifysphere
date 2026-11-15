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
  if (!record.videoUrl) {
    return NextResponse.json({ error: "No video media available for this SVS visualization." }, { status: 404 });
  }

  const url = allowedSvsUrl(record.videoUrl);
  if (!url) {
    return NextResponse.json({ error: "Video asset URL not permitted." }, { status: 502 });
  }

  const range = request.headers.get("range");
  const upstreamHeaders: HeadersInit = {};
  if (range) {
    upstreamHeaders.Range = range;
  }

  try {
    const upstream = await fetch(url.toString(), {
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: "NASA SVS video stream could not be reached." }, { status: 502 });
    }

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", upstream.headers.get("content-type") || "video/mp4");
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);

    const contentRange = upstream.headers.get("content-range");
    if (contentRange) responseHeaders.set("Content-Range", contentRange);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return NextResponse.json({ error: "NASA SVS video request timed out." }, { status: 504 });
    }
    return NextResponse.json({ error: "The data service could not be reached" }, { status: 502 });
  }
}
