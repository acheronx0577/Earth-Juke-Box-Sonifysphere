import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  clearElevationCache,
  elevationCacheKey,
  elevationPointUrl,
  parseOpenMeteoElevation,
  readElevationPoint,
} from "../../../lib/listen/elevation";

const TIME = "2026-09-15T12:00:00.000Z";
const OTHER = "2020-09-15T12:00:00.000Z";

afterEach(() => {
  clearElevationCache();
});

test("Open-Meteo elevation keeps sea level and below-sea terrain", () => {
  assert.equal(parseOpenMeteoElevation({ elevation: [59] }), 59);
  assert.equal(parseOpenMeteoElevation({ elevation: [0] }), 0);
  assert.equal(parseOpenMeteoElevation({ elevation: [-427] }), -427);
  assert.equal(parseOpenMeteoElevation({ elevation: 8724 }), 8724);
  assert.equal(parseOpenMeteoElevation({ elevation: [null] }), null);
  assert.equal(parseOpenMeteoElevation({ elevation: [Number.NaN] }), null);
  assert.equal(parseOpenMeteoElevation({ elevation: [] }), null);
  assert.equal(parseOpenMeteoElevation({}), null);
  assert.equal(parseOpenMeteoElevation(null), null);
});

test("the elevation request is keyless", () => {
  const url = new URL(elevationPointUrl(31.559, 35.47324));
  assert.equal(url.origin + url.pathname, "https://api.open-meteo.com/v1/elevation");
  assert.equal(url.searchParams.get("latitude"), "31.5590");
  assert.equal(url.searchParams.get("longitude"), "35.4732");
  assert.equal(url.searchParams.has("apikey"), false);
  assert.equal(elevationCacheKey(31.559, 35.47324), "elevation|31.5590|35.4732");
});

test("sea level is cached and a later year does not refetch", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    calls += 1;
    const url = new URL(String(input));
    assert.equal(url.hostname, "api.open-meteo.com");
    assert.equal(url.pathname, "/v1/elevation");
    const latitude = url.searchParams.get("latitude");
    if (latitude === "0.0000") return new Response(JSON.stringify({ elevation: [0] }), { status: 200 });
    if (latitude === "31.5590") return new Response(JSON.stringify({ elevation: [-427] }), { status: 200 });
    if (latitude === "8.0000") return new Response(JSON.stringify({ elevation: [null] }), { status: 200 });
    return new Response("down", { status: 503 });
  };
  try {
    const ocean = await readElevationPoint({ lat: 0, lon: -160, time: TIME });
    const oceanAgain = await readElevationPoint({ lat: 0.00004, lon: -160, time: OTHER });
    assert.equal(ocean.ok, true);
    assert.equal(oceanAgain.ok, true);
    if (!ocean.ok || !oceanAgain.ok) return;
    assert.equal(ocean.body.value, 0);
    assert.equal(ocean.body.unit, "m");
    assert.equal(ocean.body.source, "Open-Meteo");
    assert.equal(ocean.body.resolution, "dem");
    assert.equal(oceanAgain.body.time, OTHER);
    assert.match(ocean.cacheControl, /s-maxage=2592000/);
    assert.equal(calls, 1);

    const deadSea = await readElevationPoint({ lat: 31.559, lon: 35.4732, time: TIME });
    assert.equal(deadSea.ok, true);
    if (deadSea.ok) assert.equal(deadSea.body.value, -427);
    assert.equal(calls, 2);

    const missing = await readElevationPoint({ lat: 8, lon: 6, time: TIME });
    const missingAgain = await readElevationPoint({ lat: 8, lon: 6, time: TIME });
    assert.equal(missing.ok, false);
    assert.equal(missingAgain.ok, false);
    if (!missing.ok) assert.equal(missing.error, "No reading for this place and time.");
    assert.equal(calls, 4);

    const down = await readElevationPoint({ lat: 9, lon: 6, time: TIME });
    assert.equal(down.ok, false);
    if (!down.ok) assert.equal(down.status, 502);
  } finally {
    globalThis.fetch = original;
  }
});
