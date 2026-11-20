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

const power = loadTs("src/lib/listen/power.ts");
const { NextRequest } = nodeRequire("next/server");
const measurements = loadTs("src/app/api/listen/measurements/route.ts");
const powerRoute = loadTs("src/app/api/listen/power/route.ts");

const PAST = "2020-01-15T12:00:00.000Z";
const PAST_LATER = "2020-01-15T18:30:00.000Z";
const DAY = "20200115";
const NOW = Date.parse("2024-06-15T12:00:00.000Z");

function fixture(parameter, day, value) {
  const series = value === undefined ? {} : { [day]: value };
  return {
    properties: { parameter: { [parameter]: series } },
    header: { fill_value: -999, time_standard: "UTC", start: day, end: day },
    parameters: { [parameter]: { units: parameter === "WS10M" ? "m/s" : "C" } },
    messages: [],
  };
}

function testParseAndKey() {
  assert.equal(power.parsePowerDaily(fixture("T2M", DAY, 26.3), "T2M", DAY), 26.3);
  assert.equal(power.parsePowerDaily(fixture("WS10M", DAY, 4.12), "WS10M", DAY), 4.12);
  assert.equal(power.parsePowerDaily(fixture("T2M", DAY, 0), "T2M", DAY), 0);
  assert.equal(power.parsePowerDaily(fixture("T2M", DAY, -12.5), "T2M", DAY), -12.5);
  assert.equal(power.parsePowerDaily(fixture("T2M", DAY, -999), "T2M", DAY), null);
  assert.equal(power.parsePowerDaily(fixture("T2M", DAY, undefined), "T2M", DAY), null);
  assert.equal(power.parsePowerDaily(fixture("T2M", DAY, Number.NaN), "T2M", DAY), null);
  assert.equal(power.parsePowerDaily({ properties: { parameter: { T2M: {} } } }, "T2M", DAY), null);
  assert.equal(power.parsePowerDaily(null, "T2M", DAY), null);

  const key = power.powerCacheKey("air-temp", 10.12341, -20.98761, DAY);
  assert.equal(key, "air-temp|10.1234|-20.9876|20200115|UTC");
  assert.equal(key, power.powerCacheKey("air-temp", 10.12344, -20.98764, DAY));
  assert.notEqual(key, power.powerCacheKey("wind", 10.12341, -20.98761, DAY));
  assert.notEqual(key, power.powerCacheKey("air-temp", 10.12341, -20.98761, "20200116"));
  assert.equal(key.includes("password"), false);
  assert.equal(key.includes("METEOMATICS"), false);
  assert.equal(key.includes("NASA_API"), false);

  const url = new URL(power.powerPointUrl(30, -40.12344, "T2M", DAY));
  assert.equal(url.hostname, "power.larc.nasa.gov");
  assert.equal(url.searchParams.get("parameters"), "T2M");
  assert.equal(url.searchParams.get("community"), "RE");
  assert.equal(url.searchParams.get("latitude"), "30.0000");
  assert.equal(url.searchParams.get("longitude"), "-40.1234");
  assert.equal(url.searchParams.get("start"), DAY);
  assert.equal(url.searchParams.get("end"), DAY);
  assert.equal(url.searchParams.get("format"), "JSON");
  assert.equal(url.searchParams.get("time-standard"), "UTC");
  assert.equal(url.searchParams.has("api_key"), false);

  const climate = {
    properties: { parameter: { PRECTOTCORR: { JAN: 1, ANN: 3.37 } } },
    header: { fill_value: -999, time_standard: "LST" },
  };
  assert.equal(power.parsePowerClimatology(climate, "PRECTOTCORR"), 3.37);
  assert.equal(power.parsePowerClimatology({ ...climate, properties: { parameter: { PRECTOTCORR: { ANN: 0 } } } }, "PRECTOTCORR"), 0);
  assert.equal(power.parsePowerClimatology({ ...climate, properties: { parameter: { PRECTOTCORR: { ANN: -999 } } } }, "PRECTOTCORR"), null);
  assert.equal(power.parsePowerClimatology({ properties: { parameter: { PRECTOTCORR: { JAN: 1 } } } }, "PRECTOTCORR"), null);
  assert.equal(power.parsePowerClimatology(null, "PRECTOTCORR"), null);
  const climateUrl = new URL(power.powerClimatologyUrl(47.6062, -122.33214, "PRECTOTCORR"));
  assert.equal(climateUrl.hostname, "power.larc.nasa.gov");
  assert.equal(climateUrl.pathname, "/api/temporal/climatology/point");
  assert.equal(climateUrl.searchParams.get("parameters"), "PRECTOTCORR");
  assert.equal(climateUrl.searchParams.get("community"), "RE");
  assert.equal(climateUrl.searchParams.get("latitude"), "47.6062");
  assert.equal(climateUrl.searchParams.get("longitude"), "-122.3321");
  assert.equal(climateUrl.searchParams.has("api_key"), false);
  assert.equal(climateUrl.searchParams.has("start"), false);

  assert.equal(power.powerTtlMs(DAY, NOW), 30 * 24 * 60 * 60 * 1000);
  assert.equal(power.powerTtlMs("20240613", NOW), 30 * 24 * 60 * 60 * 1000);
  assert.equal(power.powerTtlMs("20240614", NOW), 24 * 60 * 60 * 1000);
  assert.equal(power.powerTtlMs("20240615", NOW), 24 * 60 * 60 * 1000);
  assert.equal(power.powerTtlMs("20240616", NOW), 24 * 60 * 60 * 1000);
  assert.match(power.powerCacheControl(30 * 24 * 60 * 60 * 1000), /s-maxage=2592000/);
  assert.match(power.powerCacheControl(24 * 60 * 60 * 1000), /s-maxage=86400/);
}

