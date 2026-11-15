import { expect, test } from "@playwright/test";
import { installErrorChecks } from "./support";

installErrorChecks();

test("sea temperature readings drive the same pitch shown in the Audio Key", async ({ page }) => {
  await page.route("**/api/listen/measurements?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("layer") !== "sea-temp") {
      await route.fulfill({ status: 404, json: { error: "No matched reading." } });
      return;
    }
    await route.fulfill({
      json: {
        layer: "sea-temp",
        value: 18,
        unit: "°C",
        source: "Meteomatics",
        time: "2026-09-15T12:00:00.000Z",
      },
    });
  });

  await page.goto("/listen?data=sea-temp&sound=off");
  const readings = page.getByRole("region", { name: "Readings at probe" });
  await expect(page.getByRole("button", { name: "SEA TEMP", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(readings).toContainText("18.0 °C");
  await expect(readings).toContainText("Meteomatics · 15 Sep 2026 12:00 UTC");

  await page.getByText("Audio Key", { exact: true }).click();
  await expect(page.locator(".lv-audio-key-body")).toContainText("196 Hz");
  await expect(page.locator(".lv-audio-key-body")).toContainText("Current sound:");

  await page.getByRole("button", { name: "Play sound" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.listenHearing ?? "")).toMatch(/\|\d+\|/);
});

test("missing sea temperature data stays silent", async ({ page }) => {
  await page.route("**/api/listen/measurements?**", (route) =>
    route.fulfill({ json: { value: null, error: "No matched reading." } }),
  );

  await page.goto("/listen?data=sea-temp&sound=off");
  const readings = page.getByRole("region", { name: "Readings at probe" });
  await expect(readings).toContainText("No matched reading.");
  await page.getByText("Audio Key", { exact: true }).click();
  await expect(page.locator(".lv-audio-key-body")).toContainText("Current sound: Silent · no matched data.");

  await page.getByRole("button", { name: "Play sound" }).click();
  await expect(page.locator(".lv-status")).toContainText("No matched data at this point");
  await expect(page.getByRole("button", { name: "Stop" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.listenHearing ?? "stopped")).toBe("stopped");
});
