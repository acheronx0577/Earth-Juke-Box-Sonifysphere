import { expect, test } from "@playwright/test";

for (const route of ["/", "/about", "/challenge"]) {
  test(`${route} loads without broken images or runtime errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (response.status() >= 400 && /^\/(assets|team)\//.test(url.pathname)) {
        errors.push(`${response.status()} ${url.pathname}`);
      }
    });
    await page.goto(route);
    await expect(page.locator("body > #main-content")).toBeVisible();
    const footer = page.locator("footer").last();
    if (await footer.count()) await footer.scrollIntoViewIfNeeded();
    await page.waitForLoadState("networkidle");
    const broken = await page.locator("img").evaluateAll((images) => images
      .filter((image) => image instanceof HTMLImageElement && image.complete && image.currentSrc && image.naturalWidth === 0)
      .map((image) => image.getAttribute("src")));
    expect(broken).toEqual([]);
    expect(errors).toEqual([]);
  });
}
