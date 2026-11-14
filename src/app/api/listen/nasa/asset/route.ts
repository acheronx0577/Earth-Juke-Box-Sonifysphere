import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(id)) return NextResponse.json({ error: "Invalid NASA ID." }, { status: 400 });
  try {
    const response = await fetch(`https://images-api.nasa.gov/asset/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(12000), next: { revalidate: 3600 } });
    if (!response.ok) return NextResponse.json({ error: "NASA media is unavailable." }, { status: 502 });
    const body = await response.json() as { collection?: { items?: Array<{ href?: string }> } };
    const urls = (body.collection?.items ?? []).map((item) => item.href ?? "").filter((url) => {
      try { const parsed = new URL(url); return parsed.protocol === "https:" && parsed.hostname === "images-assets.nasa.gov"; } catch { return false; }
    });
    const video = urls.find((url) => /~mobile\.mp4(?:$|\?)/i.test(url))
      ?? urls.find((url) => /~small\.mp4(?:$|\?)/i.test(url))
      ?? urls.find((url) => /\.mp4(?:$|\?)/i.test(url));
    const image = urls.find((url) => /~medium\.(?:jpe?g|png)(?:$|\?)/i.test(url))
      ?? urls.find((url) => /\.(?:jpe?g|png)(?:$|\?)/i.test(url));
    if (!video && !image) return NextResponse.json({ error: "No playable asset was found." }, { status: 404 });
    return NextResponse.json({ video: video ?? null, image: image ? `/api/listen/nasa/image?url=${encodeURIComponent(image)}` : null });
  } catch { return NextResponse.json({ error: "NASA media could not be reached." }, { status: 502 }); }
}
