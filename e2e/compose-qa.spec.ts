import { expect, test } from "@playwright/test";
import { installFinePointer } from "./finePointer";
import { installErrorChecks, liveMain } from "./support";

installErrorChecks();

test.beforeEach(async ({ page }) => {
  await installFinePointer(page);
});

test("compose keeps a visible system cursor on a fine pointer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/challenge/compose");
  await page.mouse.move(240, 160, { steps: 12 });
  await page.mouse.move(520, 420, { steps: 16 });

  const slot = liveMain(page).locator("[data-testid='compose-slots'] button").first();
  await expect.poll(async () => slot.evaluate((node) => getComputedStyle(node).cursor)).toBe("pointer");
  await expect.poll(async () => liveMain(page).evaluate((node) => getComputedStyle(node).cursor)).not.toBe("none");
  await expect(page.locator(".target-cursor")).toHaveAttribute("data-suppressed", "true");
});
