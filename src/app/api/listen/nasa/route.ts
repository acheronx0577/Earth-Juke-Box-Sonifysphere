import { NextRequest, NextResponse } from "next/server";

const NASA_API = "https://images-api.nasa.gov";

type NasaItem = {
  data?: Array<{ nasa_id?: string; title?: string; media_type?: string; date_created?: string; center?: string; description?: string }>;
  links?: Array<{ href?: string; rel?: string }>;
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const mediaType = request.nextUrl.searchParams.get("type") ?? "image,video";
  if (query.length < 2 || query.length > 100 || !["image", "video", "image,video"].includes(mediaType)) {
    return NextResponse.json({ error: "Enter a search of 2–100 characters." }, { status: 400 });
  }

  const url = new URL(`${NASA_API}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("media_type", mediaType);
  url.searchParams.set("page_size", "24");

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000), next: { revalidate: 300 } });
    if (!response.ok) return NextResponse.json({ error: "NASA search is temporarily unavailable." }, { status: 502 });
    const body = await response.json() as { collection?: { items?: NasaItem[]; metadata?: { total_hits?: number } } };
    const items = (body.collection?.items ?? []).flatMap((item) => {
      const data = item.data?.[0];
      const imageLink = (href?: string) => !!href && /\.(?:jpe?g|png|gif|webp)(?:$|\?)/i.test(href);
      const preview = item.links?.find((link) => link.rel === "preview" && imageLink(link.href))?.href
        ?? item.links?.find((link) => imageLink(link.href))?.href;
      if (!data?.nasa_id || !data.title || !preview || !["image", "video"].includes(data.media_type ?? "")) return [];
      return [{
        id: data.nasa_id,
        title: data.title,
        mediaType: data.media_type,
        date: data.date_created ?? null,
        center: data.center ?? "NASA",
        description: data.description?.replace(/<[^>]*>/g, " ").slice(0, 350) ?? "",
        preview: `/api/listen/nasa/image?url=${encodeURIComponent(preview)}`,
      }];
    });
    return NextResponse.json({ items, total: body.collection?.metadata?.total_hits ?? items.length });
  } catch {
    return NextResponse.json({ error: "NASA search could not be reached." }, { status: 502 });
  }
}
