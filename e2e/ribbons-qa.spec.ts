import { expect, test } from "@playwright/test";
import { installFinePointer } from "./finePointer";
import { installErrorChecks, liveMain } from "./support";

installErrorChecks();

test.beforeEach(async ({ page }) => {
  await installFinePointer(page);
});

test("ribbons keeps a visible system cursor on a fine pointer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/challenge/ribbons");
  await page.mouse.move(280, 180, { steps: 12 });
  await page.mouse.move(640, 420, { steps: 16 });

  const play = liveMain(page).getByRole("button", { name: "Hear selected point" });
  await expect.poll(async () => play.evaluate((node) => getComputedStyle(node).cursor)).toBe("pointer");
  await expect.poll(async () => liveMain(page).evaluate((node) => getComputedStyle(node).cursor)).not.toBe("none");
  await expect(page.locator(".target-cursor")).toHaveAttribute("data-suppressed", "true");
});
