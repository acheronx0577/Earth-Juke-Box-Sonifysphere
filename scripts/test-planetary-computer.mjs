import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeRequire = createRequire(import.meta.url);

function loadTs(rel) {
  const filename = resolve(root, rel);
  if (nodeRequire.cache[filename]) return nodeRequire.cache[filename].exports;
  const source = readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText.replace(/require\("@\/([^"]+)"\)/g, (_, spec) => `require(${JSON.stringify(resolve(root, "src", `${spec}.ts`))})`);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  mod._compile(output, filename);
  nodeRequire.cache[filename] = mod;
  return mod.exports;
}

const pc = loadTs("src/lib/listen/planetaryComputer.ts");
const { NextRequest } = nodeRequire("next/server");
const searchRoute = loadTs("src/app/api/listen/pc/search/route.ts");
const pointRoute = loadTs("src/app/api/listen/pc/point/route.ts");

const SCENE_ID = "MOD11A1.A2023197.h17v04.061.2023213090725";
const SECRET_HREF = "https://modis.blob.core.windows.net/lst/file.tif?sig=SECRETTOKEN";

function sceneFeature(band = { unit: "Kelvin", scale: 0.02, data_type: "uint16", spatial_resolution: 1000 }) {
  return {
    id: SCENE_ID,
    properties: { datetime: null, start_datetime: "2023-07-16T00:00:00Z" },
    assets: {
      LST_Day_1km: {
        href: SECRET_HREF,
        "raster:bands": [band],
      },
    },
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function installFetch(handler) {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init, calls);
  };
  return calls;
}

function assertNoSecrets(payload) {
  const text = JSON.stringify(payload);
  assert.equal(text.includes("SECRET"), false);
  assert.equal(text.includes("sig="), false);
  assert.equal(text.includes("blob.core.windows.net"), false);
  assert.equal(text.includes(SECRET_HREF), false);
}

const band = { scale: 0.02, offset: 0, nodata: null, unit: "Kelvin", resolutionMeters: 1000 };

assert.equal(pc.scaleReading(15596, band), 311.92);
assert.equal(pc.scaleReading(0, band), null);
assert.equal(pc.scaleReading(-999, band), null);
assert.equal(pc.scaleReading(Number.NaN, band), null);
assert.equal(pc.scaleReading(null, band), null);
assert.equal(pc.scaleReading(100, { ...band, scale: 0.02, offset: 0.5 }), 2.5);
assert.equal(pc.scaleReading(7, { ...band, nodata: 7 }), null);
assert.equal(pc.scaleReading(8, { ...band, nodata: 7 }), 0.16);

const parsedScene = pc.sceneFromFeature(sceneFeature());
assert.equal(parsedScene.summary.sceneId, SCENE_ID);
assert.equal(parsedScene.summary.date, "2023-07-16");
assert.equal(parsedScene.summary.unit, "Kelvin");
assert.equal(parsedScene.summary.nodata, 0);
assert.equal(parsedScene.summary.resolution, "1000 m");
assertNoSecrets(parsedScene.summary);

assert.equal(pc.parseQuery(new URLSearchParams("lat=91&lon=0&time=2023-07-16"), "search"), null);
assert.equal(pc.parseQuery(new URLSearchParams("lat=40&lon=0&time=2023-02-31"), "search"), null);
assert.equal(pc.parseQuery(new URLSearchParams("lat=40&lon=0&time=2099-01-01"), "search"), null);
assert.equal(pc.parseQuery(new URLSearchParams("lat=40&lon=0&time=1999-01-01"), "search"), null);
assert.equal(pc.parseQuery(new URLSearchParams("lat=40&lon=0&time=2023-07-16&collection=invalid-collection-xyz"), "point"), null);
assert.equal(pc.parseQuery(new URLSearchParams("lat=40&lon=0&time=2023-07-16&collection=landsat-c2-l2"), "point")?.collection, "landsat-c2-l2");
assert.equal(pc.parseQuery(new URLSearchParams("lat=40&lon=0&time=2023-07-16&collection=sentinel-2-l2a"), "search")?.collection, "sentinel-2-l2a");
assert.equal(pc.parseQuery(new URLSearchParams("lat=40&lon=0&time=2023-07-16&item=../secret"), "point"), null);
assert.equal(pc.parseDay("2023-07-16T12:00:00.000Z"), "2023-07-16");