function testCacheExpiry() {
  let now = 1_000_000;
  const cache = new power.PowerValueCache(2, () => now);
  cache.set("a", 1, 500);
  assert.equal(cache.get("a"), 1);
  now += 500;
  assert.equal(cache.get("a"), undefined);
  cache.set("old", 1, 1000);
  cache.set("mid", 2, 1000);
  cache.get("old");
  cache.set("new", 3, 1000);
  assert.equal(cache.get("mid"), undefined);
  assert.equal(cache.get("old"), 1);
  assert.equal(cache.get("new"), 3);
  cache.set("skip", 4, 0);
  assert.equal(cache.get("skip"), undefined);
}

async function testSingleflight() {
  power.clearPowerCache();
  let calls = 0;
  let release;
  const gate = new Promise((resolveGate) => {
    release = resolveGate;
  });
  const original = global.fetch;
  global.fetch = async () => {
    calls += 1;
    await gate;
    return new Response(JSON.stringify(fixture("T2M", DAY, 11)), { status: 200 });
  };
  try {
    const input = { layer: "air-temp", lat: 1.25, lon: 2.5, time: PAST };
    const first = power.readPowerPoint(input);
    const second = power.readPowerPoint(input);
    release();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.ok && a.body.value, 11);
    assert.equal(b.ok && b.body.value, 11);
    assert.equal(calls, 1);
    const third = await power.readPowerPoint(input);
    assert.equal(third.ok && third.body.value, 11);
    assert.equal(calls, 1);

    global.fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify(fixture("T2M", DAY, -999)), { status: 200 });
    };
    const empty = await power.readPowerPoint({ ...input, lat: 3 });
    const emptyAgain = await power.readPowerPoint({ ...input, lat: 3 });
    assert.equal(empty.ok, false);
    assert.equal(empty.status, 404);
    assert.equal(emptyAgain.status, 404);
    assert.equal(calls, 3);

    global.fetch = async () => {
      calls += 1;
      return new Response("no", { status: 503 });
    };
    const down = await power.readPowerPoint({ ...input, lat: 4 });
    const downAgain = await power.readPowerPoint({ ...input, lat: 4 });
    assert.equal(down.status, 502);
    assert.equal(down.error, "The data service could not be reached.");
    assert.equal(downAgain.status, 502);
    assert.equal(calls, 5);
  } finally {
    global.fetch = original;
    power.clearPowerCache();
  }
}

function request(path, lat, lon, time, layer) {
  const url = `http://localhost${path}?lat=${lat}&lon=${lon}&time=${encodeURIComponent(time)}&layer=${layer}`;
  return new NextRequest(url);
}

