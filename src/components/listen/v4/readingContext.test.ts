import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptReading, probeInstant, readingContextsMatch, type ReadingContext, type TaggedReading } from "./readingContext";

const map: ReadingContext = {
  source: "explore-nino",
  layer: "air",
  lat: 12.5,
  lon: -145,
  time: "2024-09-15T12:00:00.000Z",
};

function reading(context: ReadingContext): TaggedReading {
  return { context, value: "18.2 °C", detail: "Meteomatics · 2024" };
}

test("a reading is shown only when source, layer, lat, lon, and time all match", () => {
  assert.equal(readingContextsMatch(map, { ...map }), true);
  assert.deepEqual(acceptReading(map, reading(map))?.value, "18.2 °C");
});

test("a mismatch on any one field hides the reading", () => {
  const fields: Array<keyof ReadingContext> = ["source", "layer", "lat", "lon", "time"];
  const replacements = {
    source: "oco2-example",
    layer: "wind",
    lat: 12.6,
    lon: -144,
    time: "2023-09-15T12:00:00.000Z",
  } as const;
  for (const field of fields) {
    const next = { ...map, [field]: replacements[field] };
    assert.equal(readingContextsMatch(map, next), false, field);
    assert.equal(acceptReading(map, reading(next)), null, field);
  }
});

test("switching source clears a map reading from an image or upload", () => {
  const image: ReadingContext = { ...map, source: "PIA12345" };
  const upload: ReadingContext = { ...map, source: "upload-reef.jpg-1200" };
  assert.equal(acceptReading(image, reading(map)), null);
  assert.equal(acceptReading(upload, reading(map)), null);
});

test("the probe time is 15 September at 12:00 UTC for the selected year", () => {
  assert.equal(probeInstant(2024), "2024-09-15T12:00:00.000Z");
  assert.equal(probeInstant(2024.5), "");
});

test("an empty reading is null", () => {
  assert.equal(acceptReading(map, null), null);
  assert.equal(acceptReading(map, undefined), null);
  assert.equal(readingContextsMatch(map, null), false);
});
