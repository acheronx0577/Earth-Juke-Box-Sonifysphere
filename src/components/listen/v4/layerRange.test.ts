import assert from "node:assert/strict";
import { test } from "node:test";
import { frequencyForValue } from "./audioMapping";
import { LAYER_SOUND_RANGES, elevationValueLabel, mapLayerToSound, precipitationAnnualMm, precipitationDetail, precipitationValueLabel, readingNumber } from "./layerRange";

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

test("elevation uses a square-root curve from -430 m to 8849 m", () => {
  const span = 8849 - -430;
  assert.equal(LAYER_SOUND_RANGES.elevation.min, -430);
  assert.equal(LAYER_SOUND_RANGES.elevation.max, 8849);
  assert.equal(LAYER_SOUND_RANGES.elevation.unit, "m");
  assert.equal(LAYER_SOUND_RANGES.elevation.curve, "sqrt");
  assert.equal(mapLayerToSound("elevation", -430), 0);
  assert.equal(mapLayerToSound("elevation", -500), 0);
  assert.equal(mapLayerToSound("elevation", 8849), 1);
  assert.equal(mapLayerToSound("elevation", 9000), 1);
  assert.equal(mapLayerToSound("elevation", null), null);
  const sea = mapLayerToSound("elevation", 0);
  const seattle = mapLayerToSound("elevation", 59);
  const sahara = mapLayerToSound("elevation", 962);
  const everest = mapLayerToSound("elevation", 8724);
  const deadSea = mapLayerToSound("elevation", -427);
  assert.ok(sea !== null && seattle !== null && sahara !== null && everest !== null && deadSea !== null);
  assert.equal(sea, Math.sqrt(430 / span));
  assert.ok(sea > 0);
  assert.ok(deadSea > 0 && deadSea < sea);
  assert.ok(seattle > sea);
  assert.ok(sahara > seattle);
  assert.ok(everest > 0.99 && everest < 1);
  const linearGap = (500 - 0) / span;
  const curvedGap = (mapLayerToSound("elevation", 500) ?? 0) - sea;
  assert.ok(curvedGap > linearGap);
  assert.notEqual(frequencyForValue(sea, "soft", "continuous"), frequencyForValue(sahara, "soft", "continuous"));
  assert.equal(readingNumber(elevationValueLabel(0)), 0);
  assert.equal(readingNumber(elevationValueLabel(-427)), -427);
  assert.equal(elevationValueLabel(59.4), "59 m");
  assert.notEqual(mapLayerToSound("elevation", readingNumber("0 m")), null);
  assert.notEqual(mapLayerToSound("elevation", readingNumber("0 m")), 0);
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
