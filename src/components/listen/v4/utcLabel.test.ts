import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptReading, probeInstant, type ReadingContext } from "./readingContext";
import { formatUtcInstant, isNoDataResponse } from "./utcLabel";

test("the requested probe instant is labeled as an exact UTC time", () => {
  assert.equal(formatUtcInstant(probeInstant(2024)), "15 Sep 2024 12:00 UTC");
  assert.equal(formatUtcInstant("2026-09-15T12:00:00.000Z"), "15 Sep 2026 12:00 UTC");
  assert.equal(formatUtcInstant("1999-01-05T03:04:00.000Z"), "5 Jan 1999 03:04 UTC");
});

test("a date that does not exist is not labeled", () => {
  assert.equal(formatUtcInstant(""), null);
  assert.equal(formatUtcInstant("2024-09-15"), null);
  assert.equal(formatUtcInstant("2024-02-31T12:00:00.000Z"), null);
  assert.equal(formatUtcInstant("2024-09-15T12:00:00Z"), null);
});

test("only an empty provider reading is no data for this date", () => {
  assert.equal(isNoDataResponse(404, "No valid reading was returned."), true);
  assert.equal(isNoDataResponse(502, "No matched reading is available for this layer, place, and time."), true);
  assert.equal(isNoDataResponse(502, "Meteomatics credentials were rejected."), false);
  assert.equal(isNoDataResponse(502, "The measurement service could not be reached."), false);
  assert.equal(isNoDataResponse(503, "Meteomatics is not configured on this server."), false);
  assert.equal(isNoDataResponse(400, "Provide a valid location, UTC time, and layer."), false);
});

test("a no-data result is shown only for the same source, layer, place, and time", () => {
  const current: ReadingContext = {
    source: "explore-nino",
    layer: "wind",
    lat: 0,
    lon: -145,
    time: probeInstant(2024),
  };
  const noData = {
    context: current,
    status: "no-data" as const,
    value: "No data for this date",
    detail: formatUtcInstant(current.time) ?? "",
  };
  assert.equal(acceptReading(current, noData)?.value, "No data for this date");
  assert.equal(acceptReading({ ...current, source: "PIA12345" }, noData), null);
  assert.equal(acceptReading({ ...current, time: probeInstant(2023) }, noData), null);
});