const pointCalls = installFetch(async (url) => {
  if (url.endsWith("/search")) return jsonResponse({ features: [sceneFeature()] });
  if (url.includes("/item/point/")) return jsonResponse({ coordinates: [-3.7, 40.42], values: [15596], band_names: ["LST_Day_1km_b1"] });
  throw new Error(`Unexpected live call ${url}`);
});
const pointResponse = await pointRoute.GET(new NextRequest("http://localhost/api/listen/pc/point?lat=40.416&lon=-3.704&time=2023-07-16"));
const pointBody = await pointResponse.json();
assert.equal(pointResponse.status, 200);
assert.equal(pointBody.value, 311.92);
assert.equal(pointBody.unit, "Kelvin");
assert.equal(pointBody.sceneId, SCENE_ID);
assert.equal(pointBody.date, "2023-07-16");
assert.equal(pointBody.time, "2023-07-16T00:00:00Z");
assert.equal(pointBody.quality, "measured");
assert.equal(pointBody.source, "Microsoft Planetary Computer");
assert.equal(pointBody.lat, 40.42);
assert.equal(pointBody.lon, -3.7);
assert.equal(pointResponse.headers.get("Cache-Control"), "public, s-maxage=2592000, stale-while-revalidate=604800");
assert.equal(pointCalls.length, 2);
assert.equal(pointCalls.some((call) => call.url.includes("unscale=true")), false);
assert.equal(pointCalls[0].url.endsWith("/search"), true);
const searchPayload = JSON.parse(pointCalls[0].init.body);
assert.deepEqual(searchPayload.collections, ["modis-11A1-061"]);
assert.equal(searchPayload.limit, 5);
assert.equal(searchPayload.datetime, "2023-07-16T00:00:00Z/2023-07-16T23:59:59Z");
assertNoSecrets(pointBody);

const fillCalls = installFetch(async (url) => {
  if (url.includes(`/items/${SCENE_ID}`)) return jsonResponse(sceneFeature());
  if (url.includes("/item/point/")) return jsonResponse({ coordinates: [-3.7, 40.42], values: [0], band_names: ["LST_Day_1km_b1"] });
  throw new Error(`Unexpected live call ${url}`);
});
const fillResponse = await pointRoute.GET(new NextRequest(`http://localhost/api/listen/pc/point?lat=40.42&lon=-3.7&item=${SCENE_ID}`));
const fillBody = await fillResponse.json();
assert.equal(fillResponse.status, 404);
assert.equal(fillBody.value, null);
assert.equal(fillBody.sceneId, SCENE_ID);
assert.equal(fillBody.date, "2023-07-16");
assert.equal(fillBody.error, "No reading for this place and time");
assert.equal(fillCalls.some((call) => call.url.includes("/search")), false);
assertNoSecrets(fillBody);

installFetch(async (url) => {
  if (url.includes(`/items/${SCENE_ID}`)) return jsonResponse(sceneFeature({ unit: "Kelvin", scale: 0.02, offset: 1, nodata: -999, spatial_resolution: 1000 }));
  if (url.includes("/item/point/")) return jsonResponse({ values: [-999] });
  throw new Error(`Unexpected live call ${url}`);
});
const sentinel = await pointRoute.GET(new NextRequest(`http://localhost/api/listen/pc/point?lat=1&lon=2&item=${SCENE_ID}`));
assert.equal(sentinel.status, 404);
assert.equal((await sentinel.json()).value, null);

installFetch(async () => jsonResponse({ token: "SECRET", detail: "sig=ABC" }, 500));
const upstream = await pointRoute.GET(new NextRequest(`http://localhost/api/listen/pc/point?lat=1&lon=2&item=${SCENE_ID}`));
const upstreamBody = await upstream.json();
assert.equal(upstream.status, 502);
assert.equal(upstreamBody.error, "The data service could not be reached");
assertNoSecrets(upstreamBody);
assert.equal(upstream.headers.get("Cache-Control"), "no-store");

