import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { resetNasaKeyStateForTests } from "@/lib/nasa/apiKey";
import { resetEpicCacheForTests, setEpicClockForTests } from "@/lib/nasa/epic";
import { GET as getImage } from "@/app/api/listen/epic/image/route";
import { GET as getEpic } from "@/app/api/listen/epic/route";

const KEY = "UnitTestNasaKey99";
const FIXED = Date.parse("2026-11-15T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const previous = process.env.NASA_API_KEY;
const consoleMethods = ["log", "info", "warn", "error", "debug"] as const;
const originals = new Map<string, (...args: unknown[]) => void>();
const logs: string[] = [];
let calls: string[] = [];
let now = FIXED;

const FRAME = {
  identifier: "20241115003649",
  caption: "Taken by NASA EPIC onboard DSCOVR",
  image: "epic_1b_20241115003649",
  date: "2024-11-15 00:36:49",
  centroid_coordinates: { lat: 1.25, lon: -20.5 },
  archive: "https://api.nasa.gov/EPIC/archive/natural/2024/11/15/png/epic_1b_20241115003649.png?api_key=hidden-upstream",
};

beforeEach(() => {
  calls = [];
  logs.length = 0;
  now = FIXED;
  process.env.NASA_API_KEY = KEY;
  resetNasaKeyStateForTests();
  resetEpicCacheForTests();
  setEpicClockForTests(() => now);
  const sink = console as unknown as Record<(typeof consoleMethods)[number], (...args: unknown[]) => void>;
  for (const method of consoleMethods) {
    originals.set(method, sink[method]);
    sink[method] = (...args: unknown[]) => {
      logs.push(args.map((item) => String(item)).join(" "));
    };
  }
});

afterEach(() => {
  if (previous === undefined) delete process.env.NASA_API_KEY;
  else process.env.NASA_API_KEY = previous;
  const sink = console as unknown as Record<string, (...args: unknown[]) => void>;
  for (const [method, original] of originals) {
    sink[method] = original;
  }
  originals.clear();
});

test("returns EPIC frames without the key", async () => {
  mockJson([{ date: "2024-11-14" }, { date: "2024-11-15" }], 40);
  const dates = await getEpic(new NextRequest("http://localhost/api/listen/epic?dates=14"));
  const dateBody = await dates.json();
  assert.equal(dates.status, 200);
  assert.deepEqual(dateBody.dates, ["2024-11-14", "2024-11-15"]);
  assert.equal(dateBody.cached, false);

  mockFrames(40);
  const response = await getEpic(new NextRequest("http://localhost/api/listen/epic?date=2024-11-15"));
  const body = await response.text();
  assert.equal(response.status, 200);
  const parsed = JSON.parse(body) as {
    quality: string;
    cached: boolean;
    frames: Array<{ image: string; time: string; centroid: { lat: number; lon: number } }>;
  };
  assert.equal(parsed.quality, "image-derived");
  assert.equal(parsed.cached, false);
  assert.equal(parsed.frames[0]?.time, "2024-11-15T00:36:49.000Z");
  assert.deepEqual(parsed.frames[0]?.centroid, { lat: 1.25, lon: -20.5 });
  assert.equal(parsed.frames[0]?.image, "/api/listen/epic/image?date=2024-11-15&name=epic_1b_20241115003649");
  assertNoSecret(body);
  assert.equal(calls.every((url) => new URL(url).searchParams.get("api_key") === KEY), true);
  assert.equal(logs.some((line) => line.includes(KEY)), false);
});

test("falls back to DEMO_KEY and keeps it off the response", async () => {
  delete process.env.NASA_API_KEY;
  mockFrames(8);
  const response = await getEpic(new NextRequest("http://localhost/api/listen/epic?date=2024-11-15"));
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.equal(new URL(calls[0] ?? "").searchParams.get("api_key"), "DEMO_KEY");
  assertNoSecret(body);
});

test("serves a saved date when the remaining budget is low", async () => {
  mockFrames(4);
  const first = await getEpic(new NextRequest("http://localhost/api/listen/epic?date=2024-11-15"));
  assert.equal(first.status, 200);
  const firstCalls = calls.length;
  now += 31 * DAY;
  const second = await getEpic(new NextRequest("http://localhost/api/listen/epic?date=2024-11-15"));
  const body = await second.json();
  assert.equal(second.status, 200);
  assert.equal(body.cached, true);
  assert.equal(body.stale, true);
  assert.equal(calls.length, firstCalls);
});

test("asks NASA again when a fresh key still has budget and the copy is old", async () => {
  mockFrames(40);
  await getEpic(new NextRequest("http://localhost/api/listen/epic?date=2024-11-15"));
  const firstCalls = calls.length;
  now += 31 * DAY;
  const second = await getEpic(new NextRequest("http://localhost/api/listen/epic?date=2024-11-15"));
  const body = await second.json();
  assert.equal(body.cached, false);
  assert.equal(calls.length > firstCalls, true);
});

test("returns 429 when the budget is spent and nothing is saved", async () => {
  mockFrames(0);
  await getEpic(new NextRequest("http://localhost/api/listen/epic?date=2024-11-15"));
  resetEpicCacheForTests();
  setEpicClockForTests(() => now);
  calls = [];
  const response = await getEpic(new NextRequest("http://localhost/api/listen/epic?date=2024-11-15"));
  const body = await response.text();
  assert.equal(response.status, 429);
  assert.match(body, /Too many requests/);
  assert.equal(calls.length, 0);
  assertNoSecret(body);
});

test("rejects a bad date before calling NASA", async () => {
  const response = await getEpic(new NextRequest("http://localhost/api/listen/epic?date=2024-13-40"));
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
  const future = await getEpic(new NextRequest("http://localhost/api/listen/epic?date=2099-01-01"));
  assert.equal(future.status, 400);
});

test("proxies a frame and does not return the upstream URL", async () => {
  global.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(PNG, {
      status: 200,
      headers: {
        "content-type": "image/png",
        "X-RateLimit-Remaining": "20",
        "X-RateLimit-Limit": "1000",
      },
    });
  }) as typeof fetch;
  const response = await getImage(new NextRequest("http://localhost/api/listen/epic/image?date=2024-11-15&name=epic_1b_20241115003649"));
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(bytes, PNG);
  assert.equal(new URL(calls[0] ?? "").searchParams.get("api_key"), KEY);
  assertNoSecret([...response.headers].map(([name, value]) => `${name}:${value}`).join("\n"));
  const rejected = await getImage(new NextRequest("http://localhost/api/listen/epic/image?date=2024-11-15&name=../secret"));
  assert.equal(rejected.status, 400);
  assert.equal(calls.length, 1);
});

test("a timeout does not echo the authed URL", async () => {
  global.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    throw Object.assign(new Error(`failed ${String(input)}`), { name: "TimeoutError" });
  }) as typeof fetch;
  const response = await getEpic(new NextRequest("http://localhost/api/listen/epic?date=2024-11-15"));
  const body = await response.text();
  assert.equal(response.status, 504);
  assertNoSecret(body);
  assert.equal(logs.some((line) => line.includes(KEY)), false);
});

function mockFrames(remaining: number) {
  global.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify([FRAME]), {
      status: 200,
      headers: jsonHeaders(remaining),
    });
  }) as typeof fetch;
}

function mockJson(body: unknown, remaining: number) {
  global.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify(body), { status: 200, headers: jsonHeaders(remaining) });
  }) as typeof fetch;
}

function jsonHeaders(remaining: number): HeadersInit {
  return {
    "content-type": "application/json",
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Limit": "1000",
  };
}

function assertNoSecret(body: string) {
  assert.equal(body.includes(KEY), false);
  assert.equal(body.includes("DEMO_KEY"), false);
  assert.equal(body.toLowerCase().includes("api_key"), false);
  assert.equal(body.includes("hidden-upstream"), false);
}
