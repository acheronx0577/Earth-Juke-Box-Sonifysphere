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

test("challenge card titles stay on one line", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/challenge");
  for (const width of [2560, 1920, 1440, 390]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    const titles = width >= 1200 ? ["GUESS THE SIGNAL", "CLIMATE CONSOLE"] : ["GUESS THE SIGNAL"];
    for (const title of titles) {
      const label = liveMain(page).locator(".circular-gallery-label").filter({ hasText: title, visible: true }).first();
      await expect(label).toBeVisible();
      await expect.poll(async () => label.evaluate((el) => {
        const style = getComputedStyle(el);
        if (style.whiteSpace !== "nowrap" || Number(style.opacity) < 0.5) return 0;
        const fontSize = Number.parseFloat(style.fontSize);
        const height = el.getBoundingClientRect().height;
        if (!fontSize || height <= 0) return 0;
        return height / fontSize;
      }), { message: `${title} at ${width}px` }).toBeLessThan(1.6);
    }
    if (width >= 1280) {
      await expect.poll(async () => page.locator(".circular-gallery-label").evaluateAll((els) => els.filter((el) => {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return Number(style.opacity) > 0.4 && style.whiteSpace === "nowrap" && box.width > 8 && box.right > 8 && box.left < window.innerWidth - 8;
      }).length), { message: `visible titles at ${width}px` }).toBeGreaterThan(3);
    }
  }
});

test("challenge footer keeps the observatory chip and listen mark on tablet and desktop", async ({ page }) => {
  await page.goto("/challenge");
  const chip = liveMain(page).getByText("NOAA GML · Mauna Loa Observatory");
  const badge = page.getByRole("link", { name: "823 months loaded - Listen to sonifications", exact: true });
  const pill = liveMain(page).getByRole("link", { name: "Listen to the map", exact: true });

  for (const width of [1440, 768]) {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 900 });
    await expect(chip).toBeVisible();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute("href", "/listen");
    await expect(pill).toBeHidden();
    const chipBox = await chip.boundingBox();
    const badgeBox = await badge.boundingBox();
    if (!chipBox || !badgeBox) throw new Error("Challenge footer boxes were not measurable");
    expect(chipBox.x + chipBox.width).toBeLessThan(badgeBox.x);
  }
});

test("challenge footer uses a centred listen pill on phone", async ({ page }) => {
  await page.goto("/challenge");
  const chip = liveMain(page).getByText("NOAA GML · Mauna Loa Observatory");
  const badge = page.getByRole("link", { name: "823 months loaded - Listen to sonifications", exact: true });
  const pill = liveMain(page).getByRole("link", { name: "Listen to the map", exact: true });
  const row = liveMain(page).locator(".story-chapters-bottom");

  for (const width of [430, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(chip).toBeHidden();
    await expect(badge).toBeHidden();
    await expect(pill).toBeVisible();
    await expect(pill).toHaveAttribute("href", "/listen");
    await expect(pill).toContainText("Listen to the map");
    await expect(pill).not.toContainText("«");
    await expect(pill.locator("svg[aria-hidden='true']")).toHaveCount(2);
    const pillBox = await pill.boundingBox();
    const rowBox = await row.boundingBox();
    if (!pillBox || !rowBox) throw new Error("Phone listen pill was not measurable");
    expect(pillBox.height).toBeGreaterThanOrEqual(44);
    const pillMid = pillBox.x + pillBox.width / 2;
    const rowMid = rowBox.x + rowBox.width / 2;
    expect(Math.abs(pillMid - rowMid)).toBeLessThan(8);
  }
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
