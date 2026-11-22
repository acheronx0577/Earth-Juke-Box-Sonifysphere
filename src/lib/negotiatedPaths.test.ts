import assert from "node:assert/strict";
import { test } from "node:test";
import { isNegotiatedPath, pathnameOf } from "./negotiatedPaths";

test("only the negotiated documents match", () => {
  assert.equal(pathnameOf("/"), "/");
  assert.equal(pathnameOf("/about/"), "/about");
  assert.equal(pathnameOf("/listen?sound=on"), "/listen");
  assert.equal(isNegotiatedPath("/"), true);
  assert.equal(isNegotiatedPath("/contact"), true);
  assert.equal(isNegotiatedPath("/privacy"), true);
  assert.equal(isNegotiatedPath("/listen/classic"), false);
  assert.equal(isNegotiatedPath("/api/listen/eic"), false);
  assert.equal(isNegotiatedPath("/does-not-exist"), false);
  assert.equal(isNegotiatedPath(undefined), false);
});
