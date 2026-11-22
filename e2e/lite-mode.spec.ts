import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("sonify-intro-seen", "1");
    localStorage.removeItem("sonifysphere-lite");
  });
});

test("lite mode is off by default, persists, and keeps a chamfered 44px control", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Lite mode off" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const box = await toggle.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  const paint = await toggle.evaluate((element) => {
    const style = getComputedStyle(element);
    const before = getComputedStyle(element, "::before");
    return {
      color: style.color,
      fill: style.getPropertyValue("--lite-fill").trim(),
      stroke: before.backgroundColor,
      clip: before.clipPath,
      outline: style.outlineStyle,
    };
  });
  expect(paint.color).toBe("rgb(242, 242, 240)");
  expect(paint.fill).toBe("#141414");
  expect(paint.stroke).toBe("rgb(85, 85, 85)");
  expect(paint.clip.startsWith("polygon")).toBe(true);
  expect(paint.outline).not.toBe("auto");

  await toggle.click();
  await expect(page.getByRole("button", { name: "Lite mode on" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("sonifysphere-lite"))).toBe("on");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.lite)).toBe("on");

  await page.reload();
  await expect(page.getByRole("button", { name: "Lite mode on" })).toHaveAttribute("aria-pressed", "true");
});

test("lite mode does not prefetch a route on touch", async ({ page }) => {
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
  const link = page.locator("nav a[href='/listen']");
  await link.dispatchEvent("touchstart");
  await page.waitForTimeout(400);
  expect(prefetches).toEqual([]);
});
