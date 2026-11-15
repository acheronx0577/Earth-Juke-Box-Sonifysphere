import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  isDemoNasaKey,
  nasaApiKey,
  nasaGet,
  nasaQuotaExhausted,
  nasaRateLimit,
  noteNasaRateLimit,
  preferNasaCache,
  redactNasaUrl,
  resetNasaKeyStateForTests,
} from "@/lib/nasa/apiKey";

const KEY = "UnitTestNasaKey99";
const previous = process.env.NASA_API_KEY;
const consoleMethods = ["log", "info", "warn", "error", "debug"] as const;
const originals = new Map<string, (...args: unknown[]) => void>();
const logs: string[] = [];

beforeEach(() => {
  logs.length = 0;
  resetNasaKeyStateForTests();
  delete process.env.NASA_API_KEY;
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

test("uses DEMO_KEY when NASA_API_KEY is missing or unsafe", () => {
  assert.equal(nasaApiKey(), "DEMO_KEY");
  assert.equal(isDemoNasaKey(), true);
  process.env.NASA_API_KEY = "  ";
  assert.equal(nasaApiKey(), "DEMO_KEY");
  process.env.NASA_API_KEY = "short";
  assert.equal(nasaApiKey(), "DEMO_KEY");
  process.env.NASA_API_KEY = "has a space inside";
  assert.equal(nasaApiKey(), "DEMO_KEY");
  process.env.NASA_API_KEY = KEY;
  assert.equal(nasaApiKey(), KEY);
  assert.equal(isDemoNasaKey(), false);
});

test("reads X-RateLimit-Remaining and prefers cache when it is low", () => {
  assert.equal(preferNasaCache(), true);
  noteNasaRateLimit(responseWith(40, 1000, 200));
  process.env.NASA_API_KEY = KEY;
  assert.equal(nasaRateLimit().remaining, 40);
  assert.equal(nasaRateLimit().limit, 1000);
  assert.equal(preferNasaCache(), false);
  noteNasaRateLimit(responseWith(5, 1000, 200));
  assert.equal(preferNasaCache(), true);
  noteNasaRateLimit(responseWith(0, 1000, 429));
  assert.equal(nasaQuotaExhausted(), true);
});

test("a 429 response sets the remaining budget to zero", () => {
  process.env.NASA_API_KEY = KEY;
  noteNasaRateLimit(new Response(null, { status: 429 }));
  assert.equal(nasaRateLimit().remaining, 0);
  assert.equal(nasaQuotaExhausted(), true);
});

test("redacts api_key and never logs it from nasaGet", async () => {
  assert.equal(redactNasaUrl("https://api.nasa.gov/EPIC?api_key=UnitTestNasaKey99&x=1"), "https://api.nasa.gov/EPIC?api_key=&x=1");
  process.env.NASA_API_KEY = KEY;
  let seen = "";
  global.fetch = (async (input: RequestInfo | URL) => {
    seen = String(input);
    throw Object.assign(new Error(`boom ${String(input)}`), { name: "TimeoutError" });
  }) as typeof fetch;
  await assert.rejects(nasaGet(new URL("https://api.nasa.gov/EPIC/api/natural/all")), (error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    assert.equal(message.includes(KEY), false);
    assert.equal(message.includes("api_key"), false);
    return true;
  });
  assert.equal(new URL(seen).searchParams.get("api_key"), KEY);
  assert.equal(logs.some((line) => line.includes(KEY) || line.includes("api_key")), false);
});

function responseWith(remaining: number, limit: number, status: number): Response {
  return new Response(null, {
    status,
    headers: {
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Limit": String(limit),
    },
  });
}
