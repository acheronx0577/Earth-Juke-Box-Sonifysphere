import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse(null, { status: 400 });
  let url: URL;
  try { url = new URL(raw); } catch { return new NextResponse(null, { status: 400 }); }
  if (url.protocol !== "https:" || url.hostname !== "images-assets.nasa.gov") return new NextResponse(null, { status: 400 });

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000), next: { revalidate: 3600 } });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.startsWith("image/")) return new NextResponse(null, { status: 502 });
    return new NextResponse(response.body, {
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" },
    });
  } catch { return new NextResponse(null, { status: 502 }); }
}
