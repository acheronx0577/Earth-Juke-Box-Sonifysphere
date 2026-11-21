import { expect, test } from "@playwright/test";
import { installErrorChecks, liveMain } from "./support";

installErrorChecks();

async function moveToTurn(page: import("@playwright/test").Page) {
  const chart = liveMain(page).getByRole("slider");
  await chart.focus();
  for (let step = 0; step < 6; step += 1) {
    const now = Number(await chart.getAttribute("aria-valuenow"));
    if (now === 3) return;
    await page.keyboard.press(now < 3 ? "ArrowRight" : "ArrowLeft");
  }
  await expect(chart).toHaveAttribute("aria-valuenow", "3");
}

test("waveform ribbons challenge plays audio, tracks points, and resolves rounds", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/challenge/ribbons");

  await expect(liveMain(page).getByRole("heading", { name: "CO₂ Cycle" })).toBeVisible();
  await expect(liveMain(page).getByRole("group", { name: "Pattern 1 of 3" })).toBeVisible();

  const summer = liveMain(page).getByRole("button", { name: "Summer" });
  await summer.click();
  await expect(summer).toHaveAttribute("aria-pressed", "true");
  await expect(summer).toHaveClass(/bg-\[#f2f2f0\]/);

  const info = liveMain(page).getByRole("button", { name: "How this challenge works" });
  await info.click();
  await expect(info).toHaveAttribute("aria-expanded", "true");
  await expect(liveMain(page).getByRole("dialog")).toContainText("Keeling");
  await page.keyboard.press("Escape");
  await expect(info).toHaveAttribute("aria-expanded", "false");

  await moveToTurn(page);
  await expect(liveMain(page).getByRole("slider")).toHaveAttribute("aria-valuetext", /May, turn/i);

  await liveMain(page).getByRole("button", { name: /Hear selected point/ }).click();
  await liveMain(page).getByRole("button", { name: "Check" }).click();
  await expect(liveMain(page).getByRole("status")).toContainText("Yes!");

  await expect(liveMain(page).getByRole("heading", { name: "Sea Ice" })).toBeVisible();
  await expect(liveMain(page).getByRole("group", { name: "Pattern 2 of 3" })).toBeVisible();
  await moveToTurn(page);
  await liveMain(page).getByRole("button", { name: "Check" }).click();
  await expect(liveMain(page).getByRole("status")).toContainText("Correct!");

  await expect(liveMain(page).getByRole("heading", { name: "Ocean Heat" })).toBeVisible();
  await moveToTurn(page);
  await liveMain(page).getByRole("button", { name: "Check" }).click();
  await expect(page.getByTestId("ribbons-result")).toBeVisible();
  await expect(liveMain(page).getByRole("heading", { name: "Harmonics aligned" })).toBeVisible();
  await expect(liveMain(page).getByText("300 PTS")).toBeVisible();
});

test("waveform ribbons renders shared result link", async ({ page }) => {
  await page.goto("/challenge/ribbons?result=v1.3.300");
  await expect(page.getByTestId("ribbons-result")).toBeVisible();
  await expect(liveMain(page).getByRole("heading", { name: "Harmonics aligned" })).toBeVisible();
  await expect(liveMain(page).getByText("300 PTS")).toBeVisible();
});
