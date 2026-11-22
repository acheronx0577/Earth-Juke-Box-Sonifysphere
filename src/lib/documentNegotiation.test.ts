import assert from "node:assert/strict";
import { test } from "node:test";
import { negotiateDocument } from "./documentNegotiation";

const BROWSER = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

test("browsers and HTML-preferring clients pass through", () => {
  assert.deepEqual(negotiateDocument({ pathname: "/", accept: BROWSER, method: "GET", rsc: false }), { kind: "passthrough" });
  assert.deepEqual(
    negotiateDocument({ pathname: "/about", accept: "text/html, text/markdown;q=0.2", method: "GET", rsc: false }),
    { kind: "passthrough" },
  );
  assert.deepEqual(negotiateDocument({ pathname: "/", accept: null, method: "GET", rsc: false }), { kind: "passthrough" });
});

test("markdown wins only when it outranks HTML", () => {
  assert.deepEqual(
    negotiateDocument({ pathname: "/", accept: "text/markdown", method: "GET", rsc: false }),
    { kind: "markdown", pathname: "/" },
  );
  assert.deepEqual(
    negotiateDocument({ pathname: "/listen/", accept: "text/markdown, text/html;q=0.5", method: "HEAD", rsc: false }),
    { kind: "markdown", pathname: "/listen" },
  );
  assert.deepEqual(
    negotiateDocument({ pathname: "/contact", accept: "text/markdown;q=0.4, text/html", method: "GET", rsc: false }),
    { kind: "passthrough" },
  );
});

test("a client that rejects both representations gets 406 on a negotiated page", () => {
  assert.equal(
    negotiateDocument({ pathname: "/challenge", accept: "application/pdf", method: "GET", rsc: false }).kind,
    "not-acceptable",
  );
});

test("an unknown path with text/markdown is a markdown 404, and HTML still falls through", () => {
  assert.equal(
    negotiateDocument({ pathname: "/does-not-exist", accept: "text/markdown", method: "GET", rsc: false }).kind,
    "markdown-not-found",
  );
  assert.equal(
    negotiateDocument({ pathname: "/does-not-exist", accept: "text/html", method: "GET", rsc: false }).kind,
    "passthrough",
  );
});

test("real pages and redirects are not treated as missing", () => {
  assert.equal(
    negotiateDocument({ pathname: "/listen/classic", accept: "text/markdown", method: "GET", rsc: false }).kind,
    "passthrough",
  );
  assert.equal(
    negotiateDocument({ pathname: "/play/guess", accept: "text/markdown", method: "GET", rsc: false }).kind,
    "passthrough",
  );
  assert.equal(
    negotiateDocument({ pathname: "/credits", accept: "text/markdown", method: "GET", rsc: false }).kind,
    "passthrough",
  );
});

test("RSC flights and non-GET requests are not negotiated", () => {
  assert.equal(
    negotiateDocument({ pathname: "/", accept: "text/markdown", method: "GET", rsc: true }).kind,
    "passthrough",
  );
  assert.equal(
    negotiateDocument({ pathname: "/", accept: "text/markdown", method: "POST", rsc: false }).kind,
    "skip",
  );
});
