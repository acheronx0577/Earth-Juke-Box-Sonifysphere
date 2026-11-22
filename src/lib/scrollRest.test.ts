import assert from "node:assert/strict";
import test from "node:test";
import { scrollIsResting } from "./scrollRest";

test("a still page can release the scroll ticker", () => {
  assert.equal(scrollIsResting(0, false), true);
  assert.equal(scrollIsResting(0.04, false), true);
});

test("an active scroll keeps the ticker", () => {
  assert.equal(scrollIsResting(1.2, "smooth"), false);
  assert.equal(scrollIsResting(0, "native"), false);
  assert.equal(scrollIsResting(0.2, false), false);
});
