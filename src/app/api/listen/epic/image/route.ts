import { NextRequest, NextResponse } from "next/server";
import { EpicError, loadEpicImage } from "@/lib/nasa/epic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? "";
  const name = request.nextUrl.searchParams.get("name") ?? "";
  try {
    const image = await loadEpicImage(date, name);
    return new NextResponse(Buffer.from(image.bytes), {
      headers: {
        "Content-Type": image.type.startsWith("image/") ? image.type : "image/png",
        "Cache-Control": image.stale ? "no-store" : "public, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status = error instanceof EpicError ? error.status : 502;
    return new NextResponse(null, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
}
