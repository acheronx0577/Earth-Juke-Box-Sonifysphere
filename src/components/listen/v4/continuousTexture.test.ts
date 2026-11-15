import assert from "node:assert/strict";
import { test } from "node:test";
import { continuousTexture } from "./continuousTexture";

const input = { frequency: 330, detail: 0, ambience: false, tempo: 1, layerCutoff: 1500, variation: "soft" as const };

test("zoom reveals harmonics and reduces distance without changing the data root", () => {
  const wide = continuousTexture(input);
  const local = continuousTexture({ ...input, detail: 1 });
  assert.deepEqual(local.frequencies, wide.frequencies);
  assert.equal(local.frequencies[0], 330);
  assert.ok(local.cutoff > wide.cutoff * 5);
  assert.ok(local.levels[2] - wide.levels[2] > 20);
  assert.ok(local.reverb < wide.reverb / 4);
});

test("motion changes the slow texture speed while ambience adds a deeper bed", () => {
  const plain = continuousTexture(input);
  const moving = continuousTexture({ ...input, tempo: 2, ambience: true });
  assert.equal(moving.motionHz, plain.motionHz * 2);
  assert.deepEqual(moving.frequencies, plain.frequencies);
  assert.ok(moving.levels[1] > plain.levels[1]);
});
