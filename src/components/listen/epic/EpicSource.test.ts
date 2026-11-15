import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the EPIC page source does not mention the NASA key", () => {
  const files = [
    "src/components/listen/epic/EpicSource.tsx",
    "src/components/listen/epic/epic.module.css",
    "src/app/listen/epic/page.tsx",
    "src/lib/nasa/epicTypes.ts",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.equal(/NASA_API_KEY|DEMO_KEY|api_key/i.test(source), false, file);
  }
});
