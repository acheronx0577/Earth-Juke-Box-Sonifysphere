import { readFileSync, writeFileSync } from "node:fs";

const manifestPath = ".next/routes-manifest.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const current = manifest?.rsc?.varyHeader;
if (typeof current !== "string" || current.length === 0) {
  throw new Error("routes-manifest.json is missing rsc.varyHeader");
}
const tokens = current.split(",").map((token) => token.trim().toLowerCase());
if (!tokens.includes("accept")) {
  manifest.rsc.varyHeader = `${current}, Accept`;
  writeFileSync(manifestPath, JSON.stringify(manifest));
}
console.log(`varyHeader: ${manifest.rsc.varyHeader}`);
