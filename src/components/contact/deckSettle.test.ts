import assert from "node:assert/strict";
import test from "node:test";
import { deckIsSettled } from "./deckSettle";

const still = { intro: false, drag: false, spring: false, speed: 0, swing: 0, c: 2, t: 2 };

test("a resting contact deck does not need another WebGL draw", () => {
  assert.equal(deckIsSettled(still), true);
  assert.equal(deckIsSettled({ ...still, swing: 0.0007 }), true);
});

test("the deck keeps drawing while it is moving", () => {
  assert.equal(deckIsSettled({ ...still, intro: true }), false);
  assert.equal(deckIsSettled({ ...still, drag: true }), false);
  assert.equal(deckIsSettled({ ...still, spring: true }), false);
  assert.equal(deckIsSettled({ ...still, speed: 0.2 }), false);
  assert.equal(deckIsSettled({ ...still, c: 2.4, t: 3 }), false);
});
