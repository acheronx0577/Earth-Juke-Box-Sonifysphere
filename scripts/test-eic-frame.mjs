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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText.replace(/require\("@\/([^"]+)"\)/g, (_, spec) => `require(${JSON.stringify(resolve(root, "src", `${spec}.ts`))})`);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  mod._compile(output, filename);
  nodeRequire.cache[filename] = mod;
  return mod.exports;
}

const eic = loadTs("src/lib/listen/eicFrame.ts");
const source = loadTs("src/components/listen/v4/eicSource.ts");
const metaRoute = loadTs("src/app/api/listen/eic/route.ts");
const imageRoute = loadTs("src/app/api/listen/eic/image/route.ts");

const PRINT = "https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005101/sst_mur_print.jpg";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

function still(url, filename, width, height, alt) {
  return { url, filename, media_type: "Image", width, height, alt_text: alt };
}

function page() {
  return {
    title: "Sea Surface Temperature (SST) - Near Real Time",
    release_date: "2023-05-08T00:00:00-04:00",
    keywords: ["Earth Information Center"],
    secret: "SECRETTOKEN",
    main_image: still("https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005101/sst_mur_colorbar_print.jpg", "sst_mur_colorbar_print.jpg", 1024, 576, "colorbar"),
    media_groups: [{
      items: [
        { media: still("https://evil.test/vis/a/sst_mur_print.jpg", "sst_mur_print.jpg", 1024, 512, "off host") },
        { media: still("https://svs.gsfc.nasa.gov/steal/sst_mur_print.jpg", "sst_mur_print.jpg", 1024, 512, "wrong path") },
        { media: still("https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005101/sst_mur.exr", "sst_mur.exr", 4096, 2048, "exr") },
        { media: still(PRINT, "sst_mur_print.jpg", 4096, 2048, "too large") },
        { media: still(PRINT, "frames/sst_mur_print.jpg", 1024, 512, "An equirectangular view of sea surface temperature.") },
      ],
    }],
  };
}

function assertNoSecrets(payload) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  for (const secret of ["SECRET", "evil.test", "/vis/", "colorbar", "sig="]) {
    assert.equal(text.includes(secret), false, secret);
  }
}

assert.equal(eic.allowedFrameUrl("http://svs.gsfc.nasa.gov/vis/a/sst_mur_print.jpg"), null);
assert.equal(eic.allowedFrameUrl("https://user:pass@svs.gsfc.nasa.gov/vis/a/sst_mur_print.jpg"), null);
assert.equal(eic.allowedFrameUrl("https://evil.test/vis/a/sst_mur_print.jpg"), null);
assert.equal(eic.allowedFrameUrl(PRINT)?.hostname, "svs.gsfc.nasa.gov");

const selected = eic.selectPrintFrame(page());
assert.equal(selected.url, PRINT);
assert.equal(selected.width, 1024);
assert.equal(selected.date, "2023-05-08");
assert.equal(eic.selectPrintFrame({ title: "", release_date: "2023-05-08T00:00:00Z" }), null);

assert.equal(source.EIC_FRAME_SOURCE.kind, "image");
assert.equal(source.EIC_FRAME_SOURCE.layer, "all");
assert.equal(source.EIC_FRAME_SOURCE.meta.includes("image-derived"), true);
assert.equal(source.EIC_FRAME_SOURCE.preview.startsWith("data:image/svg+xml"), true);
assert.equal(source.EIC_FRAME_SOURCE.preview.includes("svs.gsfc.nasa.gov"), false);
assert.equal(source.EIC_FRAME_STATUS.includes("Image-derived"), true);

function installFetch(handler) {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (!String(url).startsWith("https://svs.gsfc.nasa.gov/")) throw new Error(`Live or off-host call ${url}`);
    return handler(String(url), init);
  };
  return calls;
}

const metaCalls = installFetch(async (url) => {
  assert.equal(url, eic.EIC_API);
  return new Response(JSON.stringify(page()), { status: 200, headers: { "content-type": "application/json" } });
});
const meta = await metaRoute.GET();
const metaBody = await meta.json();
assert.equal(meta.status, 200);
assert.equal(metaBody.quality, "image-derived");
assert.equal(metaBody.label, "image-derived");
assert.equal(metaBody.image, "/api/listen/eic/image");
assert.equal(metaBody.page, "https://svs.gsfc.nasa.gov/5101/");
assert.equal(metaBody.date, "2023-05-08");
assert.equal(metaBody.id, "5101");
assert.equal(meta.headers.get("Cache-Control"), "public, s-maxage=86400, stale-while-revalidate=604800");
assert.equal(metaCalls.length, 1);
assertNoSecrets(metaBody);

const imageCalls = installFetch(async (url) => {
  if (url === eic.EIC_API) return new Response(JSON.stringify(page()), { status: 200, headers: { "content-type": "application/json" } });
  assert.equal(url, PRINT);
  return new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
});
const image = await imageRoute.GET();
const bytes = Buffer.from(await image.arrayBuffer());
assert.equal(image.status, 200);
assert.equal(image.headers.get("content-type"), "image/png");
assert.equal(image.headers.get("x-content-type-options"), "nosniff");
assert.equal(image.headers.get("cache-control"), "public, s-maxage=86400, stale-while-revalidate=604800");
assert.equal(bytes.equals(PNG), true);
assert.deepEqual(imageCalls.map((call) => call.url), [eic.EIC_API, PRINT]);

installFetch(async (url) => {
  if (url === eic.EIC_API) return new Response(JSON.stringify(page()), { status: 200, headers: { "content-type": "application/json" } });
  return new Response(null, { status: 302, headers: { location: "https://evil.test/vis/a/sst_mur_print.jpg" } });
});
const redirected = await imageRoute.GET();
const redirectedBody = await redirected.json();
assert.equal(redirected.status, 502);
assert.equal(redirectedBody.error, "The data service could not be reached");
assertNoSecrets(redirectedBody);

installFetch(async () => new Response(JSON.stringify({ token: "SECRET", detail: "sig=ABC" }), { status: 500, headers: { "content-type": "application/json" } }));
const failed = await metaRoute.GET();
const failedBody = await failed.json();
assert.equal(failed.status, 502);
assertNoSecrets(failedBody);

installFetch(async () => {
  const error = new Error("timed out");
  error.name = "TimeoutError";
  throw error;
});
const timedOut = await metaRoute.GET();
assert.equal(timedOut.status, 504);

installFetch(async () => new Response(JSON.stringify({ title: "Missing still", release_date: "2023-05-08T00:00:00Z", media_groups: [] }), { status: 200, headers: { "content-type": "application/json" } }));
const missing = await metaRoute.GET();
assert.equal(missing.status, 404);
assert.equal((await missing.json()).error, "This Earth Information Center frame is not available.");

global.fetch = async () => {
  throw new Error("Live calls are not allowed in tests");
};

console.log("eic frame tests passed");
