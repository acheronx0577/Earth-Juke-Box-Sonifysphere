import { expect, test } from "@playwright/test";

test("the homepage does not download the globe renderer", async ({ page }) => {
  const hits: string[] = [];
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/_next/static/chunks/") || response.status() !== 200) return;
    const length = Number(response.headers()["content-length"] || 0);
    if (length && length < 80_000) return;
    const body = await response.text().catch(() => "");
    if (body.includes("maplibre")) hits.push(url);
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("sonify-intro-seen", "1");
  });
  await page.goto("/");
  await page.waitForTimeout(4000);
  expect(hits).toEqual([]);
});
