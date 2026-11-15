import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeRequire = createRequire(import.meta.url);

function transpile(filename, source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  return output.replace(/require\("@\/([^"]+)"\)/g, (_, spec) => {
    return `require(${JSON.stringify(resolve(root, "src", `${spec}.ts`))})`;
  });
}

Module._extensions[".ts"] = function loadTypeScript(mod, filename) {
  mod._compile(transpile(filename, readFileSync(filename, "utf8")), filename);
};

function loadTs(rel) {
  return nodeRequire(resolve(root, rel));
}

const {
  MeasurementCache,
  MEASUREMENT_CACHE_MAX_ENTRIES,
  MEASUREMENT_CURRENT_TTL_MS,
  MEASUREMENT_PAST_TTL_MS,
  measurementCache,
  measurementCacheControl,
  measurementCacheKey,
  measurementTtlMs,
} = loadTs("src/lib/listen/measurementCache.ts");

const PAST = "2020-01-15T12:00:00.000Z";
const NOW = Date.parse("2024-06-01T12:00:00.000Z");

function testKeys() {
  const base = { layer: "air-temp", lat: 10.12341, lon: -20.98761, time: PAST };
  assert.equal(measurementCacheKey(base), "air-temp|10.1234|-20.9876|2020-01-15T12:00:00.000Z");
  assert.equal(measurementCacheKey(base), measurementCacheKey({ ...base, lat: 10.12344, lon: -20.98764 }));
  assert.notEqual(measurementCacheKey(base), measurementCacheKey({ ...base, lat: 10.12351 }));
  assert.notEqual(measurementCacheKey(base), measurementCacheKey({ ...base, lon: -20.98771 }));
  assert.notEqual(measurementCacheKey(base), measurementCacheKey({ ...base, layer: "wind" }));
  assert.notEqual(measurementCacheKey(base), measurementCacheKey({ ...base, time: "2020-01-15T12:00:00.001Z" }));
  assert.notEqual(measurementCacheKey({ ...base, lat: -0.00004 }), measurementCacheKey({ ...base, lat: 0.00004 }));
  const key = measurementCacheKey(base);
  assert.equal(key.includes("Basic"), false);
  assert.equal(key.includes("password"), false);
  assert.equal(key.includes("METEOMATICS"), false);
}

function testTtl() {
  assert.equal(measurementTtlMs("2024-06-01T10:00:00.000Z", NOW), MEASUREMENT_PAST_TTL_MS);
  assert.equal(measurementTtlMs("2024-06-01T11:00:00.000Z", NOW), MEASUREMENT_PAST_TTL_MS);
  assert.equal(measurementTtlMs("2024-06-01T11:00:00.001Z", NOW), MEASUREMENT_CURRENT_TTL_MS);
  assert.equal(measurementTtlMs("2024-06-01T12:00:00.000Z", NOW), MEASUREMENT_CURRENT_TTL_MS);
  assert.equal(measurementTtlMs("2024-06-01T18:00:00.000Z", NOW), MEASUREMENT_CURRENT_TTL_MS);
  assert.equal(measurementTtlMs("not-a-time", NOW), MEASUREMENT_CURRENT_TTL_MS);
  assert.match(measurementCacheControl(MEASUREMENT_PAST_TTL_MS), /public, max-age=0, s-maxage=2592000, stale-while-revalidate=86400/);
  assert.match(measurementCacheControl(MEASUREMENT_CURRENT_TTL_MS), /public, max-age=0, s-maxage=3600, stale-while-revalidate=60/);
}

function testHitMissExpiry() {
  let now = 1_000_000;
  const cache = new MeasurementCache(3, () => now);
  assert.equal(cache.get("missing"), undefined);

  cache.set("a", { value: 1 }, 1_000);
  assert.deepEqual(cache.get("a"), { value: 1 });
  assert.equal(cache.get("b"), undefined);

  now = 1_001_000;
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.size, 0);

  cache.set("kept", { value: 2 }, 500);
  cache.set("dropped", { value: 3 }, 0);
  assert.deepEqual(cache.get("kept"), { value: 2 });
  assert.equal(cache.get("dropped"), undefined);

  const lru = new MeasurementCache(2, () => now);
  lru.set("old", { value: 1 }, 100);
  lru.set("mid", { value: 2 }, 100);
  lru.get("old");
  lru.set("new", { value: 3 }, 100);
  assert.equal(lru.get("mid"), undefined);
  assert.deepEqual(lru.get("old"), { value: 1 });
  assert.deepEqual(lru.get("new"), { value: 3 });
  assert.equal(lru.size, 2);
}

async function testSingleflightAndErrors() {
  let now = 5_000;
  const cache = new MeasurementCache(4, () => now);
  let calls = 0;
  let release;
  const gate = new Promise((resolveGate) => {
    release = resolveGate;
  });
  const first = cache.getOrLoad("k", 1_000, async () => {
    calls += 1;
    await gate;
    return { value: 7 };
  });
  const second = cache.getOrLoad("k", 1_000, async () => {
    calls += 1;
    return { value: 8 };
  });
  release();
  assert.deepEqual(await first, { value: 7 });
  assert.deepEqual(await second, { value: 7 });
  assert.equal(calls, 1);
  assert.deepEqual(cache.get("k"), { value: 7 });

  await assert.rejects(cache.getOrLoad("bad", 1_000, async () => {
    calls += 1;
    throw new Error("upstream");
  }));
  assert.equal(cache.get("bad"), undefined);
  const recovered = await cache.getOrLoad("bad", 1_000, async () => {
    calls += 1;
    return { value: 9 };
  });
  assert.deepEqual(recovered, { value: 9 });
  assert.equal(calls, 3);

  now += 1_000;
  assert.equal(cache.get("k"), undefined);
}

