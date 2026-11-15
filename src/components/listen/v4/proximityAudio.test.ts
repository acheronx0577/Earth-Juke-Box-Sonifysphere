import assert from "node:assert/strict";
import { test } from "node:test";
import { proximityMix } from "./proximityAudio";

const center = { sourceId: "map", x: 0.5, y: 0.5 };

test("zoom brings centered sound forward and increases detail", () => {
  const wide = proximityMix({ ...center, zoom: 1 });
  const local = proximityMix({ ...center, zoom: 4 });
  assert.equal(wide.detail, 0);
  assert.equal(local.detail, 1);
  assert.ok(local.gain > wide.gain);
  assert.equal(local.pan, 0);
});

test("a closer view narrows the field and excludes offscreen points", () => {
  const wide = proximityMix({ ...center, zoom: 1, x: 0.98 });
  const local = proximityMix({ ...center, zoom: 4, x: 0.98 });
  assert.ok(local.gain < wide.gain);
  assert.equal(proximityMix({ ...center, zoom: 4, x: 1.2 }).gain, 0);
  assert.equal(proximityMix({ ...center, zoom: 4, y: -0.2 }).gain, 0);
});

test("stereo follows the visible container and is symmetric", () => {
  const left = proximityMix({ ...center, zoom: 2, x: 0.2 });
  const right = proximityMix({ ...center, zoom: 2, x: 0.8 });
  assert.ok(Math.abs(left.pan + right.pan) < 1e-12);
  assert.ok(Math.abs(left.gain - right.gain) < 1e-12);
});

test("missing focus resets to neutral and malformed input stays finite", () => {
  assert.deepEqual(proximityMix(null), { detail: 0, gain: 1, pan: 0 });
  const mix = proximityMix({ ...center, zoom: NaN, x: Infinity });
  assert.ok(Object.values(mix).every(Number.isFinite));
});
