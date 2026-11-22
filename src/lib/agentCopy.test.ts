import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GITHUB_REPO,
  MARKDOWN_CONTENT_TYPE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  homepageJsonLd,
  llmsFullTxt,
  llmsTxt,
  markdownForPath,
  notFoundMarkdown,
  readableSummaryText,
  robotsTxt,
} from "./agentCopy";

function h2Sections(markdown: string): Array<{ title: string; items: string[] }> {
  const lines = markdown.replace(/^\uFEFF/, "").split("\n");
  const sections: Array<{ title: string; items: string[] }> = [];
  let current: { title: string; items: string[] } | null = null;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      current = { title: line.slice(3), items: [] };
      sections.push(current);
      continue;
    }
    if (current && line.startsWith("- ")) current.items.push(line);
  }
  return sections;
}

test("llms.txt follows the llmstxt.org section order", () => {
  const text = llmsTxt();
  const lines = text.split("\n");
  assert.equal(lines[0], `# ${SITE_NAME}`);
  assert.equal(lines[1], "");
  assert.ok(lines[2]?.startsWith("> "));
  assert.equal(lines.find((line) => line.startsWith("## ")), "## When to use");
  assert.ok(!lines.slice(1).some((line) => line.startsWith("# ")));

  const sections = h2Sections(text);
  assert.deepEqual(sections.map((section) => section.title), ["When to use", "Pages", "Optional"]);
  for (const section of sections) {
    assert.ok(section.items.length > 0, section.title);
    for (const item of section.items) {
      assert.match(item, /^- \[[^\]]+\]\(https:\/\/[^)\s]+\)/);
    }
  }

  const when = sections[0]?.items.join("\n") ?? "";
  assert.match(when, /Hear NASA and Earth climate datasets as sound/);
  assert.match(when, /Sonification examples for education/);
  assert.match(when, /Guess the Signal/);
  assert.match(when, /Tune the Signal/);
  assert.match(when, /Waveform Ribbons/);
  assert.match(text, /Accept: text\/markdown/);
  assert.match(text, /`seed`/);
  assert.match(text, /`result`/);
  assert.match(text, /`sound`/);
  assert.match(text, /llms-full\.txt/);
});

test("llms-full includes the guide and the negotiated pages", () => {
  const full = llmsFullTxt();
  assert.ok(full.startsWith(llmsTxt().trimEnd()) || full.includes("# SonifySphere"));
  assert.match(full, /https:\/\/www\.sonifysphere\.earth\/listen/);
  assert.ok(full.length > llmsTxt().length);
});

test("negotiated pages and the markdown 404 are non-empty markdown", () => {
  assert.equal(MARKDOWN_CONTENT_TYPE, "text/markdown; charset=utf-8");
  for (const path of ["/", "/about", "/listen", "/challenge", "/contact", "/privacy"]) {
    const body = markdownForPath(path);
    assert.ok(body && body.length >= 20, path);
    assert.ok(body?.startsWith("# "), path);
  }
  assert.equal(markdownForPath("/nope"), null);
  const missing = notFoundMarkdown();
  assert.ok(missing.length >= 20);
  assert.match(missing, /not found/i);
  assert.match(missing, /\/llms\.txt/);
  assert.match(missing, /\/sitemap\.xml/);
});

test("homepage JSON-LD is WebSite, WebApplication, and Organization", () => {
  const raw = JSON.stringify(homepageJsonLd());
  const parsed = JSON.parse(raw) as {
    "@context": string;
    "@graph": Array<Record<string, unknown>>;
  };
  assert.equal(parsed["@context"], "https://schema.org");
  const [website, app, org] = parsed["@graph"];
  assert.ok(website);
  assert.ok(app);
  assert.ok(org);
  assert.equal(website["@type"], "WebSite");
  assert.equal(app["@type"], "WebApplication");
  assert.equal(org["@type"], "Organization");
  for (const node of [website, app, org]) {
    assert.equal(node.name, SITE_NAME);
    assert.equal(node.description, SITE_DESCRIPTION);
    assert.equal(node.url, SITE_URL);
    assert.deepEqual(node.sameAs, [GITHUB_REPO]);
  }
  assert.equal(app.applicationCategory, "EducationalApplication");
  assert.equal(app.isAccessibleForFree, true);
  const offers = app.offers as { "@type": string; price: string; priceCurrency: string };
  assert.equal(offers["@type"], "Offer");
  assert.equal(offers.price, "0");
  assert.equal(offers.priceCurrency, "USD");
  assert.equal(/aggregateRating|award|review/i.test(raw), false);
});

test("robots.txt points agents at llms.txt and the sitemap", () => {
  const robots = robotsTxt();
  assert.match(robots, /^User-Agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /https:\/\/www\.sonifysphere\.earth\/llms\.txt/);
  assert.match(robots, /^Sitemap: https:\/\/www\.sonifysphere\.earth\/sitemap\.xml$/m);
});

test("the homepage summary is long enough to carry the raw-HTML text ratio", () => {
  const text = readableSummaryText();
  assert.ok(text.length >= 5000, `summary is ${text.length} chars`);
  assert.match(text, /Earth breathes/);
  assert.match(text, /Accept: text\/markdown/);
  assert.match(text, /examples, not a live feed/);
});
