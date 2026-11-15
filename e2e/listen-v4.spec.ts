import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { installErrorChecks } from "./support";

installErrorChecks();

test.beforeEach(async ({ page }) => {
  await page.route("**/api/listen/nasa?**", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "PIA12345",
            title: "Test coral reef",
            mediaType: "image",
            preview: "/favicon-32x32.png",
            date: "2020-01-02T00:00:00Z",
            center: "JPL",
            description: "A reef photograph used by the test.",
          },
        ],
        total: 1,
      },
    }),
  );
  await page.route("**/api/listen/nasa/asset?**", (route) =>
    route.fulfill({ json: { image: "/favicon-32x32.png", video: null } }),
  );
});

test("layer chips retarget the sound and the address", async ({ page }) => {
  await page.goto("/listen?sound=off");
  await expect(page.getByRole("button", { name: "TEMPERATURE", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Hear Temperature as").first()).toBeVisible();
  await page.getByRole("button", { name: "SEA ICE", exact: true }).click();
  await expect(page).toHaveURL(/data=sea-ice/);
  await expect(page.getByText("Hear Sea ice as").first()).toBeVisible();
  await expect(page.getByText("SEA ICE COVER")).toBeVisible();
  await expect(page.getByRole("region", { name: "Readings at probe" })).toContainText("EXAMPLE DATA");
});

test("the probe and timeline change the reading", async ({ page }) => {
  await page.goto("/listen?source=map&sound=off");
  const readings = page.getByRole("region", { name: "Readings at probe" });
  await expect(readings).toContainText("0° 145°W");
  await expect(readings).toContainText("+2.84 °C");
  await page.getByRole("group", { name: /Map probe/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(readings).toContainText("143°W");

  const timeline = page.getByRole("slider", { name: "Timeline" });
  await expect(timeline).toHaveAttribute("aria-valuetext", "SEP 2026");
  await timeline.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(timeline).toHaveAttribute("aria-valuenow", "2025");
  await expect(timeline).toHaveAttribute("aria-valuetext", "2025");
  await expect(readings).toContainText("2025");
  await expect(readings).not.toContainText("+2.84 °C");
});

test("volume, tempo, instrument, and play change the heard voice", async ({ page }) => {
  await page.goto("/listen?sound=off");
  const volume = page.getByRole("slider", { name: /VOLUME/ });
  const tempo = page.getByRole("slider", { name: /TEMPO/ });
  await volume.focus();
  await page.keyboard.press("Home");
  await expect(volume).toHaveAttribute("aria-valuenow", "0");
  await expect(volume).toHaveAttribute("aria-valuetext", "0%");
  await page.keyboard.press("End");
  await expect(volume).toHaveAttribute("aria-valuenow", "100");
  await tempo.focus();
  await page.keyboard.press("ArrowUp");
  await expect(tempo).toHaveAttribute("aria-valuenow", "1.1");

  await page.getByRole("button", { name: "MARIMBA", exact: true }).click();
  await expect(page.getByRole("button", { name: "MARIMBA", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Play sound" }).click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.listenHearing ?? "")).toContain("marimba");
  await page.getByRole("button", { name: "ORCHESTRA", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.listenHearing ?? "")).toContain("orchestra");
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByRole("button", { name: "Play sound" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.listenHearing ?? "stopped")).toBe("stopped");
});

test("nasa search and a recent search reopen a source", async ({ page }) => {
  await page.goto("/listen?sound=off");
  await page.getByRole("searchbox", { name: "Search NASA images, videos or a place" }).fill("coral reef");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /Test coral reef/ }).click();
  await expect(page.getByRole("img", { name: "Test coral reef" })).toBeVisible();
  await expect(page.getByText("FROM PIXELS · NOT A MEASUREMENT")).toBeVisible();
  await page.getByRole("button", { name: /ocean currents/ }).click();
  await expect(page.getByRole("region", { name: "NASA search results" })).toBeVisible();
});

test("an image source replaces the metadata legend", async ({ page }) => {
  await page.goto("/listen?sound=off");
  await page.getByRole("button", { name: /OCO-2/ }).click();
  await expect(page.getByRole("img", { name: /OCO-2/ })).toBeVisible();
  await expect(page.getByText("FROM PIXELS · NOT A MEASUREMENT").first()).toBeVisible();
});

test("saving a profile lists it on the phone Saved tab", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/listen?sound=off");
  const history = page.getByRole("button", { name: "HISTORY", exact: true });
  const saved = page.getByRole("button", { name: "SAVED", exact: true });
  await expect(history).not.toHaveAttribute("aria-current", "page");
  await expect(saved).not.toHaveAttribute("aria-current", "page");
  await history.click();
  await expect(history).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(history).not.toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "SOUND PROFILE", exact: true }).click();
  await expect(page.locator("#sound-controls")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "SOUND PROFILE", exact: true })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "SOUND PROFILE", exact: true }).click();
  await page.getByRole("button", { name: "SAVE PROFILE" }).click();
  await saved.click();
  await expect(saved).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Saved profiles" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Hear Temperature as/ })).toBeVisible();
  await expect(page.getByText("not in the Listen v4 frames yet")).toBeVisible();
});

test("reduced motion keeps the volume bars at rest while dragging", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/listen?sound=off");
  const volume = page.getByRole("slider", { name: /VOLUME/ });
  const box = await volume.boundingBox();
  if (!box) throw new Error("Volume slider has no box");
  await page.mouse.move(box.x + 8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, { steps: 4 });
  const tallest = await volume.locator("span").evaluateAll((bars) => Math.max(...bars.map((bar) => bar.getBoundingClientRect().height)));
  await page.mouse.up();
  expect(tallest).toBeLessThanOrEqual(14);
});

test("the listen workspace has no axe violations", async ({ page }) => {
  await page.goto("/listen?sound=off");
  const results = await new AxeBuilder({ page }).include("#main-content").analyze();
  expect(results.violations, results.violations.map((item) => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
});
