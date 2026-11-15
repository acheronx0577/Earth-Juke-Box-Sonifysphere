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
  FixedWindowRateLimit,
  MEASUREMENTS_LIMIT,
  MEASUREMENTS_WINDOW_MS,
  RATE_LIMIT_MESSAGE,
  SOUND_VARIATION_LIMIT,
  SOUND_VARIATION_WINDOW_MS,
  clientIp,
  measurementsRateLimit,
  soundVariationRateLimit,
} = loadTs("src/lib/listen/rateLimit.ts");

function testWindow() {
  let now = 10_000;
  const limiter = new FixedWindowRateLimit(2, 60_000, 10, () => now);
  assert.deepEqual(limiter.check("a"), { ok: true });
  assert.deepEqual(limiter.check("a"), { ok: true });
  const blocked = limiter.check("a");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.retryAfterSeconds, 60);
  assert.deepEqual(limiter.check("b"), { ok: true });

  now += 30_000;
  const later = limiter.check("a");
  assert.equal(later.ok, false);
  assert.equal(later.retryAfterSeconds, 30);

  now += 30_000;
  assert.deepEqual(limiter.check("a"), { ok: true });
  assert.deepEqual(limiter.check("a"), { ok: true });
  assert.equal(limiter.check("a").ok, false);
}

function testBucketCap() {
  let now = 0;
  const limiter = new FixedWindowRateLimit(1, 60_000, 2, () => now);
  assert.equal(limiter.check("a").ok, true);
  assert.equal(limiter.check("b").ok, true);
  assert.equal(limiter.check("c").ok, true);
  assert.equal(limiter.check("a").ok, true);
  assert.equal(limiter.check("c").ok, false);
}

function testClientIp() {
  const headers = new Map([
    ["x-real-ip", " 203.0.113.9 "],
    ["x-forwarded-for", "198.51.100.4, 10.0.0.1"],
  ]);
  assert.equal(clientIp((name) => headers.get(name) ?? null), "203.0.113.9");
  headers.delete("x-real-ip");
  assert.equal(clientIp((name) => headers.get(name) ?? null), "198.51.100.4");
  headers.delete("x-forwarded-for");
  assert.equal(clientIp(() => null), "unknown");
}

function meteomaticsBody() {
  return JSON.stringify({ data: [{ coordinates: [{ dates: [{ value: 3.25, date: "2020-01-15T12:00:00Z" }] }] }] });
}

async function testRoutes() {
  const username = "test-user";
  const password = "test-password";
  const elevenKey = "test-eleven-key";
  process.env.METEOMATICS_USERNAME = username;
  process.env.METEOMATICS_PASSWORD = password;
  process.env.ELEVENLABS_SOUND_GENERATION_ENABLED = "true";
  process.env.ELEVENLABS_API_KEY = elevenKey;
  measurementsRateLimit.clear();
  soundVariationRateLimit.clear();

  const { NextRequest } = nodeRequire("next/server");
  const measurements = loadTs("src/app/api/listen/measurements/route.ts");
  const sound = loadTs("src/app/api/listen/sound-variation/route.ts");
  const calls = [];
  const originalFetch = global.fetch;
  const time = "2020-01-15T12:00:00.000Z";

  global.fetch = async (input) => {
    const url = String(input);
    assert.equal(url.includes(password), false);
    assert.equal(url.includes(username), false);
    assert.equal(url.includes(elevenKey), false);
    calls.push(new URL(url).hostname);
    if (url.includes("elevenlabs")) {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
    }
    return new Response(meteomaticsBody(), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const measure = (ip, lat = "10", lon = "20") => {
    const url = `http://localhost/api/listen/measurements?lat=${lat}&lon=${lon}&time=${encodeURIComponent(time)}&layer=air-temp`;
    return measurements.GET(new NextRequest(url, { headers: { "x-real-ip": ip } }));
  };
  const vary = (ip, body = { instrument: "glass" }) => {
    return sound.POST(new NextRequest("http://localhost/api/listen/sound-variation", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": ip },
      body: JSON.stringify(body),
    }));
  };

  try {
    for (let i = 0; i < MEASUREMENTS_LIMIT; i += 1) {
      const response = await measure("203.0.113.10", "not-a-number");
      assert.equal(response.status, 400);
    }
    assert.equal(calls.length, 0);
    const first = await measure("203.0.113.10", "10", "20.0000");
    assert.equal(first.status, 200);
    assert.equal((await first.json()).source, "Meteomatics");
    assert.equal(calls.length, 1);

    for (let i = 1; i < MEASUREMENTS_LIMIT; i += 1) {
      const response = await measure("203.0.113.10", "10", (20 + i * 0.0001).toFixed(4));
      assert.equal(response.status, 200);
    }
    assert.equal(calls.length, MEASUREMENTS_LIMIT);
    const blocked = await measure("203.0.113.10", "10", "21.0000");
    const blockedBody = await blocked.json();
    assert.equal(blocked.status, 429);
    assert.equal(blockedBody.error, RATE_LIMIT_MESSAGE);
    assert.equal(blockedBody.error, "Too many requests, try again in a minute");
    assert.equal(blocked.headers.get("cache-control"), "no-store");
    const retryAfter = Number(blocked.headers.get("retry-after"));
    assert.equal(retryAfter >= 1 && retryAfter <= MEASUREMENTS_WINDOW_MS / 1000, true);
    assert.equal(calls.length, MEASUREMENTS_LIMIT);
    assert.equal(JSON.stringify(blockedBody).includes(password), false);
    assert.equal(JSON.stringify(blockedBody).includes(username), false);

    const otherIp = await measure("203.0.113.11", "10", "22.0000");
    assert.equal(otherIp.status, 200);
    assert.equal(calls.length, MEASUREMENTS_LIMIT + 1);

    for (let i = 0; i < SOUND_VARIATION_LIMIT; i += 1) {
      const response = await vary("203.0.113.10");
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "audio/mpeg");
    }
    const beforeSoundBlock = calls.length;
    const soundBlocked = await vary("203.0.113.10");
    const soundBody = await soundBlocked.json();
    assert.equal(soundBlocked.status, 429);
    assert.equal(soundBody.error, "Too many requests, try again in a minute");
    assert.equal(soundBlocked.headers.get("cache-control"), "no-store");
    assert.equal(calls.length, beforeSoundBlock);
    assert.equal(JSON.stringify(soundBody).includes(elevenKey), false);

    const invalid = await vary("198.51.100.8", { instrument: "nope" });
    assert.equal(invalid.status, 400);
    assert.equal(calls.length, beforeSoundBlock);

    delete process.env.ELEVENLABS_SOUND_GENERATION_ENABLED;
    for (let i = 0; i < SOUND_VARIATION_LIMIT + 2; i += 1) {
      const response = await vary("198.51.100.20");
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error, "ElevenLabs generation is disabled on this server.");
    }
    assert.equal(calls.length, beforeSoundBlock);
  } finally {
    global.fetch = originalFetch;
    delete process.env.METEOMATICS_USERNAME;
    delete process.env.METEOMATICS_PASSWORD;
    delete process.env.ELEVENLABS_SOUND_GENERATION_ENABLED;
    delete process.env.ELEVENLABS_API_KEY;
    measurementsRateLimit.clear();
    soundVariationRateLimit.clear();
  }
}

testWindow();
testBucketCap();
testClientIp();
await testRoutes();
assert.equal(SOUND_VARIATION_LIMIT, 6);
assert.equal(SOUND_VARIATION_WINDOW_MS, 60_000);
console.log("rate limit: window, cap, client address, and route burst tests passed");
