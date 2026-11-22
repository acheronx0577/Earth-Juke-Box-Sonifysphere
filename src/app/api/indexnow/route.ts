import { NextResponse } from "next/server";
import { submitToIndexNow, INDEXNOW_URLS, buildIndexNowPayload } from "@/lib/indexNow";

export async function POST() {
  try {
    const result = await submitToIndexNow();
    return NextResponse.json({
      success: result.ok,
      status: result.status,
      message: result.ok ? "IndexNow ping accepted" : "IndexNow ping returned non-200",
      submittedUrls: INDEXNOW_URLS,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "IndexNow submission failed",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const payload = buildIndexNowPayload();
  return NextResponse.json({
    status: "ready",
    host: payload.host,
    keyLocation: payload.keyLocation,
    urlCount: payload.urlList.length,
    urls: payload.urlList,
  });
}
