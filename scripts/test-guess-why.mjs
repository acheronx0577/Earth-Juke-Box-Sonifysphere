import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeRequire = createRequire(import.meta.url);

function loadTs(rel) {
  const filename = resolve(root, rel);
  const source = readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText.replace(/require\("@\/([^"]+)"\)/g, (_, spec) => {
    return `require(${JSON.stringify(resolve(root, "src", `${spec}.ts`))})`;
  });
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  mod._compile(output, filename);
  nodeRequire.cache[filename] = mod;
  return mod.exports;
}

loadTs("src/data/exploreMap.ts");
const { explainGuess } = loadTs("src/lib/guessWhy.ts");

function round(overrides) {
  return {
    kind: "region",
    layer: "temperature",
    season: "spring",
    weather: "clear",
    answerId: "nino34",
    ...overrides,
  };
}

const ninoSummer = explainGuess(round({ season: "summer", weather: "clear", answerId: "nino34" }), "nino34");
assert.match(ninoSummer, /Niño 3\.4 · Pacific is the highest note of the 12 places\. Summer lifts it a little more\./);

const antarctica = explainGuess(round({ season: "winter", weather: "clear", answerId: "antarctica" }), "antarctica");
assert.match(antarctica, /is the lowest note of the 12 places\. Winter pulls it down a little\./);

const europe = explainGuess(round({ season: "spring", weather: "clear", answerId: "europe" }), "europe");
assert.match(europe, /Europe is a high note among the 12 places\./);
assert.doesNotMatch(europe, /spring/);

const wrongRegion = explainGuess(round({ answerId: "nino34" }), "antarctica");
assert.match(wrongRegion, /You picked Antarctica \+ Southern Ocean\./);
assert.match(wrongRegion, /higher than that/);
assert.match(wrongRegion, /sounds higher/);

const seaIce = explainGuess(round({ kind: "layer", answerId: "sea-ice", layer: "sea-ice" }), "sea-ice");
assert.equal(seaIce, "Sea ice sounds hollow, and it is a lower one of the four records.");

const methanePick = explainGuess(round({ kind: "layer", answerId: "sea-ice", layer: "sea-ice" }), "methane");
assert.match(methanePick, /You picked Methane\./);
assert.match(methanePick, /Both sound hollow/);
assert.match(methanePick, /sea ice is a little higher/);
assert.match(methanePick, /CO₂ and temperature sound smooth/);

const co2 = explainGuess(round({ kind: "layer", answerId: "co2", layer: "co2" }), "co2");
assert.match(co2, /sounds smooth/);
assert.match(co2, /the highest/);
assert.doesNotMatch(co2, /sine|triangle/i);

for (const text of [ninoSummer, antarctica, europe, wrongRegion, seaIce, methanePick, co2]) {
  assert.doesNotMatch(text, /Hz|sine|triangle/i);
}

console.log("guessWhy: 7 cases passed");
