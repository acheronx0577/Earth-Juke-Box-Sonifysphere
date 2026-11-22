import assert from "node:assert/strict";
import { test } from "node:test";
import { appendVaryAccept, mergeVaryHeader, preferredType, varyIncludesAccept } from "./contentNegotiation";

const BROWSER = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";

test("missing or empty Accept prefers HTML", () => {
  assert.equal(preferredType(null), "text/html");
  assert.equal(preferredType(""), "text/html");
  assert.equal(preferredType("   "), "text/html");
});

test("a lone text/markdown request prefers Markdown", () => {
  assert.equal(preferredType("text/markdown"), "text/markdown");
  assert.equal(preferredType("TEXT/Markdown"), "text/markdown");
});

test("HTML wins when it is preferred, including the browser default", () => {
  assert.equal(preferredType("text/html"), "text/html");
  assert.equal(preferredType(BROWSER), "text/html");
  assert.equal(preferredType("text/html, text/markdown;q=0.9"), "text/html");
  assert.equal(preferredType("text/markdown;q=0.5, text/html;q=0.9"), "text/html");
  assert.equal(preferredType("*/*"), "text/html");
  assert.equal(preferredType("text/markdown;q=0, */*"), "text/html");
});

test("Markdown wins when its q-value is higher, and client order breaks equal q", () => {
  assert.equal(preferredType("text/markdown, text/html;q=0.8"), "text/markdown");
  assert.equal(preferredType("text/markdown, text/html"), "text/markdown");
  assert.equal(preferredType("text/html;q=0, text/markdown"), "text/markdown");
  assert.equal(preferredType("text/*;q=0.2, text/html;q=0.1"), "text/markdown");
});

test("a specific q=0 rejection is not overridden by a wildcard", () => {
  assert.equal(preferredType("text/html;q=0, */*;q=1"), "text/markdown");
  assert.equal(preferredType("text/markdown;q=0, text/html;q=0"), null);
  assert.equal(preferredType("application/pdf"), null);
  assert.equal(preferredType("text/x-component"), null);
});

test("q-values are clamped and a non-numeric q is ignored", () => {
  assert.equal(preferredType("text/markdown;q=2, text/html;q=1"), "text/markdown");
  assert.equal(preferredType("text/markdown;q=-1, text/html"), "text/html");
  assert.equal(preferredType("text/markdown;q=nope"), "text/markdown");
});

test("merging Vary keeps Accept and the Next.js RSC tokens", () => {
  const merged = mergeVaryHeader(
    "Accept",
    "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch",
  );
  assert.match(merged, /accept/i);
  assert.match(merged, /rsc/i);
  assert.match(merged, /next-router-state-tree/i);
  assert.equal(
    mergeVaryHeader(merged, "Accept, rsc"),
    merged,
  );
});

test("Vary gains Accept without dropping existing tokens", () => {
  const headers = new Headers({ Vary: "rsc, next-router-state-tree, next-router-prefetch" });
  appendVaryAccept(headers);
  const vary = headers.get("Vary") ?? "";
  assert.equal(varyIncludesAccept(vary), true);
  assert.match(vary, /rsc/i);
  assert.match(vary, /next-router-state-tree/i);
  appendVaryAccept(headers);
  assert.equal(headers.get("Vary"), vary);
});
