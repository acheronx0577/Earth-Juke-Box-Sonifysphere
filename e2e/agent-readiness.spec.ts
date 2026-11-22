import { expect, test, type APIResponse } from "@playwright/test";

const BROWSER = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";

function varyTokens(response: APIResponse): string[] {
  return (response.headers()["vary"] ?? "")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function htmlTextRatio(html: string): { textChars: number; htmlBytes: number; ratio: number } {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = stripped
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const htmlBytes = Buffer.byteLength(html);
  return { textChars: text.length, htmlBytes, ratio: textCharsSafe(text.length, htmlBytes) };
}

function textCharsSafe(textChars: number, htmlBytes: number): number {
  return htmlBytes === 0 ? 0 : textChars / htmlBytes;
}

test("homepage markdown negotiation honors q-values and Vary", async ({ request }) => {
  const markdown = await request.get("/", { headers: { Accept: "text/markdown" } });
  expect(markdown.status()).toBe(200);
  expect(markdown.headers()["content-type"]).toBe("text/markdown; charset=utf-8");
  expect(varyTokens(markdown)).toContain("accept");
  const body = await markdown.text();
  expect(body.length).toBeGreaterThan(20);
  expect(body).toContain("# SonifySphere");
  expect(body).not.toContain("<html");

  const htmlPreferred = await request.get("/", { headers: { Accept: "text/html, text/markdown;q=0.1" } });
  expect(htmlPreferred.status()).toBe(200);
  expect(htmlPreferred.headers()["content-type"] ?? "").toContain("text/html");
  expect(varyTokens(htmlPreferred)).toContain("accept");
  expect(varyTokens(htmlPreferred)).toContain("rsc");

  const markdownPreferred = await request.get("/", { headers: { Accept: "text/markdown, text/html;q=0.1" } });
  expect(markdownPreferred.headers()["content-type"]).toBe("text/markdown; charset=utf-8");

  const browser = await request.get("/", { headers: { Accept: BROWSER } });
  expect(browser.status()).toBe(200);
  expect(browser.headers()["content-type"] ?? "").toContain("text/html");
  const html = await browser.text();
  expect(html).toContain("<html");
  expect(html).not.toContain("# SonifySphere\n");
});

test("inner pages negotiate markdown the same way", async ({ request }) => {
  for (const path of ["/about", "/listen", "/challenge", "/contact"]) {
    const markdown = await request.get(path, { headers: { Accept: "text/markdown" } });
    expect(markdown.status(), path).toBe(200);
    expect(markdown.headers()["content-type"], path).toBe("text/markdown; charset=utf-8");
    expect(varyTokens(markdown), path).toContain("accept");
    expect((await markdown.text()).length, path).toBeGreaterThan(20);

    const html = await request.get(path, { headers: { Accept: "text/html" } });
    expect(html.headers()["content-type"] ?? "", path).toContain("text/html");
    expect(varyTokens(html), path).toContain("accept");
    expect(varyTokens(html), path).toContain("rsc");
  }
});

test("a missing path stays HTTP 404 and switches body with Accept", async ({ request }) => {
  const markdown = await request.get("/does-not-exist", { headers: { Accept: "text/markdown" } });
  expect(markdown.status()).toBe(404);
  expect(markdown.headers()["content-type"]).toBe("text/markdown; charset=utf-8");
  expect(varyTokens(markdown)).toContain("accept");
  const body = await markdown.text();
  expect(body.length).toBeGreaterThanOrEqual(20);
  expect(body.toLowerCase()).toContain("not found");
  expect(body).toContain("/llms.txt");
  expect(body).toContain("/sitemap.xml");
  expect(body).not.toContain("<html");

  const html = await request.get("/does-not-exist", { headers: { Accept: "text/html" } });
  expect(html.status()).toBe(404);
  expect(html.headers()["content-type"] ?? "").toContain("text/html");
  expect(varyTokens(html)).toContain("rsc");
  expect(varyTokens(html)).not.toContain("accept");
  const htmlBody = await html.text();
  expect(htmlBody).toContain("Signal lost");
  expect(htmlBody).toContain("Return home");
});

test("raw homepage HTML has one H1, sequential headings, JSON-LD, and a 5% text ratio", async ({ page, request }) => {
  const response = await request.get("/", { headers: { Accept: BROWSER } });
  const html = await response.text();
  const measured = htmlTextRatio(html);
  expect(measured.textChars).toBeGreaterThanOrEqual(500);
  expect(measured.ratio).toBeGreaterThanOrEqual(0.05);

  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match) => ({
    level: Number(match[1]),
    text: (match[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  }));
  const h1s = headings.filter((heading) => heading.level === 1);
  expect(h1s).toHaveLength(1);
  expect(h1s[0]?.text).toBe("Earth breathes");
  let previous = 1;
  for (const heading of headings) {
    expect(heading.text.length).toBeGreaterThan(0);
    expect(heading.level).toBeLessThanOrEqual(previous + 1);
    previous = heading.level;
  }

  expect(html).toContain('type="application/ld+json"');
  const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  expect(json).toBeTruthy();
  const data = JSON.parse(json ?? "{}") as { "@graph": Array<{ "@type": string }> };
  expect(data["@graph"].map((node) => node["@type"])).toEqual(["WebSite", "WebApplication", "Organization"]);

  await page.goto("/");
  const summary = page.locator("[data-agent-summary]");
  await expect(summary).toHaveCount(1);
  const box = await summary.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(2);
  expect(box?.height ?? 0).toBeLessThanOrEqual(2);
  await expect(page.getByRole("heading", { name: "Pick what Earth plays" })).toBeVisible();
});

test("llms.txt, the full guide, robots, and the sitemap are linked", async ({ request }) => {
  const llms = await request.get("/llms.txt");
  expect(llms.status()).toBe(200);
  expect(llms.headers()["content-type"] ?? "").toMatch(/text\/plain/);
  const text = await llms.text();
  expect(text.startsWith("# SonifySphere")).toBe(true);
  expect(text).toContain("## When to use");
  expect(text).toContain("> ");

  const full = await request.get("/llms-full.txt");
  expect(full.status()).toBe(200);
  expect((await full.text()).length).toBeGreaterThan(text.length);

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const robotsBody = await robots.text();
  expect(robotsBody).toContain("/llms.txt");
  expect(robotsBody).toContain("Sitemap:");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain("https://www.sonifysphere.earth/llms.txt");
  expect(xml).toContain("https://www.sonifysphere.earth/");
});