async function testRoutes() {
  power.clearPowerCache();
  delete process.env.METEOMATICS_USERNAME;
  delete process.env.METEOMATICS_PASSWORD;
  const username = "test-user";
  const password = "test-password";
  const calls = [];
  const original = global.fetch;

  global.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.username, "");
    assert.equal(url.password, "");
    assert.equal(url.toString().includes(password), false);
    assert.equal(url.toString().includes(username), false);
    assert.equal(url.searchParams.has("api_key"), false);
    calls.push(`${url.hostname} ${url.searchParams.get("parameters") ?? url.pathname}`);
    if (url.hostname === "power.larc.nasa.gov") {
      const parameter = url.searchParams.get("parameters");
      const day = url.searchParams.get("start");
      if (url.searchParams.get("latitude") === "8.0000") {
        return new Response(JSON.stringify(fixture(parameter, day, -999)), { status: 200 });
      }
      const value = parameter === "WS10M" ? 4.12 : 26.3;
      return new Response(JSON.stringify(fixture(parameter, day, value)), { status: 200 });
    }
    if (url.hostname === "api.meteomatics.com") {
      if (url.pathname.includes("8.0000") || url.pathname.includes("9.0000") || url.pathname.includes("t_sea")) {
        return new Response("down", { status: 503 });
      }
      return new Response(JSON.stringify({
        data: [{ coordinates: [{ dates: [{ value: 18.5, date: "2020-01-15T12:00:00Z" }] }] }],
      }), { status: 200 });
    }
    throw new Error(`unexpected host ${url.hostname}`);
  };

  try {
    const disabled = await measurements.GET(request("/api/listen/measurements", 30, -40, PAST, "air-temp"));
    const disabledBody = await disabled.json();
    assert.equal(disabled.status, 200);
    assert.equal(disabledBody.source, "POWER");
    assert.equal(disabledBody.value, 26.3);
    assert.equal(disabledBody.unit, "°C");
    assert.equal(disabledBody.time, PAST);
    assert.equal(disabledBody.lat, 30);
    assert.equal(disabledBody.lon, -40);
    assert.equal(disabledBody.resolution, "daily");
    assert.equal(disabledBody.layer, "air-temp");
    assert.match(disabled.headers.get("cache-control") ?? "", /s-maxage=2592000/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].startsWith("power.larc.nasa.gov"), true);

    const repeat = await measurements.GET(request("/api/listen/measurements", 30.00004, -40, PAST_LATER, "air-temp"));
    const repeatBody = await repeat.json();
    assert.equal(repeat.status, 200);
    assert.equal(repeatBody.source, "POWER");
    assert.equal(repeatBody.value, 26.3);
    assert.equal(repeatBody.time, PAST_LATER);
    assert.equal(repeatBody.lat, 30.00004);
    assert.equal(calls.length, 1);

    const sea = await measurements.GET(request("/api/listen/measurements", 30, -40, PAST, "sea-temp"));
    assert.equal(sea.status, 503);
    assert.equal((await sea.json()).error, "Meteomatics is not configured on this server.");
    assert.equal(calls.length, 1);

    const windRoute = await powerRoute.GET(request("/api/listen/power", 12, 8, PAST, "wind"));
    const windBody = await windRoute.json();
    assert.equal(windRoute.status, 200);
    assert.equal(windBody.source, "POWER");
    assert.equal(windBody.value, 4.12);
    assert.equal(windBody.unit, "m/s");
    assert.equal(windBody.resolution, "daily");
    const windAgain = await powerRoute.GET(request("/api/listen/power", 12, 8, PAST, "wind"));
    assert.equal((await windAgain.json()).value, 4.12);
    assert.equal(calls.length, 2);

    const rejectedLayer = await powerRoute.GET(request("/api/listen/power", 12, 8, PAST, "sea-temp"));
    assert.equal(rejectedLayer.status, 400);
    assert.equal(calls.length, 2);

    process.env.METEOMATICS_USERNAME = username;
    process.env.METEOMATICS_PASSWORD = password;
    const live = await measurements.GET(request("/api/listen/measurements", 5, 6, PAST, "wind"));
    const liveBody = await live.json();
    assert.equal(live.status, 200);
    assert.equal(liveBody.source, "Meteomatics");
    assert.equal(liveBody.value, 18.5);
    assert.equal(calls.at(-1).startsWith("api.meteomatics.com"), true);
    const beforeFallback = calls.length;
    const fallback = await measurements.GET(request("/api/listen/measurements", 9, 6, PAST, "air-temp"));
    const fallbackBody = await fallback.json();
    assert.equal(fallback.status, 200);
    assert.equal(fallbackBody.source, "POWER");
    assert.equal(fallbackBody.value, 26.3);
    assert.equal(calls.length, beforeFallback + 2);
    assert.equal(calls.at(-2).startsWith("api.meteomatics.com"), true);
    assert.equal(calls.at(-1).startsWith("power.larc.nasa.gov"), true);
    const fallbackAgain = await measurements.GET(request("/api/listen/measurements", 9, 6, PAST, "air-temp"));
    assert.equal((await fallbackAgain.json()).source, "POWER");
    assert.equal(calls.length, beforeFallback + 3);
    assert.equal(calls.at(-1).startsWith("api.meteomatics.com"), true);

    const seaDown = await measurements.GET(request("/api/listen/measurements", 5, 6, PAST, "sea-temp"));
    const seaBody = await seaDown.json();
    assert.equal(seaDown.status, 502);
    assert.equal(seaBody.error, "No matched reading is available for this layer, place, and time.");
    assert.equal(calls.at(-1).startsWith("api.meteomatics.com"), true);

    const beforeFill = calls.length;
    const fill = await measurements.GET(request("/api/listen/measurements", 8, 6, PAST, "wind"));
    assert.equal(fill.status, 404);
    assert.equal((await fill.json()).error, "No reading for this place and time.");
    const fillAgain = await measurements.GET(request("/api/listen/measurements", 8, 6, PAST, "wind"));
    assert.equal(fillAgain.status, 404);
    assert.equal(calls.length, beforeFill + 4);

    const leaked = JSON.stringify(disabledBody) + JSON.stringify(fallbackBody) + JSON.stringify(seaBody);
    assert.equal(leaked.includes(username), false);
    assert.equal(leaked.includes(password), false);
    assert.equal(leaked.includes("Basic"), false);
  } finally {
    global.fetch = original;
    delete process.env.METEOMATICS_USERNAME;
    delete process.env.METEOMATICS_PASSWORD;
    power.clearPowerCache();
  }
}

