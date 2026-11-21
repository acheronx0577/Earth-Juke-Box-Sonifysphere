import assert from "node:assert/strict";
import test from "node:test";
import { heardPhraseFreqs, resultCurvePaths, type ResultClip } from "./guessResultCurve";

const clips: ResultClip[] = [
  { regionId: "arctic", layer: "temperature", season: "spring", weather: "clear" },
  { regionId: "nino34", layer: "co2", season: "summer", weather: "heat" },
  { regionId: "europe", layer: "methane", season: "fall", weather: "rain" },
  { regionId: "pacific", layer: "temperature", season: "summer", weather: "clear" },
  { regionId: "asia", layer: "sea-ice", season: "winter", weather: "storm" },
];

function startY(path: string): number {
  const match = /^M [\d.]+ ([\d.]+)/.exec(path);
  if (!match) throw new Error(path);
  return Number(match[1]);
}

test("each result card keeps its own heard series", () => {
  const paths = resultCurvePaths(clips);
  assert.equal(paths.length, 5);
  const heights = paths.map(startY);
  const spread = Math.max(...heights) - Math.min(...heights);
  assert.ok(spread > 12, `curves still overlap: ${heights.join(", ")}`);
  const freqs = clips.map(heardPhraseFreqs);
  assert.ok(freqs.every((series) => series.length === 4));
  assert.ok(freqs.slice(1).some((series) => series.join() !== freqs[0].join()));
});

test("a per-clip min/max scale collapses different pitches to one curve", () => {
  const alone = clips.map((clip) => startY(resultCurvePaths([clip])[0]));
  const drift = Math.max(...alone) - Math.min(...alone);
  assert.ok(drift < 0.05, `per-clip scale should flatten, drift ${drift}`);
  const shared = resultCurvePaths(clips).map(startY);
  assert.ok(Math.max(...shared) - Math.min(...shared) > 12);
});
