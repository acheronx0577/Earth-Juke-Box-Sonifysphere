import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const probe = readFileSync(new URL("../components/listen/v4/probeAudio.ts", import.meta.url), "utf8");
const nav = readFileSync(new URL("../components/shared/SiteNav.tsx", import.meta.url), "utf8");
const transitions = readFileSync(new URL("../components/shared/PageTransitions.tsx", import.meta.url), "utf8");
const preloader = readFileSync(new URL("../components/landing/Preloader.tsx", import.meta.url), "utf8");

test("listen probe audio loads Tone on demand", () => {
  assert.equal(probe.includes('import * as Tone from "tone"'), false);
  assert.match(probe, /loadTone\(/);
});

test("nav links do not prefetch their route bundles while idle", () => {
  assert.match(nav, /prefetch=\{false\}/);
  assert.equal(nav.includes("prefetch={pathname"), false);
});

test("the first touch warms the destination before the click", () => {
  assert.match(transitions, /addEventListener\("touchstart", onIntent/);
});

test("the homepage idle callback does not prefetch Listen", () => {
  const start = preloader.indexOf("const prepare = ()");
  const end = preloader.indexOf("requestIdleCallback", start);
  const body = preloader.slice(start, end);
  assert.equal(body.includes("router.prefetch"), false);
  assert.match(body, /warmListenAssets/);
});
