import { expect, test } from "@playwright/test";

const SIZES = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
  { name: "768", width: 768, height: 998 },
  { name: "390", width: 390, height: 844 },
  { name: "200%", width: 720, height: 450 },
] as const;

async function topControl(page: import("@playwright/test").Page, x: number, y: number) {
  return page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    const hit = el?.closest("button, a, input, nav") as HTMLElement | null;
    return hit?.getAttribute("aria-label") || hit?.textContent?.trim().slice(0, 40) || el?.tagName || "none";
  }, { x, y });
}

for (const size of SIZES) {
  test(`search and history close stay clear of the site nav at ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/listen?sound=off");
    const search = page.locator("#nasa-search");
    await expect(search).toBeVisible();
    const box = await search.boundingBox();
    if (!box) throw new Error("search has no box");
    const hit = await topControl(page, box.x + box.width / 2, box.y + box.height / 2);
    expect(hit).not.toMatch(/menu/i);
    await search.click();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).not.toHaveAttribute("class", /nav-open/);

    if (size.width < 1100) {
      await page.getByRole("button", { name: "HISTORY", exact: true }).click();
      const close = page.getByRole("button", { name: "Close history" }).first();
      await expect(close).toBeVisible();
      const closeBox = await close.boundingBox();
      if (!closeBox) throw new Error("close has no box");
      const closeHit = await topControl(page, closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
      expect(closeHit).toMatch(/Close history/);
    }
  });
}

test("search results have room for several rows and empty searches are not saved", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/listen/nasa?**", (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get("q") ?? "";
    if (q === "zzzz-no-such-media") return route.fulfill({ json: { items: [], total: 0 } });
    return route.fulfill({
      json: {
        items: Array.from({ length: 6 }, (_, index) => ({
          id: `PIA1000${index}`,
          title: `Result ${index + 1}`,
          mediaType: "image",
          preview: "/favicon-32x32.png",
          date: "2020-01-01",
          center: "JPL",
          description: "row",
        })),
        total: 6,
      },
    });
  });
  await page.goto("/listen?sound=off");
  await page.locator("#nasa-search").fill("ocean currents");
  await page.keyboard.press("Enter");
  const tray = page.getByRole("region", { name: "NASA search results" });
  await expect(tray).toBeVisible();
  const height = await tray.evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeGreaterThan(240);
  await expect(tray.getByRole("button")).toHaveCount(7);

  await page.locator("#nasa-search").fill("zzzz-no-such-media");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /zzzz-no-such-media/ })).toHaveCount(0);
  await expect(tray).toHaveCount(0);
});

test("an image source samples the pixel under the pointer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/listen?sound=off");
  await page.getByRole("button", { name: /OCO-2/ }).click();
  await expect(page.getByText("MAP · EQUAL EARTH · NOAA CPC")).toHaveCount(0);
  await expect(page.getByText("MOVE OVER THE MAP TO HEAR LOCAL CHANGE")).toHaveCount(0);
  const stage = page.locator(".lv-stage");
  const box = await stage.boundingBox();
  if (!box) throw new Error("stage has no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator(".lv-ring")).toBeVisible();
  await expect(page.getByRole("region", { name: "Readings at probe" })).not.toContainText("0° 145°W");
});

test("NASA ids with spaces are not rejected as invalid", async ({ request }) => {
  const spaced = await request.get("/api/listen/nasa/asset?id=GSFC%2020171208%20Archive");
  expect(spaced.status()).not.toBe(400);
  const dotted = await request.get("/api/listen/nasa/asset?id=PIA12345.2");
  expect(dotted.status()).not.toBe(400);
  const traversal = await request.get("/api/listen/nasa/asset?id=..%2Fsecret");
  expect(traversal.status()).toBe(400);
});

test("new source stays full height and the file input is not a tab stop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/listen?sound=off");
  const button = page.getByRole("button", { name: "+ New source" });
  const box = await button.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(58);
  await expect(page.locator("input[type=file]")).toHaveAttribute("tabindex", "-1");
});

test("sea ice does not reuse the temperature tooltip", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/listen?sound=off");
  await page.getByRole("button", { name: "SEA ICE", exact: true }).click();
  await expect(page.getByText("NIÑO 3.4 · WARMER")).toHaveCount(0);
  await expect(page.getByText("NO SEA ICE HERE")).toBeVisible();
});
