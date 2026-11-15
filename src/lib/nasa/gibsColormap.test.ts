import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { PNG } from "pngjs";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/listen/gibs-colormap/route";
import { GET as getTile } from "@/app/api/listen/gibs-colormap/tile/route";
import { parseGibsColorMap, resetGibsCacheForTests, valueForRgb } from "@/lib/nasa/gibsColormap";

const XML = `<?xml version="1.0"?>
<ColorMaps>
  <ColorMap title="No Data">
    <Entries><ColorMapEntry rgb="255,0,255" transparent="true" nodata="true" ref="0"/></Entries>
  </ColorMap>
  <ColorMap title="Air Temperature" units="K">
    <Entries>
      <ColorMapEntry rgb="50,136,189" transparent="false" value="[220,221)" ref="1"/>
      <ColorMapEntry rgb="158,1,66" transparent="false" value="[310,+INF)" ref="2"/>
    </Entries>
  </ColorMap>
</ColorMaps>`;

afterEach(() => {
  resetGibsCacheForTests();
});

test("an exact pixel colour becomes a value with a unit", () => {
  const map = parseGibsColorMap(XML);
  const reading = valueForRgb(map, 50, 136, 189);
  assert.equal(reading?.value, 220.5);
  assert.equal(reading?.unit, "K");
  assert.equal(reading?.label, "image-derived");
  assert.equal(valueForRgb(map, 158, 1, 66)?.value, 310);
  assert.equal(valueForRgb(map, 255, 0, 255), null);
  assert.equal(valueForRgb(map, 48, 136, 189)?.value, 220.5);
});

test("the route labels the converted colour image-derived and does not call a client host", async () => {
  const calls: string[] = [];
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    assert.equal(new URL(url).hostname, "gibs.earthdata.nasa.gov");
    return new Response(XML, { status: 200, headers: { "content-type": "application/xml" } });
  }) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/listen/gibs-colormap?rgb=50,136,189"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.value, 220.5);
  assert.equal(body.unit, "K");
  assert.equal(body.label, "image-derived");
  assert.equal(body.quality, "image-derived");
  assert.equal(body.range, "220–221 K");
  assert.equal(calls.length, 1);
  const cached = await GET(new NextRequest("http://localhost/api/listen/gibs-colormap?rgb=50,136,189"));
  assert.equal((await cached.json()).cached, true);
  assert.equal(calls.length, 1);
});

test("a tile pixel is read from the PNG and converted", async () => {
  const png = new PNG({ width: 2, height: 2 });
  paint(png, 0, 0, 50, 136, 189);
  paint(png, 1, 0, 255, 0, 255);
  const bytes = PNG.sync.write(png);
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    assert.equal(new URL(url).hostname, "gibs.earthdata.nasa.gov");
    if (url.endsWith(".xml")) return new Response(XML, { status: 200, headers: { "content-type": "application/xml" } });
    return new Response(new Uint8Array(bytes), { status: 200, headers: { "content-type": "image/png" } });
  }) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/listen/gibs-colormap?date=2024-06-01&z=1&x=0&y=0&px=0&py=0"));
  const body = await response.json();
  assert.equal(body.value, 220.5);
  assert.equal(body.unit, "K");
  assert.equal(body.label, "image-derived");
  const empty = await GET(new NextRequest("http://localhost/api/listen/gibs-colormap?date=2024-06-01&z=1&x=0&y=0&px=1&py=0"));
  assert.equal(empty.status, 404);
  const tile = await getTile(new NextRequest("http://localhost/api/listen/gibs-colormap/tile?date=2024-13-40&z=1&x=0&y=0"));
  assert.equal(tile.status, 400);
});

test("a bad colour is rejected before any request", async () => {
  let called = false;
  global.fetch = (async () => {
    called = true;
    return new Response(XML);
  }) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/listen/gibs-colormap?rgb=999,0,0"));
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

function paint(png: PNG, x: number, y: number, r: number, g: number, b: number) {
  const index = (png.width * y + x) << 2;
  png.data[index] = r;
  png.data[index + 1] = g;
  png.data[index + 2] = b;
  png.data[index + 3] = 255;
}
