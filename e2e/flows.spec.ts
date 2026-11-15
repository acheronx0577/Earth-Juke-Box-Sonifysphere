import { expect, test, type Page } from "@playwright/test";
import { expectNoOverflow, installErrorChecks, liveMain } from "./support";

installErrorChecks();

const REGIONS = [
  "Arctic",
  "North America",
  "Europe",
  "Asia",
  "Africa",
  "South America",
  "Oceania",
  "Antarctica + Southern Ocean",
  "Atlantic Ocean",
  "Pacific Ocean",
  "Indian Ocean",
  "Niño 3.4 · Pacific",
] as const;

async function chooseRegion(page: Page, name: string): Promise<void> {
  const region = page.getByRole("button", { name, exact: true }).filter({ visible: true });
  await expect(region).toBeAttached();
  await region.evaluate((el: HTMLButtonElement) => el.click());
  await expect(region).toHaveAttribute("aria-pressed", "true");
}

test("home skip link focuses the page and the nav stays four links", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.dataset.sonifyReady === "1");
  const main = liveMain(page);
  const skip = page.getByRole("link", { name: "Skip to content" });
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(main).toBeFocused();

  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Listen" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Challenge" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "About" })).toBeVisible();
  await expectNoOverflow(page);
});

test("play, about, listen, and unknown routes each load one page", async ({ page }) => {
  await page.goto("/play");
  await expect(page).toHaveURL(/\/challenge$/);
  await expect(page.getByRole("region", { name: "Story Chapters Carousel" })).toBeVisible();

  await page.goto("/about");
  await expect(page.locator("footer").getByRole("link", { name: "Challenges" })).toBeVisible();
  await expect(liveMain(page)).toHaveCount(1);

  await page.goto("/listen?sound=off");
  await expect(liveMain(page)).toHaveCount(1);
  await expect(page.locator("aside[aria-label='Persistent mini-player']")).toHaveAttribute("data-open", "false");

  await page.goto("/no-such-signal");
  await expect(page.getByRole("heading", { name: "Signal lost" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return home" })).toBeVisible();
  await expectNoOverflow(page);
});

test("dataset chips switch the listen record", async ({ page }) => {
  await page.goto("/");
  const picks = liveMain(page).locator("a").filter({ hasText: "Pick a dataset →" });
  await expect(picks).toHaveCount(2);
  await page.getByRole("button", { name: /Temperature/ }).click();
  await expect(picks.nth(0)).toHaveAttribute("href", "/listen?data=temp");

  await page.goto("/listen?data=co2&sound=off");
  await expect(page.getByRole("button", { name: "CO₂", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "METHANE", exact: true }).click();
  await expect(page).toHaveURL(/data=ch4/);
  await expect(page.getByRole("button", { name: "METHANE", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("sound off persists and blocks a new Hear", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Sound on", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sound off", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Hear it" }).click();
  await expect(liveMain(page).getByText("Sound is off.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn sound on" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sound off", exact: true })).toHaveAttribute("aria-pressed", "false");

  await page.goto("/challenge/guess?seed=4");
  await page.getByRole("button", { name: "Hear the signal" }).click();
  await expect(liveMain(page).getByText("Sound is off.")).toBeVisible();
  await expect(liveMain(page).getByText("Round 1 of 5").first()).toBeVisible();
});

test("listen regions open a place and link to the challenge", async ({ page }) => {
  await page.goto("/listen/classic?sound=off");
  await expect(page.getByRole("link", { name: "Skip to map regions" })).toHaveCount(1);
  const pacific = page.getByRole("button", { name: "Pacific Ocean", exact: true }).filter({ visible: true });
  await expect(pacific).toHaveCSS("opacity", "1");
  const covered = await pacific.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return top !== el && !el.contains(top as Node);
  });
  expect(covered).toBe(false);
  for (const name of REGIONS) {
    await chooseRegion(page, name);
  }
  await expect(liveMain(page).locator("[data-place-extra]").first()).toHaveAttribute("href", "/challenge");
  await expect(page.locator("aside[aria-label='Persistent mini-player']")).toHaveAttribute("data-open", "false");
  await expectNoOverflow(page);
});

test("place card Turn sound on accepts a pointer click", async ({ page }) => {
  await page.goto("/listen/classic?sound=off");
  const europe = page.getByRole("button", { name: "Europe", exact: true }).filter({ visible: true });
  await europe.evaluate((el: HTMLButtonElement) => el.click());
  await page.getByRole("button", { name: "Hear it" }).filter({ visible: true }).click();
  const turnOn = page.getByRole("button", { name: "Turn sound on" }).filter({ visible: true });
  await expect(turnOn).toBeVisible();
  const hit = await turnOn.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return top === el || el.contains(top as Node);
  });
  expect(hit).toBe(true);
  await turnOn.click();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("sonifysphere-sound"))).toBe("on");
  await expect(page.getByRole("button", { name: "Turn sound on" })).toHaveCount(0);
});

test("share link records the open region", async ({ page }) => {
  await page.goto("/listen/classic?sound=off");
  await chooseRegion(page, "Europe");
  await page.getByRole("button", { name: "Share" }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share this listen" });
  const link = dialog.getByTestId("share-listen-url");
  await expect(link).toContainText("region=europe");
  const url = await link.innerText();
  expect(url).toContain("data=temp");
  expect(url).toContain("theme=summer");
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Europe" })).toBeVisible();
});

test("year slider steps from the keyboard and shows Turn sound on", async ({ page }) => {
  await page.goto("/listen/classic?sound=off");
  await expect(page.getByRole("button", { name: "Play timeline" })).toHaveCount(0);
  const yearSlider = page.getByRole("slider", { name: "Map year" }).filter({ visible: true });
  await expect(yearSlider).toHaveValue("2026");
  await expect(yearSlider).toHaveAttribute("aria-valuetext", "SEP 2026");
  const box = await yearSlider.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await yearSlider.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(yearSlider).toHaveValue("2025");

  const turnOn = page.getByRole("button", { name: "Turn sound on" }).filter({ visible: true });
  await expect(turnOn).toBeVisible();
  await expect(liveMain(page).getByText("Click anywhere on the map to hear it")).toHaveCount(0);
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
  const startX = (box?.x ?? 0) + (box?.width ?? 0) * 0.92;
  const endX = (box?.x ?? 0) + (box?.width ?? 0) * ((1988 - 1958) / (2026 - 1958));
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y, { steps: 12 });
  await page.mouse.up();
  const value = Number(await yearSlider.inputValue());
  expect(value).toBeGreaterThan(1970);
  expect(value).toBeLessThan(2010);

  await turnOn.click();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("sonifysphere-sound"))).toBe("on");
  await expect(page.getByRole("button", { name: "Turn sound on" })).toHaveCount(0);
});

test("theme rail stays compact and its collapse tab is 44px", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.goto("/listen/classic?sound=off");
  const panel = page.locator(".listen-theme-panel-open").filter({ visible: true });
  await expect(panel).toBeVisible();
  const rail = await panel.boundingBox();
  expect(rail?.width ?? 0).toBeGreaterThan(180);
  expect(rail?.width ?? 999).toBeLessThanOrEqual(220);
  const size = await liveMain(page)
    .getByText("SEASON", { exact: true })
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(11);

  await page.setViewportSize({ width: 1280, height: 800 });
  const tab = page.getByRole("button", { name: "Collapse theme rail" }).filter({ visible: true });
  const tabBox = await tab.boundingBox();
  expect(tabBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(tabBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await tab.click();
  await expect(page.getByRole("button", { name: "Open theme rail" })).toBeVisible();
});

test("wind sound remains available with reduced motion and calm", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/listen/classic?sound=off");
  await expect(liveMain(page).getByRole("slider", { name: "WIND" })).toHaveValue("28");
  await expect(liveMain(page).getByText("Motion reduced · particles stay still")).toHaveCount(0);
  await page.getByRole("button", { name: "Collapse theme rail" }).click();
  await expect(liveMain(page).getByText("Motion reduced · particles stay still")).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/listen/classic?sound=off");
  const wind = liveMain(page).getByRole("slider", { name: "WIND" });
  await wind.focus();
  await page.keyboard.press("Home");
  await expect(wind).toHaveValue("0");
  await expect(page.locator(".listen-wind-canvas")).toHaveCount(0);
});
