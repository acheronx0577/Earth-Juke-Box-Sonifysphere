import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Appendix B end-to-end checks. Every upstream host is blocked. Fixtures are
 * invented readings and contain no provider credentials.
 */
const BLOCKED = /(?:meteomatics\.com|power\.larc\.nasa\.gov|api\.nasa\.gov|eonet\.gsfc\.nasa\.gov|gibs\.earthdata\.nasa\.gov|planetarycomputer\.microsoft\.com|svs\.gsfc\.nasa\.gov)/i;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function powerReading(value: number) {
  return {
    layer: "air-temp",
    value,
    unit: "°C",
    time: "2026-09-15T12:00:00.000Z",
    source: "POWER",
    resolution: "daily",
  };
}

async function reach(page: Page, locator: Locator) {
  const target = locator.first();
  await expect(target).toBeVisible();
  for (let step = 0; step < 60; step += 1) {
    const focused = await target.evaluate((element) => element === document.activeElement);
    if (focused) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Tab did not reach the control");
}

async function selectAir(page: Page) {
  const more = page.getByRole("button", { name: "MORE +", exact: true });
  await expect(more).toBeVisible();
  const air = page.getByRole("button", { name: "AIR", exact: true });
  if (await air.isVisible()) {
    await air.click();
    return;
  }
  await more.click();
  try {
    await expect(air).toBeVisible({ timeout: 1500 });
  } catch {
    await more.click();
  }
  await air.click();
}

test.beforeEach(async ({ page }) => {
  const leaks: string[] = [];
  page.on("request", (request) => {
    if (BLOCKED.test(request.url())) leaks.push(request.url());
  });
  await page.route(BLOCKED, (route) => route.abort("blockedbyclient"));
  await page.route("**/api/listen/measurements?**", (route) => route.fulfill({ json: powerReading(12.4) }));
  (page as Page & { __upstreamLeaks?: string[] }).__upstreamLeaks = leaks;
});

test.afterEach(async ({ page }) => {
  const leaks = (page as Page & { __upstreamLeaks?: string[] }).__upstreamLeaks ?? [];
  expect(leaks, leaks.join("\n")).toEqual([]);
});

test("switching to an image drops the previous POWER reading", async ({ page }) => {
  await page.route("**/api/listen/measurements?**", (route) => route.fulfill({ json: powerReading(12.5) }));
  await page.goto("/listen?sound=off");
  await selectAir(page);
  const readings = page.getByRole("region", { name: "Readings at probe" });
  await expect(readings).toContainText("12.5 °C");
  await expect(readings).toContainText("POWER");
  await expect(readings).toContainText("15 Sep 2026 12:00 UTC");
  await page.getByRole("button", { name: /OCO-2/ }).click();
  await expect(page.getByRole("img", { name: /OCO-2/ })).toBeVisible();
  await expect(readings).not.toContainText("12.5");
  await expect(readings).not.toContainText("POWER");
  await expect(readings).toContainText("FROM PIXELS · NOT A MEASUREMENT");
});

test("a slower reading cannot replace the newest request", async ({ page }) => {
  await page.route("**/api/listen/measurements?**", async (route) => {
    const lon = new URL(route.request().url()).searchParams.get("lon");
    if (lon === "-145.0000") {
      await page.waitForTimeout(1200);
      try {
        await route.fulfill({ json: powerReading(1) });
      } catch {
        // The browser aborted the superseded request.
      }
      return;
    }
    await route.fulfill({ json: powerReading(40) });
  });
  await page.goto("/listen?sound=off");
  await selectAir(page);
  await page.waitForRequest((request) => request.url().includes("lon=-145.0000"));
  await page.getByRole("group", { name: /Map probe/ }).focus();
  await page.keyboard.press("ArrowRight");
  const readings = page.getByRole("region", { name: "Readings at probe" });
  await expect(readings).toContainText("40.0 °C");
  await expect(readings).not.toContainText("1.0 °C");
  await page.waitForTimeout(1500);
  await expect(readings).toContainText("40.0 °C");
  await expect(readings).not.toContainText("1.0 °C");
});

test("a different air value changes the played frequency", async ({ page }) => {
  let value = -50;
  await page.route("**/api/listen/measurements?**", (route) => route.fulfill({ json: powerReading(value) }));
  await page.goto("/listen?sound=off");
  await selectAir(page);
  await expect(page.getByRole("region", { name: "Readings at probe" })).toContainText("-50.0 °C");
  await page.getByRole("button", { name: "Play sound" }).click();
  const frequency = () => page.evaluate(() => Number((document.documentElement.dataset.listenHearing ?? "").split("|")[3]));
  await expect.poll(frequency).toBe(196);
  value = 50;
  await page.getByRole("group", { name: /Map probe/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("region", { name: "Readings at probe" })).toContainText("50.0 °C");
  await expect.poll(frequency).toBe(516);
});

test("the probe shows the exact UTC instant and an honest no-data state", async ({ page }) => {
  await page.goto("/listen?sound=off");
  const readings = page.getByRole("region", { name: "Readings at probe" });
  await expect(readings).toContainText("15 Sep 2026 12:00 UTC");
  const timeline = page.getByRole("slider", { name: "Timeline" });
  await timeline.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(readings).toContainText("15 Sep 2025 12:00 UTC");

  await page.route("**/api/listen/measurements?**", (route) =>
    route.fulfill({ status: 404, json: { error: "No reading for this place and time." } }),
  );
  await selectAir(page);
  await expect(readings).toContainText("No data for this date");
  await expect(readings).toContainText("15 Sep 2025 12:00 UTC");
  await expect(page.locator("[aria-live='polite']").filter({ hasText: "No data for this date" })).toContainText("No data for this date");
  await expect(page.locator("p[aria-live='assertive']")).toHaveText("");
});

test("a POWER reading is labeled POWER", async ({ page }) => {
  await page.goto("/listen?sound=off");
  await selectAir(page);
  const readings = page.getByRole("region", { name: "Readings at probe" });
  await expect(readings).toContainText("12.4 °C");
  await expect(readings).toContainText("POWER");
  await expect(readings).toContainText("15 Sep 2026 12:00 UTC");
});

for (const [status, message] of [
  [429, "Too many requests, try again in a minute"],
  [502, "The data service could not be reached"],
  [503, "This data source is not set up yet"],
] as const) {
  test(`measurement ${status} shows ${message} and announces it`, async ({ page }) => {
    await page.route("**/api/listen/measurements?**", (route) => route.fulfill({ status, json: { error: message } }));
    await page.goto("/listen?sound=off");
    await selectAir(page);
    const readings = page.getByRole("region", { name: "Readings at probe" });
    await expect(readings).toContainText(message);
    await expect(page.locator("p[aria-live='assertive']")).toContainText(message);
    await expect(readings).not.toContainText("12.4");
  });
}

test("keyboard operates Listen, Guess, Tune, and Ribbons", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/challenge");
  const ribbons = page.getByRole("link", { name: /Listen to the map|Listen to sonifications/ }).locator("visible=true");
  await reach(page, ribbons);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/listen/);
  const probe = page.getByRole("group", { name: /Map probe/ });
  await reach(page, probe);
  await page.keyboard.press("ArrowRight");
  await expect(probe).toHaveAttribute("aria-label", /143°W/);

  await page.goto("/challenge/guess?seed=4");
  await expect(page.getByTestId("guess-game")).toHaveAttribute("data-ready", "true");
  await reach(page, page.getByRole("button", { name: "Hear the signal" }));
  await page.keyboard.press("Enter");
  await page.keyboard.press("1");
  await expect(page.getByTestId("guess-reveal")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Round 2 of 5").first()).toBeVisible();

  await page.goto("/challenge/match");
  const frequency = page.getByRole("slider").first();
  await reach(page, frequency);
  await expect(frequency).toHaveValue("250");
  await page.keyboard.press("ArrowRight");
  await expect(frequency).toHaveValue("255");
  await expect(page.getByText("255 Hz")).toBeVisible();
  await reach(page, page.getByRole("button", { name: /Listen to Target Sound/ }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /Playing Target/ })).toBeVisible();
});

