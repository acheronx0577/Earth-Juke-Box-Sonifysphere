import assert from "node:assert/strict";
import { test } from "node:test";
import { dataAtProbeLabel, seaIceExample } from "./exampleReading";

test("sea ice example copy has no hard-coded extent", () => {
  const copy = seaIceExample("15 Sep 2024 12:00 UTC");
  assert.equal(copy.value, "EXAMPLE");
  assert.match(copy.detail, /EXAMPLE DATA/);
  assert.match(copy.detail, /15 Sep 2024 12:00 UTC/);
  assert.equal(copy.value.includes("4.81"), false);
  assert.equal(copy.detail.includes("4.81"), false);
  assert.equal(copy.detail.includes("million"), false);
});

test("the hearing panel keeps EXAMPLE on example data and not on a real match", () => {
  assert.equal(dataAtProbeLabel("matched", true), "EXAMPLE DATA");
  assert.equal(dataAtProbeLabel("matched", false), "MATCHED");
  assert.equal(dataAtProbeLabel("image", false), "IMAGE-DERIVED");
  assert.equal(dataAtProbeLabel("loading", false), "LOADING");
  assert.equal(dataAtProbeLabel("empty", false), "NO DATA");
  assert.equal(dataAtProbeLabel("matched", false).includes("EXAMPLE"), false);
});
