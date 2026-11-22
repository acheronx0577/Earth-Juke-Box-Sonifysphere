import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./listenAssets.ts", import.meta.url), "utf8");

test("homepage warmup does not import the globe renderer", () => {
  const start = source.indexOf("export function warmListenAssets");
  const end = source.indexOf("export function", start + 10);
  const body = source.slice(start, end === -1 ? source.length : end);
  assert.equal(body.includes("loadGlobeRenderer"), false);
  assert.equal(body.includes("warmImages"), true);
});

test("classic listen can still load maplibre on demand", () => {
  assert.match(source, /export function loadGlobeRenderer/);
  assert.match(source, /import\("maplibre-gl"\)/);
});
