import { expect, test, type Page } from "@playwright/test";

const MIX = "96~r.arctic,r.nino34,r.oceania,l.co2,l.sea-ice,r.europe,-,l.methane";

const SIZES: ReadonlyArray<readonly [number, number, string]> = [
  [390, 844, "390"],
  [768, 1024, "768"],
  [1024, 768, "1024"],
  [1366, 768, "1366x768"],
  [1440, 900, "1440"],
  [1920, 1080, "1920"],
  [2560, 1440, "2560"],
  [853, 1280, "853x1280"],
];

async function installAudioProbe(page: Page) {
  await page.addInitScript(() => {
    const target = window as Window & { __audioCtx?: AudioContext; __osc?: number };
    const Original = window.AudioContext;
    window.AudioContext = new Proxy(Original, {
      construct(Context, args) {
        const context = new Context(...args);
        target.__audioCtx = context;
        return context;
      },
    });
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function startProbe(...args) {
      target.__osc = (target.__osc ?? 0) + 1;
      return start.apply(this, args);
    };
  });
}

async function audioState(page: Page) {
  return page.evaluate(() => {
    const target = window as Window & { __audioCtx?: AudioContext; __osc?: number };
    return { state: target.__audioCtx?.state ?? "missing", osc: target.__osc ?? 0 };
  });
}

async function dragMouse(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 16 });
  await page.mouse.up();
}

async function center(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Missing ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

async function curveError(page: Page) {
  return page.evaluate(() => {
    const line = document.querySelector("[data-testid='compose-curve']");
    if (!(line instanceof SVGPathElement)) return 999;
    const ctm = line.getScreenCTM();
    if (!ctm) return 999;
    const total = line.getTotalLength();
    const points: DOMPoint[] = [];
    const steps = 1600;
    for (let index = 0; index <= steps; index += 1) {
      const point = line.getPointAtLength((total * index) / steps);
      points.push(new DOMPoint(point.x, point.y).matrixTransform(ctm));
    }
    let worst = 0;
    for (const bar of document.querySelectorAll("[data-testid='compose-bar']")) {
      const rect = bar.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      const x = rect.left + rect.width / 2;
      let nearest = Number.POSITIVE_INFINITY;
      let y = 0;
      for (const point of points) {
        const distance = Math.abs(point.x - x);
        if (distance < nearest) {
          nearest = distance;
          y = point.y;
        }
      }
      worst = Math.max(worst, Math.abs(y - rect.top));
    }
    return worst;
  });
}

test("mouse drag fills, moves, clears, cancels, and the mix plays", async ({ browser }, testInfo) => {
  testInfo.setTimeout(90_000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: testInfo.outputDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installAudioProbe(page);
  await page.goto("/challenge/compose");
  await expect(page.getByTestId("compose-status")).toHaveText("Drag a sound into a slot.");

  const place = async (name: string, slot: number) => {
    const chip = await center(page, `button[aria-label="${name}"]`);
    const target = await center(page, `[data-slot-index="${slot - 1}"]`);
    await dragMouse(page, chip, { x: target.x, y: target.box.y + 120 });
    await expect(page.getByRole("button", { name: new RegExp(`^Slot ${slot}, ${name}`) })).toBeVisible();
  };

  await place("Arctic", 1);
  await place("Europe", 2);
  await place("Asia", 3);
  await place("CO₂", 4);
  const heard = await audioState(page);
  expect(heard.state).toBe("running");
  expect(heard.osc).toBeGreaterThanOrEqual(4);

  const source = await center(page, '[data-slot-index="1"]');
  const destination = await center(page, '[data-slot-index="5"]');
  await dragMouse(page, { x: source.x, y: source.box.y + 80 }, { x: destination.x, y: destination.box.y + 80 });
  await expect(page.getByRole("button", { name: "Slot 2, empty" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Slot 6, Europe" })).toBeVisible();

  const clearFrom = await center(page, '[data-slot-index="2"]');
  const hint = await center(page, "[data-testid='compose-status']");
  await dragMouse(page, { x: clearFrom.x, y: clearFrom.box.y + 80 }, hint);
  await expect(page.getByRole("button", { name: "Slot 3, empty" })).toBeVisible();

  const before = await page.locator("[data-slot-index]").evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label")));
  const methane = await center(page, 'button[aria-label="Methane"]');
  const title = await center(page, "h1");
  await dragMouse(page, methane, title);
  const after = await page.locator("[data-slot-index]").evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label")));
  expect(after).toEqual(before);

  await page.getByRole("button", { name: "Africa", exact: true }).click();
  await page.getByRole("button", { name: "Slot 3, empty" }).click();
  await expect(page.getByRole("button", { name: "Slot 3, Africa" })).toBeVisible();

  await page.getByRole("button", { name: "Slot 1, Arctic" }).focus();
  await page.keyboard.press("Delete");
  await expect(page.getByRole("button", { name: "Slot 1, empty" })).toBeVisible();

  await page.getByTestId("compose-play").click();
  await expect(page.getByTestId("compose-board")).toHaveAttribute("data-audio", "playing");
  await expect(page.locator(".sonify-slot.is-playing")).toHaveCount(1);
  await expect.poll(async () => (await audioState(page)).state).toBe("running");

  expect(errors).toEqual([]);
  await context.close();
  await page.video()?.saveAs("/opt/cursor/artifacts/compose-drag-1440.webm");
});

test("touch drag at 390 does not steal a vertical flick", async ({ browser }, testInfo) => {
  testInfo.setTimeout(90_000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    recordVideo: { dir: testInfo.outputDir, size: { width: 390, height: 844 } },
  });
  const page = await context.newPage();
  await page.goto("/challenge/compose");
  await expect(page.getByTestId("compose-status")).toHaveText("Drag a sound into a slot.");

  const flick = async (hold: number) => {
    const chip = await page.getByRole("button", { name: "Arctic", exact: true }).boundingBox();
    const slot = await page.getByRole("button", { name: /^Slot 1,/ }).boundingBox();
    if (!chip || !slot) throw new Error("missing drag targets");
    const session = await context.newCDPSession(page);
    const start = { x: chip.x + chip.width / 2, y: chip.y + chip.height / 2 };
    const end = { x: slot.x + slot.width / 2, y: slot.y + 70 };
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 1 }] });
    if (hold) await page.waitForTimeout(hold);
    for (let step = 1; step <= 8; step += 1) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: start.x + ((end.x - start.x) * step) / 8, y: start.y + ((end.y - start.y) * step) / 8, id: 1 }],
      });
      await page.waitForTimeout(20);
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
  };

  await flick(0);
  await expect(page.getByRole("button", { name: "Slot 1, empty" })).toBeVisible();
  await flick(420);
  await expect(page.getByRole("button", { name: "Slot 1, Arctic" })).toBeVisible();

  await context.close();
  await page.video()?.saveAs("/opt/cursor/artifacts/compose-drag-390.webm");
});

