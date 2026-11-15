import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeRequire = createRequire(import.meta.url);

Module._extensions[".ts"] = function loadTypeScript(mod, filename) {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  mod._compile(output, filename);
};

const { dateLabel, formatUtcInstantLabel, noDataForDate, probeInstantForYear } = nodeRequire(resolve(root, "src/components/listen/v4/probeDate.ts"));

assert.equal(probeInstantForYear(2024), "2024-09-15T12:00:00.000Z");
assert.equal(dateLabel(2024), "15 Sep 2024 12:00 UTC");
assert.equal(dateLabel(2026), "15 Sep 2026 12:00 UTC");
assert.equal(dateLabel(1958), "15 Sep 1958 12:00 UTC");
assert.equal(formatUtcInstantLabel("2024-01-05T00:00:00.000Z"), "5 Jan 2024 00:00 UTC");
assert.equal(formatUtcInstantLabel("not-a-date"), "");
assert.equal(dateLabel(2024.5), "");
assert.equal(noDataForDate(2024), "No data for 15 Sep 2024 12:00 UTC");
assert.equal(noDataForDate(1.2), "No data for this date");

console.log("probe date: label and no-data tests passed");
