import { expect, test } from "@playwright/test";

test("grid navigation warms the destination and preserves the document cache", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/listen?sound=off");
  await page.evaluate(() => { document.documentElement.dataset.navigationProbe = "same-document"; });
  const about = page.getByRole("navigation").getByRole("link", { name: "About", exact: true });
  const image = page.waitForResponse((response) => new URL(response.url()).pathname === "/assets/about/hero-map.svg");
  await about.hover();
  expect((await image).ok()).toBe(true);
  await expect(page).toHaveURL(/\/listen/);
  await about.click();
  const overlay = page.locator(".sonify-page-transition");
  await expect(overlay).toBeVisible();
  await expect(page).toHaveURL(/\/about$/);
  await expect(overlay).toBeHidden();
  await expect(overlay.locator("span")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-navigation-probe", "same-document");
  const transfers = await page.evaluate(() => performance.getEntriesByType("resource")
    .filter((entry) => entry.name.endsWith("/assets/about/hero-map.svg"))
    .map((entry) => (entry as PerformanceResourceTiming).transferSize));
  expect(transfers.length).toBeGreaterThan(0);
  expect(transfers.filter((bytes) => bytes > 0).length).toBeLessThanOrEqual(1);
  await page.getByRole("navigation").getByRole("link", { name: "Challenges", exact: true }).click();
  await expect(page).toHaveURL(/\/challenge$/);
  await expect(overlay).toBeHidden();
  const badge = page.getByRole("link", { name: "823 months loaded - Listen to sonifications", exact: true });
  await badge.focus();
  await badge.press("Enter");
  await expect(page).toHaveURL(/\/listen$/);
  await expect(overlay).toBeHidden();
  await expect(page.locator("main")).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\/challenge$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/about$/);
  await expect(overlay).toBeHidden();
  await page.getByRole("navigation").getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(overlay).toBeHidden();
  await expect(page.locator(".preloader")).toHaveCount(0);
  await page.getByRole("link", { name: "Enter without audio", exact: true }).click();
  await expect(page).toHaveURL(/\/listen\?sound=off$/);
  await expect(overlay).toBeHidden();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the covered interval waits briefly for destination imagery", async ({ page }) => {
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/assets/about/hero-map.svg", async (route) => {
    await held;
    await route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' });
  });
  await page.goto("/listen?sound=off");
  await page.getByRole("navigation").getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  const overlay = page.locator(".sonify-page-transition");
  await expect(overlay).toHaveAttribute("data-state", "loading");
  release!();
  await expect(overlay).toBeHidden();
});

test("reduced motion skips the grid and a broken image cannot trap navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/assets/about/hero-map.svg", (route) => route.abort());
  await page.goto("/listen?sound=off");
  await page.getByRole("navigation").getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator(".sonify-page-transition")).toBeHidden();
  await expect(page.locator(".sonify-page-transition span")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("navigation").getByRole("link", { name: "Listen", exact: true }).click();
  await expect(page).toHaveURL(/\/listen$/);
  await expect(page.locator(".sonify-page-transition")).toBeHidden();
  await page.getByRole("navigation").getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator(".sonify-page-transition")).toBeHidden();
});