function meteomaticsBody(value, date = "2020-01-15T12:00:00Z") {
  return JSON.stringify({ data: [{ coordinates: [{ dates: [{ value, date }] }] }] });
}

async function testRoute() {
  const username = "test-user";
  const password = "test-password";
  process.env.METEOMATICS_USERNAME = username;
  process.env.METEOMATICS_PASSWORD = password;
  measurementCache.clear();

  const { NextRequest } = nodeRequire("next/server");
  const { GET } = loadTs("src/app/api/listen/measurements/route.ts");
  const calls = [];
  const originalFetch = global.fetch;

  global.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "api.meteomatics.com");
    assert.equal(url.username, "");
    assert.equal(url.password, "");
    assert.equal(url.toString().includes(password), false);
    assert.equal(url.toString().includes(username), false);
    const auth = new Headers(init?.headers).get("authorization") ?? "";
    assert.equal(auth.startsWith("Basic "), true);
    calls.push(url.toString());
    if (url.pathname.includes("t_sea")) {
      return new Response("nope", { status: 503 });
    }
    if (url.pathname.includes("ocean_current")) {
      return new Response(meteomaticsBody(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(meteomaticsBody(12.5), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const probe = (lat, layer = "air-temp", time = PAST) => {
      const url = `http://localhost/api/listen/measurements?lat=${lat}&lon=-20.98761&time=${encodeURIComponent(time)}&layer=${layer}`;
      return GET(new NextRequest(url));
    };

    const first = await probe(10.12341);
    const firstBody = await first.json();
    assert.equal(first.status, 200);
    assert.deepEqual(firstBody, {
      layer: "air-temp",
      value: 12.5,
      unit: "°C",
      time: "2020-01-15T12:00:00Z",
      lat: 10.12341,
      lon: -20.98761,
      source: "Meteomatics",
    });
    assert.match(first.headers.get("cache-control") ?? "", /s-maxage=2592000/);
    assert.equal(calls.length, 1);

    const second = await probe(10.12344);
    const secondBody = await second.json();
    assert.equal(second.status, 200);
    assert.equal(secondBody.value, 12.5);
    assert.equal(secondBody.lat, 10.12344);
    assert.equal(secondBody.source, "Meteomatics");
    assert.equal(calls.length, 1);

    const otherPoint = await probe(10.12351);
    assert.equal(otherPoint.status, 200);
    assert.equal(calls.length, 2);

    const recent = new Date(Date.now() - 60_000).toISOString();
    const recentResponse = await probe(10.12341, "air-temp", recent);
    assert.equal(recentResponse.status, 200);
    assert.match(recentResponse.headers.get("cache-control") ?? "", /s-maxage=3600/);
    assert.equal(calls.length, 3);
    const recentAgain = await probe(10.12341, "air-temp", recent);
    assert.equal(recentAgain.status, 200);
    assert.equal(calls.length, 3);

    const seaDown = await probe(10.12341, "sea-temp");
    const seaBody = await seaDown.json();
    assert.equal(seaDown.status, 502);
    assert.equal(seaBody.error, "No matched reading is available for this layer, place, and time.");
    assert.equal(seaDown.headers.get("cache-control"), "no-store");
    const seaAgain = await probe(10.12341, "sea-temp");
    assert.equal(seaAgain.status, 502);
    assert.equal(calls.length, 5);

    const empty = await probe(33, "currents");
    assert.equal(empty.status, 404);
    assert.equal((await empty.json()).error, "No valid reading was returned.");
    const emptyAgain = await probe(33, "currents");
    assert.equal(emptyAgain.status, 404);
    assert.equal(calls.length, 7);

    global.fetch = async () => {
      calls.push("down");
      throw new Error("socket");
    };
    const down = await probe(44, "sea-temp");
    assert.equal(down.status, 502);
    assert.equal((await down.json()).error, "The measurement service could not be reached.");
    const downAgain = await probe(44, "sea-temp");
    assert.equal(downAgain.status, 502);
    assert.equal(calls.filter((entry) => entry === "down").length, 2);

    const leaked = JSON.stringify(firstBody) + JSON.stringify(secondBody) + JSON.stringify(seaBody);
    assert.equal(leaked.includes(password), false);
    assert.equal(leaked.includes(username), false);
    assert.equal(leaked.includes("Basic"), false);

    delete process.env.METEOMATICS_USERNAME;
    delete process.env.METEOMATICS_PASSWORD;
    const unconfigured = await probe(10.12341, "sea-temp");
    assert.equal(unconfigured.status, 503);
    assert.equal(unconfigured.headers.get("cache-control"), "no-store");
  } finally {
    global.fetch = originalFetch;
    delete process.env.METEOMATICS_USERNAME;
    delete process.env.METEOMATICS_PASSWORD;
    measurementCache.clear();
  }
}

testKeys();
testTtl();
testHitMissExpiry();
await testSingleflightAndErrors();
await testRoute();
assert.equal(MEASUREMENT_CACHE_MAX_ENTRIES, 256);
console.log("measurement cache: key, ttl, hit/miss/expiry, and route tests passed");
