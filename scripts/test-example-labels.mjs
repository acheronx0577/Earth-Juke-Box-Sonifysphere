import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeRequire = createRequire(import.meta.url);

function transpile(filename, source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true },
    fileName: filename,
  }).outputText.replace(/require\("@\/([^"]+)"\)/g, (_, spec) => {
    const file = spec.endsWith(".json") ? spec : `${spec}.ts`;
    return `require(${JSON.stringify(resolve(root, "src", file))})`;
  });
}

Module._extensions[".ts"] = function loadTypeScript(mod, filename) {
  mod._compile(transpile(filename, readFileSync(filename, "utf8")), filename);
};

const { MAP_SOURCE, readProbe } = nodeRequire(resolve(root, "src/components/listen/v4/model.ts"));
const { readingFor, MAP_REGIONS } = nodeRequire(resolve(root, "src/data/exploreMap.ts"));

const reading = readProbe({
  layer: "sea-ice",
  year: 2024,
  lat: 78,
  lng: 0,
  source: MAP_SOURCE,
  pixelColor: null,
  measured: null,
  measuring: false,
});
const card = reading.cards.find((item) => item.id === "sea-ice");
assert.equal(card.value, "EXAMPLE");
assert.match(card.detail, /EXAMPLE/);
assert.equal(JSON.stringify(card).includes("4.81"), false);
assert.equal(JSON.stringify(card).includes("million"), false);
assert.equal(reading.dataAtProbe, "MATCHED · EXAMPLE");
assert.equal(reading.normalized, null);

const arctic = MAP_REGIONS.find((region) => region.id === "arctic");
const classic = readingFor(arctic, "sea-ice");
assert.equal(classic.value, "EXAMPLE");
assert.match(classic.source, /EXAMPLE/);
assert.equal(classic.value.includes("4.81"), false);

const south = readProbe({
  layer: "sea-ice",
  year: 2024,
  lat: -74,
  lng: 15,
  source: MAP_SOURCE,
  pixelColor: null,
  measured: null,
  measuring: false,
});
const southCard = south.cards.find((item) => item.id === "sea-ice");
assert.equal(southCard.value, "EXAMPLE");
assert.match(southCard.detail, /EXAMPLE/);

console.log("example labels: sea-ice figure is not presented as a measurement");
