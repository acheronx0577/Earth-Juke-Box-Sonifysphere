import { NextRequest, NextResponse } from "next/server";
import {
  enqueueSatelliteJob,
  getSatelliteJob,
  parseJobQuery,
} from "@/lib/listen/satelliteJobs";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const CACHE_SUCCESS = {
  "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=604800",
};

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // If body is not JSON, check URL search params
  }

  const searchParams = request.nextUrl.searchParams;
  const rawQuery = {
    lat: body.lat ?? searchParams.get("lat"),
    lon: body.lon ?? searchParams.get("lon"),
    time: body.time ?? searchParams.get("time"),
    collection: body.collection ?? searchParams.get("collection"),
    sceneId: body.sceneId ?? searchParams.get("sceneId"),
  };

  const parsed = parseJobQuery(rawQuery);
  if (!parsed) {
    return NextResponse.json(
      { error: "Provide a valid location (lat, lon) and UTC time." },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const job = await enqueueSatelliteJob(parsed);
    if (job.status === "completed") {
      return NextResponse.json(job, { status: 200, headers: CACHE_SUCCESS });
    }
    return NextResponse.json(job, { status: 202, headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { error: "The satellite processing service could not be reached." },
      { status: 502, headers: NO_STORE },
    );
  }
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { error: "Provide a job id." },
      { status: 400, headers: NO_STORE },
    );
  }

  const job = getSatelliteJob(id);
  if (!job) {
    return NextResponse.json(
      { error: "Satellite job not found." },
      { status: 404, headers: NO_STORE },
    );
  }

  if (job.status === "completed") {
    return NextResponse.json(job, { status: 200, headers: CACHE_SUCCESS });
  }

  return NextResponse.json(job, { status: 200, headers: NO_STORE });
}
