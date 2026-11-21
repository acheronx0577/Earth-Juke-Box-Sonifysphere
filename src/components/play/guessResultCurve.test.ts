import assert from "node:assert/strict";
import test from "node:test";
import type { LayerId } from "../../data/exploreMap";
import { MAP_REGIONS } from "../../data/exploreMap";
import { drawResultCurves, recordForClip, seriesReadout, type ResultClip } from "./guessResultCurve";

function clip(regionId: string, layer: LayerId): ResultClip {
  return { regionId, layer, season: "summer", weather: "clear" };
}

function resample(values: readonly number[], count: number): number[] {
  const out: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = (index * (values.length - 1)) / (count - 1);
    const left = Math.floor(t);
    const right = Math.min(values.length - 1, left + 1);
    const mix = t - left;
    out.push((values[left] ?? 0) * (1 - mix) + (values[right] ?? 0) * mix);
  }
  return out;
}

function correlation(left: readonly number[], right: readonly number[]): number {
  const norm = (values: readonly number[]) => {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) || 1;
    return values.map((value) => (value - mean) / deviation);
  };
  const x = norm(left);
  const y = norm(right);
  return x.reduce((sum, value, index) => sum + value * (y[index] ?? 0), 0) / x.length;
}

test("each region and record uses its own measurement series", () => {
  assert.equal(recordForClip(clip("oceania", "temperature")).id, "ncei-oceania");
  assert.equal(recordForClip(clip("south-america", "temperature")).id, "ncei-south-america");
  assert.equal(recordForClip(clip("pacific", "temperature")).id, "ersst-pacific-nino4");
  assert.equal(recordForClip(clip("nino34", "temperature")).id, "ersst-nino34");
  assert.equal(recordForClip(clip("atlantic", "temperature")).id, "ersst-atlantic");
  assert.equal(recordForClip(clip("indian", "temperature")).id, "ersst-indian-dmi");
  assert.equal(recordForClip(clip("arctic", "sea-ice")).id, "nsidc-sea-ice");
  assert.equal(recordForClip(clip("europe", "methane")).id, "noaa-methane");
  assert.equal(recordForClip(clip("africa", "co2")).id, "mauna-loa-co2");
  const ids = MAP_REGIONS.map((region) => recordForClip(clip(region.id, "temperature")).id);
  assert.equal(new Set(ids).size, MAP_REGIONS.length);
  const oceania = recordForClip(clip("oceania", "temperature"));
  assert.equal(oceania.years[0], 1910);
  assert.equal(oceania.values[0], -0.22);
  assert.equal(oceania.values[oceania.values.length - 1], 1.16);
  const ice = recordForClip(clip("arctic", "sea-ice"));
  assert.ok(ice.values[ice.values.length - 1] < ice.values[0]);
  const co2 = recordForClip(clip("africa", "co2"));
  assert.ok(co2.values[co2.values.length - 1] > co2.values[0]);
});

test("the five result curves are different shapes", () => {
  const clips = [
    clip("oceania", "temperature"),
    clip("arctic", "sea-ice"),
    clip("europe", "methane"),
    clip("south-america", "co2"),
    clip("pacific", "temperature"),
  ];
  const shapes = clips.map((item) => resample(recordForClip(item).values, 80));
  const drawn = drawResultCurves(clips);
  assert.equal(new Set(drawn.map((curve) => curve.d)).size, 5);
  for (let left = 0; left < shapes.length; left += 1) {
    for (let right = left + 1; right < shapes.length; right += 1) {
      const score = Math.abs(correlation(shapes[left], shapes[right]));
      assert.ok(score < 0.995, `${clips[left].regionId} vs ${clips[right].regionId} ${score.toFixed(3)}`);
    }
  }
  const readout = seriesReadout(clips[0]);
  assert.match(readout.caption, /Oceania land temperature/);
  assert.equal(readout.start.year, 1910);
  assert.equal(readout.end.year, 2025);
});
