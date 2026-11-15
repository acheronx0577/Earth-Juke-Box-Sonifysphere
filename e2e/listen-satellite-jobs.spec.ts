import { expect, test, type Page } from "@playwright/test";

/**
 * Milestone 4: Private background jobs and caching for satellite scenes.
 * Tests UI states: loading (202 polling), success (200 cached/MODIS), and failure states.
 * Upstream hosts are blocked to guarantee zero live leaks.
 */
const BLOCKED = /(?:meteomatics\.com|power\.larc\.nasa\.gov|api\.nasa\.gov|eonet\.gsfc\.nasa\.gov|gibs\.earthdata\.nasa\.gov|planetarycomputer\.microsoft\.com|svs\.gsfc\.nasa\.gov)/i;

function mockCompletedJob(celsius = 28.4, cached = false) {
  return {
    id: "job_test_12345",
    status: "completed",
    progress: 100,
    createdAt: "2026-09-15T12:00:00.000Z",
    completedAt: "2026-09-15T12:00:01.000Z",
    result: {
      sceneId: "MOD11A1.A2026258.h10v05.061",
      collection: "modis-11A1-061",
      date: "2026-09-15",
      time: "12:00:00",
      resolution: "1000m",
      unit: "Kelvin",
      point: {
        lat: 0,
        lon: -145,
        kelvin: celsius + 273.15,
        celsius,
        quality: "measured",
      },
      sceneStats: {
        minKelvin: 295.15,
        maxKelvin: 305.15,
        meanKelvin: 301.55,
        minCelsius: 22,
        maxCelsius: 32,
        meanCelsius: 28.4,
        sampleCount: 5,
      },
      sonification: {
        baseFreqHz: 440,
        harmonicRatio: 1.2,
        tempo: 1.1,
        normalized: 0.784,
      },
      cached,
      source: "Microsoft Planetary Computer · Azure",
      processedAt: "2026-09-15T12:00:01.000Z",
    },
  };
}

test.beforeEach(async ({ page }) => {
  const leaks: string[] = [];
  page.on("request", (request) => {
    if (BLOCKED.test(request.url())) leaks.push(request.url());
  });
  await page.route(BLOCKED, (route) => route.abort("blockedbyclient"));
  (page as Page & { __upstreamLeaks?: string[] }).__upstreamLeaks = leaks;
});

test.afterEach(async ({ page }) => {
  const leaks = (page as Page & { __upstreamLeaks?: string[] }).__upstreamLeaks ?? [];
  expect(leaks, leaks.join("\n")).toEqual([]);
});

test("selecting TEMPERATURE triggers background job and renders Azure reading card", async ({ page }) => {
  await page.route("**/api/listen/pc/jobs", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        json: mockCompletedJob(31.2, false),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/listen?source=map&sound=off");
  await page.getByRole("button", { name: "TEMPERATURE", exact: true }).click();

  const readings = page.getByRole("region", { name: "Readings at probe" });
  await expect(readings).toContainText("31.2 °C");
  await expect(readings).toContainText("Azure");
  await expect(readings).toContainText("MODIS");
});

test("asynchronous 202 job enters polling state and resolves cleanly", async ({ page }) => {
  let polled = false;
  await page.route("**/api/listen/pc/jobs**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 202,
        headers: { "Content-Type": "application/json" },
        json: { id: "job_async_99", status: "queued", progress: 0 },
      });
      return;
    }
    if (url.searchParams.get("id") === "job_async_99") {
      polled = true;
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        json: mockCompletedJob(19.8, true),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/listen?source=map&sound=off");
  await page.getByRole("button", { name: "TEMPERATURE", exact: true }).click();

  const readings = page.getByRole("region", { name: "Readings at probe" });
  await expect(readings).toContainText("19.8 °C");
  await expect(readings).toContainText("Cached");
  await expect(readings).toContainText("Azure");
  expect(polled).toBe(true);
});

test("failed satellite job displays honest no-data message and announces error", async ({ page }) => {
  await page.route("**/api/listen/pc/jobs**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 202,
        headers: { "Content-Type": "application/json" },
        json: { id: "job_fail_1", status: "queued", progress: 0 },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      json: {
        id: "job_fail_1",
        status: "failed",
        error: "Cloud cover obscured satellite scene",
      },
    });
  });

  await page.goto("/listen?source=map&sound=off");
  await page.getByRole("button", { name: "TEMPERATURE", exact: true }).click();

  const readings = page.getByRole("region", { name: "Readings at probe" });
  await expect(readings).toContainText("Cloud cover obscured satellite scene");
  await expect(page.locator("p[aria-live='assertive']")).toContainText("Cloud cover obscured satellite scene");
});
