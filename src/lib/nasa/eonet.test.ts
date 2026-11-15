import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/listen/events/route";
import { pulsesForEvents } from "@/lib/nasa/eventPulse";
import { loadEonetEvents, parseEonetQuery, resetEonetCacheForTests, setEonetClockForTests, type EonetEvent } from "@/lib/nasa/eonet";

const previousFetch = global.fetch;

afterEach(() => {
  global.fetch = previousFetch;
  resetEonetCacheForTests();
});

const OPEN_FIRE = {
  id: "EONET_1",
  title: "Example fire",
  link: "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1",
  closed: null,
  categories: [{ id: "wildfires", title: "Wildfires" }],
  geometry: [
    { date: "2026-11-14T00:00:00Z", type: "Point", coordinates: [-120.5, 36.2], magnitudeValue: null, magnitudeUnit: null },
  ],
};

test("returns open events in the view and keeps a missing magnitude null", async () => {
  const calls: string[] = [];
  mock(calls, { events: [OPEN_FIRE, stormOutside()] });
  const response = await GET(new NextRequest("http://localhost/api/listen/events?bbox=-130,24,-66,50&status=open"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.events.length, 1);
  assert.equal(body.events[0].category, "wildfires");
  assert.equal(body.events[0].lat, 36.2);
  assert.equal(body.events[0].lon, -120.5);
  assert.equal(body.events[0].magnitude, null);
  assert.equal(body.events[0].open, true);
  assert.equal(body.quality, "measured");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.includes("api_key"), false);
});

test("uses the saved copy for fifteen minutes", async () => {
  let now = Date.parse("2026-11-15T12:00:00.000Z");
  setEonetClockForTests(() => now);
  const calls: string[] = [];
  mock(calls, { events: [OPEN_FIRE] });
  const query = parseEonetQuery(new URLSearchParams("bbox=-130,24,-66,50"));
  const first = await loadEonetEvents(query);
  now += 10 * 60 * 1000;
  const second = await loadEonetEvents(query);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(calls.length, 1);
  now += 10 * 60 * 1000;
  await loadEonetEvents(query);
  assert.equal(calls.length, 2);
});

test("rejects a view that crosses the date line before calling EONET", async () => {
  let called = false;
  global.fetch = (async () => {
    called = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/listen/events?bbox=170,-10,-170,10"));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.match(body.error, /date line/);
  assert.equal(called, false);
});

test("category chooses the instrument and magnitude chooses loudness", () => {
  const open = pulsesForEvents([event({ category: "wildfires", magnitude: null, open: true })])[0];
  const loud = pulsesForEvents([event({ category: "severeStorms", magnitude: 140, unit: "kts", open: true })])[0];
  const closed = pulsesForEvents([event({ category: "severeStorms", magnitude: 140, unit: "kts", open: false })])[0];
  assert.equal(open?.instrument, "noise");
  assert.equal(open?.gain, 0.45);
  assert.equal(open?.duration, 0.12);
  assert.equal(loud?.instrument, "membrane");
  assert.equal(loud?.gain, 1);
  assert.ok(closed && loud && closed.gain < loud.gain);
  assert.equal(closed?.duration, 0.45);
});

test("a polygon uses its center and a timeout does not return the upstream body", async () => {
  const calls: string[] = [];
  mock(calls, {
    events: [{
      id: "EONET_2",
      title: "Example storm",
      link: "http://insecure.example/secret",
      closed: "2026-11-10T00:00:00Z",
      categories: [{ id: "severeStorms", title: "Severe Storms" }],
      geometry: [{
        date: "2026-11-09T00:00:00Z",
        type: "Polygon",
        coordinates: [[[-100, 30], [-90, 30], [-90, 40], [-100, 40], [-100, 30]]],
        magnitudeValue: 70,
        magnitudeUnit: "kts",
      }],
    }],
  });
  const response = await GET(new NextRequest("http://localhost/api/listen/events?bbox=-130,24,-66,50&status=all"));
  const body = await response.json();
  assert.equal(body.events[0].lat, 35);
  assert.equal(body.events[0].lon, -95);
  assert.equal(body.events[0].open, false);
  assert.equal(body.events[0].magnitude, 70);
  assert.equal(body.events[0].link, "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_2");

  resetEonetCacheForTests();
  global.fetch = (async () => {
    throw Object.assign(new Error("upstream body api_key=nope"), { name: "TimeoutError" });
  }) as typeof fetch;
  const failed = await GET(new NextRequest("http://localhost/api/listen/events?bbox=-130,24,-66,50&status=all"));
  const text = await failed.text();
  assert.equal(failed.status, 504);
  assert.equal(text.includes("api_key"), false);
  assert.equal(text.includes("upstream body"), false);
});

function mock(calls: string[], body: unknown) {
  global.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

function stormOutside() {
  return {
    ...OPEN_FIRE,
    id: "EONET_OUT",
    title: "Outside the view",
    geometry: [{ date: "2026-11-14T00:00:00Z", type: "Point", coordinates: [10, 10] }],
  };
}

function event(options: { category: string; magnitude: number | null; unit?: string; open: boolean }): EonetEvent {
  return {
    id: "EONET_P",
    title: "Pulse",
    category: options.category,
    categoryTitle: options.category,
    open: options.open,
    magnitude: options.magnitude,
    magnitudeUnit: options.unit ?? null,
    time: "2026-11-14T00:00:00.000Z",
    lat: 0,
    lon: 0,
    link: "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_P",
  };
}
