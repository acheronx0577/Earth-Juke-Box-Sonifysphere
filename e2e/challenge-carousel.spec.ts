import { expect, test, type Page } from "@playwright/test";
import { installErrorChecks, liveMain } from "./support";

installErrorChecks();

async function labelBox(page: Page, title: RegExp) {
  const label = liveMain(page).locator(".circular-gallery-label").filter({ hasText: title }).first();
  await expect(label).toBeVisible();
  await expect.poll(async () => Number.parseFloat(await label.evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
  return label.boundingBox();
}

test("challenge carousel auto-advances, pauses, and loops", async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/challenge");
  const count = liveMain(page).locator("[data-challenge-count]");
  await expect(count).toHaveAttribute("data-challenge-count", "01");
  await page.waitForTimeout(1700);

  const before = await labelBox(page, /GUESS THE SIGNAL/i);
  await page.waitForTimeout(700);
  const moved = await labelBox(page, /GUESS THE SIGNAL/i);
  expect(before && moved).toBeTruthy();
  const delta = Math.abs((moved?.x ?? 0) - (before?.x ?? 0));
  expect(delta).toBeGreaterThan(8);
  expect(delta).toBeLessThan(160);

  await page.locator(".circular-gallery").hover();
  await expect(liveMain(page).locator(".story-chapters-section")).toHaveAttribute("data-paused", "true");
  await page.waitForTimeout(900);
  const held = await labelBox(page, /GUESS THE SIGNAL/i);
  await page.waitForTimeout(700);
  const still = await labelBox(page, /GUESS THE SIGNAL/i);
  expect(Math.abs((still?.x ?? 0) - (held?.x ?? 0))).toBeLessThan(3);

  await page.mouse.move(2, 2);
  await expect(liveMain(page).locator(".story-chapters-section")).toHaveAttribute("data-paused", "false");

  await page.getByRole("button", { name: "Next Challenge" }).focus();
  await expect(liveMain(page).locator(".story-chapters-section")).toHaveAttribute("data-paused", "true");
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
  await expect(liveMain(page).locator(".story-chapters-section")).toHaveAttribute("data-paused", "false");

  const seen = new Set<string>(["01"]);
  await expect.poll(async () => {
    const value = await count.getAttribute("data-challenge-count");
    if (value) seen.add(value);
    return [...seen].sort().join(",");
  }, { timeout: 45_000 }).toBe("01,02,03,04,05");
  await expect.poll(async () => count.getAttribute("data-challenge-count"), { timeout: 20_000 }).toBe("01");
});

test("challenge carousel stays still when motion is reduced", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/challenge");
  await expect(liveMain(page).locator(".story-chapters-section")).toHaveAttribute("data-reduced-motion", "true");
  const before = await labelBox(page, /GUESS THE SIGNAL/i);
  await page.waitForTimeout(900);
  const after = await labelBox(page, /GUESS THE SIGNAL/i);
  expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(2);
  await expect(liveMain(page).locator("[data-challenge-count]")).toHaveAttribute("data-challenge-count", "01");
});

test("challenge arrows keep the play link on the centred game", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/challenge");
  const play = liveMain(page).getByRole("link", { name: "Play Guess the Signal" });
  await expect(play).toHaveAttribute("href", "/challenge/guess");
  await liveMain(page).getByRole("button", { name: "Next Challenge" }).click();
  await expect(liveMain(page).locator("[data-challenge-count]")).toHaveAttribute("data-challenge-count", "02");
  await expect(liveMain(page).getByRole("link", { name: "Play Compose Track" })).toHaveAttribute("href", "/challenge/compose");
  await page.keyboard.press("ArrowLeft");
  await expect(liveMain(page).getByRole("link", { name: "Play Guess the Signal" })).toHaveAttribute("href", "/challenge/guess");
  await page.keyboard.press("ArrowRight");
  await expect(liveMain(page).locator("[data-challenge-count]")).toHaveAttribute("data-challenge-count", "02");
});
