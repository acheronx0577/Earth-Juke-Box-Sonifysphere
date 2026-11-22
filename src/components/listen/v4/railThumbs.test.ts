import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const model = readFileSync(new URL("./model.ts", import.meta.url), "utf8");
const view = readFileSync(new URL("./ListenV4.tsx", import.meta.url), "utf8");

test("seed NASA stills point the rail at a small local thumb", () => {
  const ids = ["5196", "3912", "5011"];
  for (const id of ids) {
    const thumb = `/assets/listen/thumbs/svs-${id}.webp`;
    assert.match(model, new RegExp(`preview: "/api/listen/svs/image\\?id=${id}"`));
    assert.match(model, new RegExp(`thumb: "${thumb}"`));
    const size = statSync(new URL(`../../../../public${thumb}`, import.meta.url)).size;
    assert.ok(size < 20_000, `${thumb} is ${size} bytes`);
  }
});

test("the history rail does not use the full stage preview when a thumb exists", () => {
  assert.match(view, /source\.thumb \|\| source\.preview/);
  assert.match(view, /loading="lazy"/);
});
