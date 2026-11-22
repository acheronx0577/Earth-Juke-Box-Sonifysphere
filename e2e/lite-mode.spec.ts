import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("sonify-intro-seen", "1");
  });
});

test("lite mode is off by default and turns on automatically with signals or stored choice", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("sonifysphere-lite");
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.lite)).toBe("off");

  // With saveData signal, it automatically activates
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true, effectiveType: "4g" },
      configurable: true,
    });
  });
  await page.goto("/about");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.lite)).toBe("on");
});

test("lite mode does not prefetch a route on touch when active", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sonifysphere-lite", "on");
  });
  const prefetches: string[] = [];
  page.on("request", (request) => {
    const header = request.headers()["next-router-prefetch"] || request.headers()["rsc"];
    if (header && request.url().includes("/listen")) prefetches.push(request.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/about");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.lite)).toBe("on");
  prefetches.length = 0;
  const link = page.locator("nav a[href='/listen']");
  await link.dispatchEvent("touchstart");
  await page.waitForTimeout(400);
  expect(prefetches).toEqual([]);
});
