import { expect, test } from "@playwright/test";
import { installErrorChecks, liveMain } from "./support";

installErrorChecks();

test("phone menu navigation clears the grid and skips the repeat Home intro", async ({ page }) => {
  await page.goto("/listen?sound=off");
  await page.getByRole("button", { name: "Toggle mobile menu" }).click();
  await page.getByRole("navigation").getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator(".sonify-page-transition")).toBeHidden();
  await page.getByRole("button", { name: "Toggle mobile menu" }).click();
  await page.getByRole("navigation").getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".sonify-page-transition")).toBeHidden();
  await expect(page.locator(".preloader")).toHaveCount(0);
});

test("phone menu sound toggle stops the about hero", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("button", { name: "Hear it" }).click();
  await expect(page.getByRole("button", { name: "Playing" })).toBeVisible();
  const player = page.locator("aside[aria-label='Persistent mini-player']");
  await expect(player).toHaveAttribute("data-open", "true");
  await page.getByRole("button", { name: "Mute audio" }).click();
  await expect(page.getByRole("button", { name: "Playing" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hear it" })).toBeVisible();
  await expect(player).toHaveAttribute("data-open", "false");
});

test("phone theme sheet leads with the year slider", async ({ page }) => {
  await page.goto("/listen/classic?sound=off");
  await page.getByRole("button", { name: "Open theme controls" }).click();
  const year = liveMain(page).getByText("YEAR", { exact: true });
  await expect(year).toBeVisible();
  const box = await year.boundingBox();
  expect((box?.y ?? 900) + (box?.height ?? 0)).toBeLessThan(430);
  const slider = liveMain(page).getByRole("slider", { name: "Map year" });
  await slider.fill("2000");
  await expect(slider).toHaveValue("2000");
});

test("phone place card Turn sound on accepts a tap", async ({ page }) => {
  await page.goto("/listen/classic?sound=off");
  const europe = page.getByRole("button", { name: "Europe", exact: true }).filter({ visible: true });
  await europe.evaluate((el: HTMLButtonElement) => el.click());
  await page.getByRole("button", { name: "Hear it" }).filter({ visible: true }).click();
  const turnOn = page.getByRole("button", { name: "Turn sound on" }).filter({ visible: true });
  await expect(turnOn).toBeVisible();
  const box = await turnOn.boundingBox();
  if (!box) throw new Error("Turn sound on has no box");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("sonifysphere-sound"))).toBe("on");
  await expect(page.getByRole("button", { name: "Turn sound on" })).toHaveCount(0);
});