test("the curve hits every filled bar and the share sheet keeps the mix", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await context.newPage();
  await page.goto(`/challenge/compose?mix=${encodeURIComponent(MIX)}`);
  await page.getByTestId("compose-curve").waitFor();

  for (const [width, height, name] of SIZES) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => curveError(page), { timeout: 5_000 }).toBeLessThanOrEqual(1);
    const bars = await page.getByTestId("compose-bar").count();
    expect(bars).toBeGreaterThanOrEqual(4);
    await page.screenshot({ path: `/opt/cursor/artifacts/compose-${name}.png` });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId("compose-share").click();
  await expect(page.getByTestId("share-dialog")).toBeVisible();
  await expect(page.getByTestId("share-copy")).toBeFocused();
  await page.screenshot({ path: "/opt/cursor/artifacts/compose-share-1440.png" });

  await page.getByTestId("share-copy").click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  await expect(page.getByTestId("share-url")).toHaveValue(copied);
  expect(copied).toContain("mix=");
  const xHref = await page.getByTestId("share-x").getAttribute("href");
  expect(xHref).toContain("https://x.com/intent/post");
  expect(xHref).toContain(encodeURIComponent(copied));

  await page.evaluate(() => {
    const target = window as Window & { __shared?: ShareData | null };
    target.__shared = null;
    navigator.share = async (data) => {
      target.__shared = data;
    };
  });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("share-dialog")).toHaveCount(0);
  await expect(page.getByTestId("compose-share")).toBeFocused();

  await page.getByTestId("compose-share").click();
  await page.getByTestId("share-native").click();
  const shared = await page.evaluate(() => (window as Window & { __shared?: ShareData | null }).__shared);
  expect(shared?.url).toBe(copied);

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("share-image").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sonifysphere-earth-mixtape.png");

  await page.getByTestId("share-close").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("share-url")).toBeFocused();
  await page.getByTestId("share-url").focus();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByTestId("share-close")).toBeFocused();

  await page.mouse.click(12, 12);
  await expect(page.getByTestId("share-dialog")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("compose-share").click();
  await expect(page.getByTestId("share-dialog")).toBeVisible();
  await page.screenshot({ path: "/opt/cursor/artifacts/compose-share-390.png" });
  await page.keyboard.press("Escape");

  await page.goto(copied);
  await expect(page.getByRole("button", { name: "Slot 1, Arctic" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Slot 2, Niño 3.4 · Pacific" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Slot 7, empty" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Slot 8, METHANE" })).toBeVisible();
  await context.close();
});
