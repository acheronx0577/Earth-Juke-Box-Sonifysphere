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

const elevation = loadTs("src/lib/listen/elevation.ts");
const { NextRequest } = nodeRequire("next/server");
const measurements = loadTs("src/app/api/listen/measurements/route.ts");
const PAST = "2020-01-15T12:00:00.000Z";

function request(lat, lon, layer) {
  const url = `http://localhost/api/listen/measurements?lat=${lat}&lon=${lon}&time=${encodeURIComponent(PAST)}&layer=${layer}`;
  return new NextRequest(url);
}

elevation.clearElevationCache();
delete process.env.METEOMATICS_USERNAME;
delete process.env.METEOMATICS_PASSWORD;
const original = global.fetch;
const calls = [];
global.fetch = async (input) => {
  const url = new URL(String(input));
  calls.push(url.hostname);
  if (url.hostname === "api.meteomatics.com") {
    return new Response(JSON.stringify({
      data: [{ coordinates: [{ dates: [{ value: 4.5, date: "2020-01-15T12:00:00Z" }] }] }],
    }), { status: 200 });
  }
  assert.equal(url.hostname, "api.open-meteo.com");
  assert.equal(url.pathname, "/v1/elevation");
  const latitude = url.searchParams.get("latitude");
  if (latitude === "0.0000") return new Response(JSON.stringify({ elevation: [0] }), { status: 200 });
  if (latitude === "31.5590") return new Response(JSON.stringify({ elevation: [-427] }), { status: 200 });
  return new Response(JSON.stringify({ elevation: [null] }), { status: 200 });
};

try {
  const ocean = await measurements.GET(request(0, -160, "elevation"));
  const oceanBody = await ocean.json();
  assert.equal(ocean.status, 200);
  assert.equal(oceanBody.value, 0);
  assert.equal(oceanBody.unit, "m");
  assert.equal(oceanBody.source, "Open-Meteo");
  assert.equal(oceanBody.resolution, "dem");
  assert.equal(oceanBody.layer, "elevation");
  assert.match(ocean.headers.get("cache-control") ?? "", /s-maxage=2592000/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], "api.open-meteo.com");

  const again = await measurements.GET(request(0.00004, -160, "elevation"));
  assert.equal((await again.json()).value, 0);
  assert.equal(calls.length, 1);

  process.env.METEOMATICS_USERNAME = "test-user";
  process.env.METEOMATICS_PASSWORD = "test-password";
  const shore = await measurements.GET(request(31.559, 35.4732, "elevation"));
  const shoreBody = await shore.json();
  assert.equal(shore.status, 200);
  assert.equal(shoreBody.value, -427);
  assert.equal(calls.at(-1), "api.open-meteo.com");
  assert.equal(JSON.stringify(shoreBody).includes("test-password"), false);

  const wind = await measurements.GET(request(5.25, 6.25, "wind"));
  assert.equal(wind.status, 200);
  assert.equal((await wind.json()).source, "Meteomatics");
  assert.equal(calls.at(-1), "api.meteomatics.com");

  const missing = await measurements.GET(request(8, 6, "elevation"));
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, "No reading for this place and time.");
} finally {
  global.fetch = original;
  delete process.env.METEOMATICS_USERNAME;
  delete process.env.METEOMATICS_PASSWORD;
  elevation.clearElevationCache();
}

console.log("Elevation route: ocean, below sea level, cache, and Meteomatics bypass passed");
