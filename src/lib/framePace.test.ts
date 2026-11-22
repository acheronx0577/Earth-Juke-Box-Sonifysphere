import assert from "node:assert/strict";
import test from "node:test";
import { frameWait } from "./framePace";

test("a fresh frame draws immediately", () => {
  assert.equal(frameWait(1000, 0, 33), 0);
});

test("an early callback waits out the rest of the interval", () => {
  assert.equal(frameWait(1010, 1000, 50), 40);
});

test("a callback that is due does not insert a timer", () => {
  assert.equal(frameWait(1050, 1000, 50), 0);
  assert.equal(frameWait(1049.5, 1000, 50), 0);
});
