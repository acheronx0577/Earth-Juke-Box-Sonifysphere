import assert from "node:assert/strict";
import test from "node:test";
import {
  PATTERNS,
  clampRoundScore,
  encodeRibbonsResult,
  lineDirection,
  parseRibbonsResult,
  saidParts,
  scoreForTry,
} from "./ribbonsResult";

test("line direction follows the curve, not the turn index", () => {
  const co2 = PATTERNS[0].points;
  const ice = PATTERNS[1].points;
  assert.equal(lineDirection(co2, 1), "RISING");
  assert.equal(lineDirection(co2, 3), "LEVEL");
  assert.equal(lineDirection(ice, 1), "FALLING");
  assert.equal(lineDirection(ice, 3), "LEVEL");
  assert.equal(lineDirection(PATTERNS[2].points, 3), "LEVEL");
});

test("points are 100, 60, 30, then nothing", () => {
  assert.equal(scoreForTry(1), 100);
  assert.equal(scoreForTry(2), 60);
  assert.equal(scoreForTry(3), 30);
  assert.equal(scoreForTry(4), 0);
});

test("shared results recompute the total and reject a forged v1 score", () => {
  assert.equal(parseRibbonsResult("v1.1.900"), null);
  assert.equal(parseRibbonsResult("v1.3.300"), null);
  assert.equal(parseRibbonsResult("v1.0.0"), null);
  assert.equal(parseRibbonsResult("v2.1A.1A.1U"), null);

  const mixed = parseRibbonsResult("v2.1S.2UA.1U");
  assert.ok(mixed);
  assert.equal(mixed.totalScore, 260);
  assert.equal(mixed.patternsSolved, 3);
  assert.equal(mixed.firstTries, 2);
  assert.deepEqual(saidParts(mixed.rounds[1], PATTERNS[1]).misses, ["Summer"]);
  assert.equal(saidParts(mixed.rounds[1], PATTERNS[1]).turn, "Autumn · Sep");

  const clamped = parseRibbonsResult("v2.100.60.900");
  assert.ok(clamped);
  assert.deepEqual(
    clamped.rounds.map((round) => round.score),
    [100, 60, 100],
  );
  assert.equal(clamped.totalScore, 260);
  assert.equal(encodeRibbonsResult(clamped), "v2.100.60.100");
  assert.equal(clampRoundScore(15), 0);
  assert.equal(clampRoundScore(45), 30);
  assert.equal(clampRoundScore(900), 100);
});

test("encoded rounds round-trip and a reveal or skip scores zero", () => {
  const encoded = encodeRibbonsResult({
    rounds: [
      { guesses: ["Spring"], outcome: "solved", score: 100 },
      { guesses: ["Spring", "Summer", "Winter"], outcome: "reveal", score: 0 },
      { guesses: ["Winter"], outcome: "skip", score: 0 },
    ],
  });
  assert.equal(encoded, "v2.1S.rSUW.sW");
  const parsed = parseRibbonsResult(encoded);
  assert.ok(parsed);
  assert.equal(parsed.totalScore, 100);
  assert.equal(parsed.patternsSolved, 1);
  assert.equal(parsed.firstTries, 1);
  assert.equal(parsed.rounds[1].outcome, "reveal");
  assert.equal(parsed.rounds[2].outcome, "skip");
});
