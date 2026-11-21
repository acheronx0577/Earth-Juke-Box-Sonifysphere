import { expect, test } from "@playwright/test";
import { installErrorChecks, liveMain } from "./support";

installErrorChecks();

const NAMES = ["Richard Huynh", "Erin Sur", "Quoc Pham", "Ryan Wang", "Aqila Nasiry", "Irmuun Temuulel"] as const;

test("contact lists six members and arrow keys move the active one", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/contact");
  const stage = liveMain(page);
  await expect(stage).toHaveAttribute("data-motion", "reduced");
  const rows = stage.getByRole("list", { name: "Team" }).getByRole("button");
  await expect(rows).toHaveCount(6);
  for (const name of NAMES) {
    await expect(rows.filter({ hasText: name })).toHaveCount(1);
  }
  await expect(stage).toHaveAttribute("data-active", "2");
  await expect(rows.nth(2)).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowDown");
  await expect(stage).toHaveAttribute("data-active", "3");
  await expect(rows.nth(3)).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowUp");
  await expect(stage).toHaveAttribute("data-active", "2");
  await rows.nth(5).focus();
  await expect(stage).toHaveAttribute("data-active", "5");
  await expect(stage.getByText("AI-GENERATED IMAGE")).toBeAttached();
  await expect(stage.getByText("PLACEHOLDER · project email")).toBeVisible();
  await expect(page.locator(".sonify-nav a[href='/contact']")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Contact", exact: true })).toHaveAttribute("href", "/contact");
});

test("contact stays on the resting member when motion is reduced", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/contact");
  const stage = liveMain(page);
  await expect(stage).toHaveAttribute("data-active", "2");
  await page.waitForTimeout(400);
  await expect(stage).toHaveAttribute("data-active", "2");
  await expect(stage).toHaveAttribute("data-motion", "reduced");
});