installFetch(async () => {
  const error = new Error("timed out");
  error.name = "TimeoutError";
  throw error;
});
const timedOut = await pointRoute.GET(new NextRequest("http://localhost/api/listen/pc/point?lat=1&lon=2&time=2023-07-16"));
assert.equal(timedOut.status, 504);

installFetch(async () => jsonResponse({ error: "SECRET" }, 429));
const limited = await searchRoute.GET(new NextRequest("http://localhost/api/listen/pc/search?lat=1&lon=2&time=2023-07-16"));
const limitedBody = await limited.json();
assert.equal(limited.status, 429);
assert.equal(limitedBody.error, "Too many requests, try again in a minute");
assertNoSecrets(limitedBody);

const blocked = installFetch(async () => {
  throw new Error("Live calls are not allowed in tests");
});
for (const url of [
  "http://localhost/api/listen/pc/point?lat=91&lon=0&time=2023-07-16",
  "http://localhost/api/listen/pc/search?lat=10&lon=10&time=2023-07-16&collection=unsupported-satellite-xyz",
  "http://localhost/api/listen/pc/point?lat=10&lon=10&item=a/b",
  "http://localhost/api/listen/pc/search?lat=10&lon=10",
]) {
  const response = await (url.includes("/search") ? searchRoute : pointRoute).GET(new NextRequest(url));
  assert.equal(response.status, 400, url);
}
assert.equal(blocked.length, 0);

const searchCalls = installFetch(async (url) => {
  assert.equal(url.endsWith("/search"), true);
  return jsonResponse({
    features: [
      {
        ...sceneFeature(),
        id: "MYD11A1.A2023197.h17v04.061.2023213034335",
      },
      sceneFeature(),
    ],
  });
});
const searchResponse = await searchRoute.GET(new NextRequest("http://localhost/api/listen/pc/search?lat=40.42&lon=-3.7&time=2023-07-16T12:00:00.000Z&limit=1"));
const searchBody = await searchResponse.json();
assert.equal(searchResponse.status, 200);
assert.equal(searchBody.items.length, 1);
assert.equal(searchBody.items[0].sceneId, SCENE_ID);
assert.equal(searchBody.items[0].date, "2023-07-16");
assert.equal(searchBody.collection, "modis-11A1-061");
assert.equal(searchResponse.headers.get("Cache-Control"), "public, s-maxage=21600, stale-while-revalidate=86400");
assert.equal(JSON.parse(searchCalls[0].init.body).limit, 5);
assert.equal(JSON.parse(searchCalls[0].init.body).datetime, "2023-07-16T00:00:00Z/2023-07-16T23:59:59Z");
assertNoSecrets(searchBody);

const nextDayCalls = installFetch(async () => jsonResponse({
  features: [
    {
      ...sceneFeature(),
      id: "MYD11A1.A2023198.h17v04.061.2023213084746",
      properties: { datetime: null, start_datetime: "2023-07-17T00:00:00Z" },
    },
    sceneFeature(),
  ],
}));
const sameDay = await searchRoute.GET(new NextRequest("http://localhost/api/listen/pc/search?lat=40.42&lon=-3.7&time=2023-07-16&limit=1"));
const sameDayBody = await sameDay.json();
assert.equal(sameDay.status, 200);
assert.equal(sameDayBody.items.length, 1);
assert.equal(sameDayBody.items[0].sceneId, SCENE_ID);
assert.equal(sameDayBody.items[0].date, "2023-07-16");
assert.equal(nextDayCalls.length, 1);

installFetch(async () => jsonResponse({ features: [] }));
const empty = await searchRoute.GET(new NextRequest("http://localhost/api/listen/pc/search?lat=40&lon=-3&time=2023-07-16"));
const emptyBody = await empty.json();
assert.equal(empty.status, 404);
assert.equal(emptyBody.value, null);
assert.deepEqual(emptyBody.items, undefined);

global.fetch = async () => {
  throw new Error("Live calls are not allowed in tests");
};

console.log("planetary computer tests passed");