function climatologyFixture(ann) {
  return {
    properties: { parameter: { PRECTOTCORR: { ANN: ann, JAN: ann } } },
    header: { fill_value: -999, time_standard: "LST" },
    parameters: { PRECTOTCORR: { units: "mm/day" } },
    messages: [],
  };
}

async function testPrecipitationRoute() {
  power.clearPowerCache();
  delete process.env.METEOMATICS_USERNAME;
  delete process.env.METEOMATICS_PASSWORD;
  const original = global.fetch;
  const calls = [];
  global.fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url.hostname);
    assert.equal(url.searchParams.has("api_key"), false);
    assert.equal(url.username, "");
    if (url.hostname === "api.meteomatics.com") {
      return new Response(JSON.stringify({
        data: [{ coordinates: [{ dates: [{ value: 18.5, date: "2020-01-15T12:00:00Z" }] }] }],
      }), { status: 200 });
    }
    if (url.hostname !== "power.larc.nasa.gov") {
      throw new Error(`unexpected host ${url.hostname}`);
    }
    assert.equal(url.pathname, "/api/temporal/climatology/point");
    assert.equal(url.searchParams.get("parameters"), "PRECTOTCORR");
    assert.equal(url.searchParams.get("community"), "RE");
    const latitude = url.searchParams.get("latitude");
    if (latitude === "8.0000") return new Response(JSON.stringify(climatologyFixture(-999)), { status: 200 });
    if (latitude === "23.4162") return new Response(JSON.stringify(climatologyFixture(0)), { status: 200 });
    return new Response(JSON.stringify(climatologyFixture(3.37)), { status: 200 });
  };
  try {
    const reading = await measurements.GET(request("/api/listen/measurements", 47.6062, -122.3321, PAST, "precip"));
    const body = await reading.json();
    assert.equal(reading.status, 200);
    assert.equal(body.source, "POWER");
    assert.equal(body.layer, "precip");
    assert.equal(body.value, 3.37);
    assert.equal(body.unit, "mm/day");
    assert.equal(body.resolution, "climatology");
    assert.equal(body.time, PAST);
    assert.match(reading.headers.get("cache-control") ?? "", /s-maxage=2592000/);
    assert.equal(calls.length, 1);

    const again = await measurements.GET(request("/api/listen/measurements", 47.60624, -122.3321, PAST_LATER, "precip"));
    assert.equal((await again.json()).value, 3.37);
    assert.equal(calls.length, 1);

    process.env.METEOMATICS_USERNAME = "test-user";
    process.env.METEOMATICS_PASSWORD = "test-password";
    const dry = await measurements.GET(request("/api/listen/measurements", 23.4162, 25.6628, PAST, "precip"));
    const dryBody = await dry.json();
    assert.equal(dry.status, 200);
    assert.equal(dryBody.value, 0);
    assert.equal(dryBody.unit, "mm/day");
    assert.equal(calls.at(-1), "power.larc.nasa.gov");
    assert.equal(calls.length, 2);

    const missing = await measurements.GET(request("/api/listen/measurements", 8, 6, PAST, "precip"));
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error, "No reading for this place and time.");
    const missingAgain = await measurements.GET(request("/api/listen/measurements", 8, 6, PAST, "precip"));
    assert.equal(missingAgain.status, 404);
    assert.equal(calls.length, 4);

    const windStill = await measurements.GET(request("/api/listen/measurements", 5.5, 6.5, PAST, "wind"));
    assert.equal(windStill.status, 200);
    assert.equal((await windStill.json()).source, "Meteomatics");
    assert.equal(calls.at(-1), "api.meteomatics.com");
  } finally {
    global.fetch = original;
    delete process.env.METEOMATICS_USERNAME;
    delete process.env.METEOMATICS_PASSWORD;
    power.clearPowerCache();
  }
}

testParseAndKey();
testCacheExpiry();
await testSingleflight();
await testRoutes();
await testPrecipitationRoute();
console.log("POWER fallback: parser, cache, route, and Meteomatics fallback tests passed");
