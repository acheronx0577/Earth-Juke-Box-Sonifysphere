import { expect, test, type Page } from "@playwright/test";

/** The live page. Next can briefly keep a second copy inside a hidden streaming slot. */
export function liveMain(page: Page) {
  return page.locator("body > #main-content");
}

export async function expectNoOverflow(page: Page): Promise<void> {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra).toBeLessThanOrEqual(1);
}

export function installErrorChecks(): void {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (text.includes("Failed to load resource") && text.includes("404")) return;
      if (text.includes("/_vercel/insights/")) return;
      errors.push(text);
    });
    page.on("response", (response) => {
      if (response.status() < 400) return;
      if (response.request().resourceType() === "document") return;
      if (response.url().includes("/_vercel/insights/")) return;
      errors.push(`${response.status()} ${response.url()}`);
    });
    (page as Page & { __errors?: string[] }).__errors = errors;
  });

  test.afterEach(async ({ page }) => {
    const errors = (page as Page & { __errors?: string[] }).__errors ?? [];
    expect(errors, errors.join("\n")).toEqual([]);
  });
}
