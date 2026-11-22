import assert from "node:assert/strict";
import { test } from "node:test";
import {
  INDEXNOW_HOST,
  INDEXNOW_KEY,
  INDEXNOW_URLS,
  buildIndexNowPayload,
  submitToIndexNow,
} from "./indexNow";

test("INDEXNOW_KEY is a valid 32-character hexadecimal string", () => {
  assert.equal(INDEXNOW_KEY.length, 32);
  assert.match(INDEXNOW_KEY, /^[0-9a-f]{32}$/);
});

test("INDEXNOW_HOST matches canonical production domain", () => {
  assert.equal(INDEXNOW_HOST, "www.sonifysphere.earth");
});

test("INDEXNOW_URLS contains key pages with full https URLs", () => {
  assert.ok(INDEXNOW_URLS.length >= 7);
  for (const url of INDEXNOW_URLS) {
    assert.match(url, /^https:\/\/www\.sonifysphere\.earth\//);
  }
});

test("buildIndexNowPayload creates conforming IndexNow payload structure", () => {
  const payload = buildIndexNowPayload();
  assert.equal(payload.host, "www.sonifysphere.earth");
  assert.equal(payload.key, INDEXNOW_KEY);
  assert.equal(
    payload.keyLocation,
    `https://www.sonifysphere.earth/${INDEXNOW_KEY}.txt`
  );
  assert.deepEqual(payload.urlList, [...INDEXNOW_URLS]);
});

test("submitToIndexNow sends valid request to api.indexnow.org", async () => {
  let requestedUrl = "";
  let requestInit: RequestInit | undefined;

  const mockFetch: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await submitToIndexNow(INDEXNOW_URLS, mockFetch);
  assert.equal(requestedUrl, "https://api.indexnow.org/indexnow");
  assert.equal(requestInit?.method, "POST");
  assert.equal(
    (requestInit?.headers as Record<string, string>)["Content-Type"],
    "application/json; charset=utf-8"
  );
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
});
