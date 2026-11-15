import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeRequire = createRequire(import.meta.url);

nodeRequire.extensions[".ts"] = function (module, filename) {
  const source = readFileSync(filename, "utf8");
  const output = ts
    .transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: filename,
    })
    .outputText.replace(
      /require\("@\/([^"]+)"\)/g,
      (_, spec) => `require(${JSON.stringify(resolve(root, "src", `${spec}.ts`))})`,
    );
  module._compile(output, filename);
};

function loadTs(rel) {
  const filename = resolve(root, rel);
  return nodeRequire(filename);
}

const jobsMod = loadTs("src/lib/listen/satelliteJobs.ts");
const cacheMod = loadTs("src/lib/listen/satelliteCache.ts");
const { NextRequest } = nodeRequire("next/server");
const jobsRoute = loadTs("src/app/api/listen/pc/jobs/route.ts");

console.log("1. Testing query parsing and validation...");
assert.equal(jobsMod.parseJobQuery({ lat: 40.42, lon: -3.7, time: "2023-07-16" })?.day, "2023-07-16");
assert.equal(jobsMod.parseJobQuery({ lat: 91, lon: 0, time: "2023-07-16" }), null);
assert.equal(jobsMod.parseJobQuery({ lat: 40, lon: 181, time: "2023-07-16" }), null);
assert.equal(jobsMod.parseJobQuery({ lat: 40, lon: 0, time: "invalid-date" }), null);

console.log("2. Testing temperature-to-sound mapping...");
assert.equal(jobsMod.kelvinToCelsius(273.15), 0);
assert.equal(jobsMod.kelvinToCelsius(311.92), 38.77);
const soundAtFreezing = jobsMod.mapTempToSound(0);
assert.equal(soundAtFreezing.normalized, 0.5);
assert.ok(soundAtFreezing.baseFreqHz > 220 && soundAtFreezing.baseFreqHz < 880);

const soundAtHot = jobsMod.mapTempToSound(40);
assert.ok(soundAtHot.normalized > 0.8);
assert.ok(soundAtHot.baseFreqHz > soundAtFreezing.baseFreqHz);

console.log("3. Testing cache key formatting...");
const key = cacheMod.satelliteCacheKey({
  collection: "modis-11A1-061",
  day: "2023-07-16",
  lat: 40.416,
  lon: -3.704,
});
assert.equal(key, "modis-11A1-061|2023-07-16|40.42|-3.70");
assert.equal(cacheMod.satelliteBlobName(key), "modis-11A1-061_2023-07-16_40.42_-3.70.json");

console.log("4. Testing Azure Storage config parsing...");
const fakeConn = "DefaultEndpointsProtocol=https;AccountName=testacc;AccountKey=dGVzdGtleQ==;EndpointSuffix=core.windows.net";
const parsedConn = cacheMod.parseAzureStorageConfig({ AZURE_STORAGE_CONNECTION_STRING: fakeConn });
assert.equal(parsedConn?.accountName, "testacc");
assert.equal(parsedConn?.accountKey, "dGVzdGtleQ==");

const fakeSas = "https://testacc.blob.core.windows.net/satellite-cache?sp=r&sig=testSig";
const parsedSas = cacheMod.parseAzureStorageConfig({ AZURE_STORAGE_CONTAINER_SAS_URL: fakeSas });
assert.equal(parsedSas?.accountName, "testacc");
assert.equal(parsedSas?.sasUrl, fakeSas);

console.log("5. Testing SatelliteCache in-memory fallback...");
const testCache = new cacheMod.SatelliteCache(() => ({}));
await testCache.set("test-key", { temp: 25 });
const hit = await testCache.get("test-key");
assert.deepEqual(hit, { temp: 25 });

console.log("6. Testing API route validation...");
const invalidReq = new NextRequest("http://localhost/api/listen/pc/jobs", {
  method: "POST",
  body: JSON.stringify({ lat: 100, lon: 0 }),
});
const invalidRes = await jobsRoute.POST(invalidReq);
assert.equal(invalidRes.status, 400);

const missingIdReq = new NextRequest("http://localhost/api/listen/pc/jobs");
const missingIdRes = await jobsRoute.GET(missingIdReq);
assert.equal(missingIdRes.status, 400);

const notFoundReq = new NextRequest("http://localhost/api/listen/pc/jobs?id=job_nonexistent");
const notFoundRes = await jobsRoute.GET(notFoundReq);
assert.equal(notFoundRes.status, 404);

console.log("7. Testing job execution and caching lifecycle...");
const mockFetch = async (url) => {
  const urlStr = String(url);
  const sceneFeature = {
    id: "MOD11A1.A2023197.h17v04.061.2023213090725",
    properties: { datetime: "2023-07-16T00:00:00Z" },
    assets: {
      LST_Day_1km: {
        "raster:bands": [{ scale: 0.02, offset: 0, nodata: 0, unit: "Kelvin", spatial_resolution: 1000 }],
      },
    },
  };
  if (urlStr.includes("/search")) {
    return new Response(
      JSON.stringify({ features: [sceneFeature] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  if (urlStr.includes("/items/")) {
    return new Response(JSON.stringify(sceneFeature), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (urlStr.includes("/item/point")) {
    return new Response(JSON.stringify({ values: [15596] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response("Not found", { status: 404 });
};

const job = await jobsMod.enqueueSatelliteJob(
  { lat: 40.42, lon: -3.7, day: "2023-07-16" },
  mockFetch,
);
assert.ok(job.id.startsWith("job_"));
assert.ok(job.status === "queued" || job.status === "processing" || job.status === "completed");

// Await execution
await jobsMod.executeSatelliteJob(
  job,
  cacheMod.satelliteCacheKey({ collection: "modis-11A1-061", day: "2023-07-16", lat: 40.42, lon: -3.7 }),
  mockFetch,
);

assert.equal(job.status, "completed");
assert.equal(job.progress, 100);
assert.equal(job.result?.point.kelvin, 311.92);
assert.equal(job.result?.point.celsius, 38.77);
assert.equal(job.result?.sceneStats.sampleCount, 5);
assert.ok(job.result?.sonification.baseFreqHz > 0);

console.log("8. Testing cache hit on subsequent job request...");
const cachedJob = await jobsMod.enqueueSatelliteJob(
  { lat: 40.42, lon: -3.7, day: "2023-07-16" },
  mockFetch,
);
assert.equal(cachedJob.status, "completed");
assert.equal(cachedJob.result?.cached, true);
assert.equal(cachedJob.result?.point.kelvin, 311.92);

console.log("9. Testing secret safety gate (zero credentials in responses)...");
const serialized = JSON.stringify(job);
assert.equal(serialized.includes("sig="), false);
assert.equal(serialized.includes("AccountKey"), false);
assert.equal(serialized.includes("DefaultEndpointsProtocol"), false);
assert.equal(serialized.includes("SharedKey"), false);

console.log("All satellite job and Azure caching tests passed successfully!");
