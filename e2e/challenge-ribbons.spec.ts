import { expect, test } from "@playwright/test";
import { installErrorChecks, liveMain } from "./support";

installErrorChecks();

test("waveform ribbons challenge plays audio, tracks points, and resolves rounds", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/challenge/ribbons");

  // Verify page title and header
  await expect(liveMain(page).getByRole("heading", { name: "Atmospheric CO₂ Cycle" })).toBeVisible();
  await expect(liveMain(page).getByText("Pattern 1 of 3")).toBeVisible();

  // Switch season context
  const summerBtn = liveMain(page).getByRole("button", { name: "Summer" });
  await summerBtn.click();
  await expect(summerBtn).toHaveClass(/bg-\[#c8fa8b\]/);
  await expect(liveMain(page).getByText("Summer Context")).toBeVisible();

  // Test slider adjustment
  const slider = liveMain(page).getByRole("slider");
  await slider.fill("3"); // Point 4 (0-indexed 3, turning point)
  await expect(liveMain(page).getByText("Point 4 of 7")).toBeVisible();
  await expect(liveMain(page).getByText("Turning Point")).toBeVisible();

  // Test Hear selected point
  await liveMain(page).getByRole("button", { name: /Hear selected point/ }).click();

  // Test Check answer
  await liveMain(page).getByRole("button", { name: "Check my answer" }).click();
  await expect(liveMain(page).getByRole("status")).toContainText("Yes!");

  // Advance to pattern 2
  await liveMain(page).getByRole("button", { name: "Next Pattern →" }).click();
  await expect(liveMain(page).getByRole("heading", { name: "Arctic Sea Ice Extent Cycle" })).toBeVisible();
  await expect(liveMain(page).getByText("Pattern 2 of 3")).toBeVisible();

  // Answer pattern 2 correctly
  await slider.fill("3");
  await liveMain(page).getByRole("button", { name: "Check my answer" }).click();
  await expect(liveMain(page).getByRole("status")).toContainText("Correct!");

  // Advance to pattern 3
  await liveMain(page).getByRole("button", { name: "Next Pattern →" }).click();
  await expect(liveMain(page).getByRole("heading", { name: "Global Upper Ocean Heat Cycle" })).toBeVisible();

  // Answer pattern 3 correctly
  await slider.fill("3");
  await liveMain(page).getByRole("button", { name: "Check my answer" }).click();
  await expect(liveMain(page).getByRole("status")).toContainText("Spot on!");

  // See final result
  await liveMain(page).getByRole("button", { name: "See Result ↗" }).click();
  await expect(page.getByTestId("ribbons-result")).toBeVisible();
  await expect(liveMain(page).getByRole("heading", { name: "Seasonal Harmonics Aligned" })).toBeVisible();
  await expect(liveMain(page).getByText("300 PTS")).toBeVisible();
});

test("waveform ribbons renders shared result link", async ({ page }) => {
  await page.goto("/challenge/ribbons?result=v1.3.300");
  await expect(page.getByTestId("ribbons-result")).toBeVisible();
  await expect(liveMain(page).getByRole("heading", { name: "Waveform Ribbons Shared Score" })).toBeVisible();
  await expect(liveMain(page).getByText("300 PTS")).toBeVisible();
});
