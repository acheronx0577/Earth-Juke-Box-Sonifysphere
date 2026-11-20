import assert from "node:assert/strict";
import { test } from "node:test";
import { frequencyForValue } from "./audioMapping";
import { LAYER_SOUND_RANGES, mapLayerToSound, precipitationAnnualMm, precipitationDetail, precipitationValueLabel, readingNumber } from "./layerRange";

test("air temperature uses -50 °C to 50 °C", () => {
  assert.equal(mapLayerToSound("air", -50), 0);
  assert.equal(mapLayerToSound("air", 0), 0.5);
  assert.equal(mapLayerToSound("air", 50), 1);
  assert.equal(mapLayerToSound("air", -80), 0);
  assert.equal(mapLayerToSound("air", 80), 1);
  assert.equal(LAYER_SOUND_RANGES.air.unit, "°C");
});

test("current speed uses 0 m/s to 3 m/s and wind uses 0 m/s to 40 m/s", () => {
  assert.equal(mapLayerToSound("currents", 0), 0);
  assert.equal(mapLayerToSound("currents", 1.5), 0.5);
  assert.equal(mapLayerToSound("currents", 3), 1);
  assert.equal(mapLayerToSound("currents", 9), 1);
  assert.equal(mapLayerToSound("wind", 0), 0);
  assert.equal(mapLayerToSound("wind", 20), 0.5);
  assert.equal(mapLayerToSound("wind", 40), 1);
  assert.equal(LAYER_SOUND_RANGES.currents.unit, "m/s");
  assert.equal(LAYER_SOUND_RANGES.wind.unit, "m/s");
});

test("a different reading produces a different sound value", () => {
  const cooler = mapLayerToSound("air", 10);
  const warmer = mapLayerToSound("air", 25);
  assert.ok(cooler !== null && warmer !== null);
  assert.ok(warmer > cooler);
  assert.notEqual(mapLayerToSound("wind", 4), mapLayerToSound("wind", 16));
  assert.notEqual(mapLayerToSound("currents", 0.2), mapLayerToSound("currents", 1.4));
});

test("empty, blank, NaN, and non-numeric readings are null rather than zero", () => {
  assert.equal(readingNumber(""), null);
  assert.equal(readingNumber("   "), null);
  assert.equal(readingNumber("NaN"), null);
  assert.equal(readingNumber("no data"), null);
  assert.equal(readingNumber(null), null);
  assert.equal(readingNumber(undefined), null);
  assert.equal(readingNumber(Number.NaN), null);
  assert.equal(readingNumber([]), null);
  assert.equal(mapLayerToSound("air", null), null);
  assert.equal(mapLayerToSound("wind", readingNumber("")), null);
  assert.equal(mapLayerToSound("currents", readingNumber(" ")), null);
  assert.notEqual(mapLayerToSound("wind", readingNumber("")), 0);
});

test("average precipitation uses 0 mm/day to 12 mm/day", () => {
  assert.equal(LAYER_SOUND_RANGES.precip.min, 0);
  assert.equal(LAYER_SOUND_RANGES.precip.max, 12);
  assert.equal(LAYER_SOUND_RANGES.precip.unit, "mm/day");
  assert.equal(mapLayerToSound("precip", 0), 0);
  assert.equal(mapLayerToSound("precip", 6), 0.5);
  assert.equal(mapLayerToSound("precip", 12), 1);
  assert.equal(mapLayerToSound("precip", 17.24), 1);
  assert.equal(mapLayerToSound("precip", -1), 0);
  assert.equal(mapLayerToSound("precip", null), null);
  // POWER PRECTOTCORR ANN samples: Sahara 0, Seattle 3.37, Amazon 6.5 mm/day.
  assert.equal(mapLayerToSound("precip", readingNumber("0.00 mm/day")), 0);
  assert.equal(mapLayerToSound("precip", 3.37), 3.37 / 12);
  assert.equal(mapLayerToSound("precip", 6.5), 6.5 / 12);
  const sahara = mapLayerToSound("precip", 0);
  const seattle = mapLayerToSound("precip", 3.37);
  const amazon = mapLayerToSound("precip", 6.5);
  assert.ok(sahara !== null && seattle !== null && amazon !== null);
  assert.ok(sahara < seattle && seattle < amazon);
  assert.notEqual(frequencyForValue(seattle, "soft", "continuous"), frequencyForValue(amazon, "soft", "continuous"));
  assert.equal(frequencyForValue(sahara, "soft", "continuous"), 196);
  assert.equal(precipitationAnnualMm(3.37), Math.round(3.37 * 365));
  assert.equal(precipitationAnnualMm(0), 0);
  assert.equal(precipitationValueLabel(3.37), "3.37 mm/day");
  assert.equal(precipitationDetail(3.37), `${Math.round(3.37 * 365)} mm/yr · NASA POWER climatology`);
  assert.equal(readingNumber(precipitationValueLabel(6.5)), 6.5);
});

test("a real zero stays zero and a displayed unit is ignored", () => {
  assert.equal(readingNumber("0.0 m/s"), 0);
  assert.equal(mapLayerToSound("wind", readingNumber("0.0 m/s")), 0);
  assert.equal(readingNumber("18.2 °C"), 18.2);
  assert.equal(mapLayerToSound("air", readingNumber("18.2 °C")), (18.2 - -50) / 100);
});
