import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PUBLIC_ASSET_CACHE, publicAssetHeaders } from "./staticCache";

test("public files cache with long-term TTL for Lighthouse efficiency", () => {
  assert.match(PUBLIC_ASSET_CACHE, /max-age=31536000/);
  assert.match(PUBLIC_ASSET_CACHE, /stale-while-revalidate=86400/);
  assert.equal(PUBLIC_ASSET_CACHE.includes("immutable"), false);
  const sources = publicAssetHeaders().map((rule) => rule.source);
  assert.ok(sources.includes("/fonts/:path*"));
  assert.ok(sources.includes("/assets/:path*"));
  assert.ok(sources.includes("/team/:path*"));
  for (const rule of publicAssetHeaders()) {
    assert.equal(rule.headers[0]?.value, PUBLIC_ASSET_CACHE);
  }
});

test("the Next config applies those asset headers", () => {
  const config = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /publicAssetHeaders/);
});