test("EPIC, events, and the colour map render mocked data and pass axe", async ({ page }) => {
  await page.route(/\/api\/listen\/epic/, (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("dates")) {
      return route.fulfill({ json: { dates: ["2024-11-14", "2024-11-15"], cached: true } });
    }
    return route.fulfill({
      json: {
        date: "2024-11-15",
        quality: "image-derived",
        cached: true,
        attribution: "NASA EPIC (DSCOVR)",
        frames: [
          {
            id: "epic_test_frame",
            caption: "Test whole-Earth frame",
            time: "2024-11-15T00:36:49.000Z",
            centroid: { lat: 1.25, lon: -20.5 },
            image: "/favicon-32x32.png",
          },
        ],
      },
    });
  });
  await page.goto("/listen/epic");
  await expect(page.getByRole("heading", { name: "Whole-Earth frames" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Test whole-Earth frame/ })).toBeVisible();
  await expect(page.getByText("image-derived", { exact: true })).toBeVisible();
  await expect(page.locator("[aria-live='polite']")).toContainText("Image-derived, not a measurement.");
  let results = await new AxeBuilder({ page }).include("#main-content").analyze();
  expect(results.violations, results.violations.map((item) => item.id).join("\n")).toEqual([]);

  await page.route(/\/api\/listen\/events/, (route) =>
    route.fulfill({
      json: {
        cached: true,
        events: [
          {
            id: "EONET_TEST",
            title: "Test wildfire",
            category: "wildfires",
            categoryTitle: "Wildfires",
            open: true,
            magnitude: null,
            magnitudeUnit: null,
            time: "2024-11-15T00:00:00.000Z",
            lat: 34.1,
            lon: -118.2,
            link: "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_TEST",
          },
        ],
      },
    }),
  );
  await page.goto("/listen/events");
  await expect(page.getByRole("heading", { name: "Test wildfire" })).toBeVisible();
  await expect(page.locator("[aria-live='polite']")).toContainText("1 open event");
  results = await new AxeBuilder({ page }).include("#main-content").analyze();
  expect(results.violations, results.violations.map((item) => item.id).join("\n")).toEqual([]);

  await page.route(/\/api\/listen\/gibs-colormap/, (route) => {
    if (route.request().url().includes("/tile")) {
      return route.fulfill({ contentType: "image/png", body: PNG });
    }
    return route.fulfill({
      json: { value: 290.5, unit: "K", range: "290–291 K", r: 180, g: 40, b: 20 },
    });
  });
  await page.goto("/listen/colormap");
  await page.getByRole("button", { name: "Read center pixel" }).click();
  const derived = page.getByRole("region", { name: "Image-derived reading" });
  await expect(derived).toContainText("290.5 K");
  await expect(derived).toContainText("image-derived");
  await expect(page.locator("[aria-live='polite']")).toContainText("290.5 K");
  results = await new AxeBuilder({ page }).include("#main-content").analyze();
  expect(results.violations, results.violations.map((item) => item.id).join("\n")).toEqual([]);
});

test("EPIC, events, and the colour map announce upstream errors", async ({ page }) => {
  await page.route(/\/api\/listen\/epic/, (route) =>
    route.fulfill({ status: 502, json: { error: "The data service could not be reached" } }),
  );
  await page.goto("/listen/epic");
  await expect(page.locator("main").getByRole("alert")).toHaveText("The data service could not be reached");

  await page.route(/\/api\/listen\/events/, (route) =>
    route.fulfill({ status: 502, json: { error: "The data service could not be reached" } }),
  );
  await page.goto("/listen/events");
  await expect(page.locator("main").getByRole("alert")).toHaveText("The data service could not be reached");

  await page.route(/\/api\/listen\/gibs-colormap/, (route) => {
    if (route.request().url().includes("/tile")) return route.fulfill({ contentType: "image/png", body: PNG });
    return route.fulfill({ status: 404, json: { error: "No reading for this place and time" } });
  });
  await page.goto("/listen/colormap");
  await page.getByRole("button", { name: "Read center pixel" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("No reading for this place and time");
});
