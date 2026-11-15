import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
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

const svs = loadTs("src/lib/listen/svsMedia.ts");
const imageRoute = loadTs("src/app/api/listen/svs/image/route.ts");
const videoRoute = loadTs("src/app/api/listen/svs/video/route.ts");

assert.equal(svs.isAllowedSvsId("5196"), true);
assert.equal(svs.isAllowedSvsId("3912"), true);
assert.equal(svs.isAllowedSvsId("5011"), true);
assert.equal(svs.isAllowedSvsId("5101"), true);
assert.equal(svs.isAllowedSvsId("9999"), false);

assert.equal(svs.allowedSvsUrl("http://svs.gsfc.nasa.gov/vis/a/image.jpg")?.toString(), "https://svs.gsfc.nasa.gov/vis/a/image.jpg");
assert.equal(svs.allowedSvsUrl("https://evil.com/vis/a/image.jpg"), null);
assert.equal(svs.allowedSvsUrl("https://user:pass@svs.gsfc.nasa.gov/vis/a/image.jpg"), null);

function mockRequest(url, headers = {}) {
  return {
    url,
    headers: new Map(Object.entries(headers)),
  };
}

const invalidReq = mockRequest("http://localhost:3000/api/listen/svs/image?id=invalid");
const invalidRes = await imageRoute.GET(invalidReq);
assert.equal(invalidRes.status, 400);

const origFetch = global.fetch;
global.fetch = async (url) => {
  if (url.includes(".jpg")) {
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } });
  }
  if (url.includes(".mp4")) {
    return new Response(new Uint8Array([4, 5, 6]), { status: 206, headers: { "content-type": "video/mp4", "content-range": "bytes 0-2/3" } });
  }
  return new Response("Not found", { status: 404 });
};

try {
  const imgReq = mockRequest("http://localhost:3000/api/listen/svs/image?id=5196");
  const imgRes = await imageRoute.GET(imgReq);
  assert.equal(imgRes.status, 200);
  assert.equal(imgRes.headers.get("content-type"), "image/jpeg");

  const vidReq = mockRequest("http://localhost:3000/api/listen/svs/video?id=3912", { range: "bytes=0-100" });
  const vidRes = await videoRoute.GET(vidReq);
  assert.equal(vidRes.status, 206);
  assert.equal(vidRes.headers.get("content-type"), "video/mp4");
  assert.equal(vidRes.headers.get("content-range"), "bytes 0-2/3");
} finally {
  global.fetch = origFetch;
}

console.log("SVS media proxy tests passed");
