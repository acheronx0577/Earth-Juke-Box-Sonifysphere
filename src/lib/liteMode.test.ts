import assert from "node:assert/strict";
import test from "node:test";
import { resolveLiteMode } from "./liteMode";

test("lite mode stays off unless a real constraint is present", () => {
  assert.equal(resolveLiteMode(null, {}), false);
  assert.equal(resolveLiteMode(null, { effectiveType: "4g", deviceMemory: 8, hardwareConcurrency: 8 }), false);
  assert.equal(resolveLiteMode(null, { deviceMemory: 4, hardwareConcurrency: 4 }), false);
});

test("lite mode turns on for the supported constraint signals", () => {
  assert.equal(resolveLiteMode(null, { saveData: true }), true);
  assert.equal(resolveLiteMode(null, { effectiveType: "slow-2g" }), true);
  assert.equal(resolveLiteMode(null, { effectiveType: "2g" }), true);
  assert.equal(resolveLiteMode(null, { effectiveType: "3g" }), true);
  assert.equal(resolveLiteMode(null, { deviceMemory: 2 }), true);
  assert.equal(resolveLiteMode(null, { hardwareConcurrency: 2 }), true);
});

test("a stored choice beats the automatic signals", () => {
  assert.equal(resolveLiteMode("off", { saveData: true, deviceMemory: 2, hardwareConcurrency: 2 }), false);
  assert.equal(resolveLiteMode("on", {}), true);
});
