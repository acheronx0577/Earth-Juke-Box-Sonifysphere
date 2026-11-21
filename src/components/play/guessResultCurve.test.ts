import assert from "node:assert/strict";
import test from "node:test";
import type { LayerId } from "../../data/exploreMap";
import { MAP_REGIONS } from "../../data/exploreMap";
import { drawResultCurves, recordForClip, type ResultClip } from "./guessResultCurve";

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

test("layer records are the embedded listen and landing series", () => {
  assert.equal(recordForClip(clip("oceania", "temperature")).id, "gistemp-v4");
  assert.equal(recordForClip(clip("pacific", "temperature")).id, "listen-oni");
  assert.equal(recordForClip(clip("south-america", "sea-ice")).id, "nsidc-sea-ice");
  assert.equal(recordForClip(clip("europe", "methane")).id, "noaa-methane");
  assert.equal(recordForClip(clip("africa", "co2")).id, "mauna-loa-co2");
  assert.match(recordForClip(clip("oceania", "temperature")).source, /GISTEMP/);
  assert.match(recordForClip(clip("arctic", "sea-ice")).source, /NSIDC/);
});

test("the drawn paths are not copies of one slope", () => {
  const clips = [
    clip("oceania", "temperature"),
    clip("arctic", "sea-ice"),
    clip("europe", "methane"),
    clip("south-america", "co2"),
    clip("pacific", "temperature"),
  ];
  const shapes = clips.map((item) => resample(recordForClip(item).values, 160));
  const drawn = drawResultCurves(clips).map((curve) => curve.d);
  assert.equal(new Set(drawn).size, 5);
  for (let left = 0; left < shapes.length; left += 1) {
    for (let right = left + 1; right < shapes.length; right += 1) {
      const score = correlation(shapes[left], shapes[right]);
      const pair = `${clips[left].regionId}/${clips[left].layer} vs ${clips[right].regionId}/${clips[right].layer}`;
      const bothGases = ["co2", "methane"].includes(clips[left].layer) && ["co2", "methane"].includes(clips[right].layer);
      if (bothGases) {
        assert.ok(score < 0.995, `${pair} collapsed to one ramp (${score.toFixed(3)})`);
      } else {
        assert.ok(score < 0.9, `${pair} correlation ${score.toFixed(3)}`);
      }
    }
  }
  const ice = recordForClip(clip("arctic", "sea-ice")).values;
  assert.ok(ice[ice.length - 1] < ice[0], "sea ice extent is lower at the end of the record than at the start");
});

test("every map region resolves to one of the embedded records", () => {
  const layers: LayerId[] = ["temperature", "sea-ice", "co2", "methane"];
  for (const region of MAP_REGIONS) {
    for (const layer of layers) {
      const record = recordForClip(clip(region.id, layer));
      assert.ok(record.values.length >= 48, record.id);
    }
  }
});
