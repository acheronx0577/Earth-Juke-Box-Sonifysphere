import assert from "node:assert/strict";
import { test } from "node:test";
import { createLatestRequest, isAbortError, takeIfCurrent } from "./latestRequest";

test("a later request aborts the earlier one and becomes the only current ticket", () => {
  const guard = createLatestRequest();
  const first = guard.start();
  const second = guard.start();
  assert.equal(first.signal.aborted, true);
  assert.equal(second.signal.aborted, false);
  assert.equal(guard.isCurrent(first.id), false);
  assert.equal(guard.isCurrent(second.id), true);
});

test("a slow earlier response cannot replace a newer one", async () => {
  const guard = createLatestRequest();
  const first = guard.start();
  const second = guard.start();
  const slow = await Promise.resolve({ items: ["older"] });
  const fresh = await Promise.resolve({ items: ["newer"] });
  assert.equal(takeIfCurrent(guard, first.id, slow), null);
  assert.deepEqual(takeIfCurrent(guard, second.id, fresh), fresh);
});

test("abort makes an in-flight ticket stale", () => {
  const guard = createLatestRequest();
  const ticket = guard.start();
  guard.abort();
  assert.equal(ticket.signal.aborted, true);
  assert.equal(guard.isCurrent(ticket.id), false);
  assert.equal(takeIfCurrent(guard, ticket.id, { image: "/old.png" }), null);
});

test("abort errors are recognized without treating other failures as cancellation", () => {
  const abort = new DOMException("The operation was aborted", "AbortError");
  assert.equal(isAbortError(abort), true);
  assert.equal(isAbortError(new Error("NASA search failed.")), false);
  assert.equal(isAbortError("AbortError"), false);
});
