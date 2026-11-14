import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

test("wind remains sound-only and globe hover does not redraw the satellite canvas", async ({ page }) => {
  const windRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/wind")) windRequests.push(request.url());
  });
  await page.addInitScript(() => {
    Object.assign(window, { __mapDraws: 0 });
    for (const method of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"] as const) {
      const original = WebGL2RenderingContext.prototype[method];
      Object.defineProperty(WebGL2RenderingContext.prototype, method, {
        value: function (this: WebGL2RenderingContext, ...args: unknown[]) {
          if (this.canvas instanceof HTMLCanvasElement && this.canvas.classList.contains("maplibregl-canvas")) {
            const probe = window as unknown as { __mapDraws: number };
            probe.__mapDraws += 1;
          }
          return Reflect.apply(original, this, args);
        },
      });
    }
  });
  const tile = new PNG({ width: 256, height: 256 });
  tile.data.fill(80);
  await page.route("https://gibs.earthdata.nasa.gov/**", (route) => route.fulfill({
    contentType: "image/png", body: PNG.sync.write(tile),
  }));
  await page.goto("/listen?sound=off");
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
  const wind = page.getByRole("slider", { name: "WIND", exact: true });
  await wind.focus();
  await wind.press("End");
  await expect(wind).toHaveValue("100");
  await page.waitForTimeout(1500);
  const draws = () => page.evaluate(() => (window as unknown as { __mapDraws: number }).__mapDraws);
  const before = await draws();
  expect(before).toBeGreaterThan(0);
  await page.waitForTimeout(700);
  expect(await draws()).toBe(before);
  for (const [label, id] of [["North America", "north-america"], ["South America", "south-america"]]) {
    const marker = await page.getByRole("button", { name: label, exact: true }).boundingBox();
    expect(marker).not.toBeNull();
    await page.mouse.move(marker!.x + marker!.width / 2, marker!.y + marker!.height + 12);
    const outline = page.locator(`path[data-hover-region="${id}"]`);
    await expect(outline).toHaveAttribute("d", /^M.+L/);
    expect(await draws()).toBe(before);
  }
  await page.mouse.move(450, 70);
  await expect(page.locator("path[data-hover-region]")).toHaveCount(0);
  expect(await draws()).toBe(before);
  expect(windRequests).toEqual([]);
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.getByTestId("region-wind")).toHaveCount(0);
});

test("the cursor sleeps after snapping and wakes on pointer movement", async ({ page }) => {
  await page.goto("/listen?sound=off");
  const temperature = page.getByRole("radio", { name: "TEMPERATURE", exact: true });
  const cursor = page.locator(".target-cursor");
  const corners = cursor.locator(".target-cursor__corner");
  await temperature.hover();
  await expect(cursor).toHaveCSS("opacity", "1");
  await page.waitForTimeout(3000);
  const countFrames = () => page.evaluate(async () => {
    const original = window.requestAnimationFrame;
    let count = 0;
    window.requestAnimationFrame = (callback) => original((time) => {
      count += 1;
      callback(time);
    });
    await new Promise((resolve) => setTimeout(resolve, 600));
    window.requestAnimationFrame = original;
    return count;
  });
  expect(await countFrames()).toBe(0);
  const first = await corners.first().getAttribute("style");
  await page.getByRole("radio", { name: "METHANE", exact: true }).hover();
  await expect.poll(() => corners.first().getAttribute("style")).not.toBe(first);
  await page.waitForTimeout(1000);
  expect(await countFrames()).toBe(0);
  await page.mouse.move(450, 75);
  await page.waitForTimeout(1000);
  expect(await countFrames()).toBe(0);
});

test("cursor springs stay on screen through repeated slow frames", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.requestAnimationFrame;
    // Exercise the cursor's 50ms integration cap without making the test machine stall.
    window.requestAnimationFrame = (callback) => original((time) => callback(time * 4));
  });
  await page.goto("/listen?sound=off");
  await page.getByRole("radio", { name: "TEMPERATURE", exact: true }).hover();
  await page.waitForTimeout(800);
  await page.mouse.move(650, 400);
  await page.waitForTimeout(1500);
  const boxes = await page.locator(".target-cursor__corner").evaluateAll((corners) => corners.map((corner) => {
    const { x, y, width, height } = corner.getBoundingClientRect();
    return { x, y, width, height };
  }));
  expect(boxes).toHaveLength(4);
  for (const box of boxes) {
    expect(box.x).toBeGreaterThan(550);
    expect(box.x).toBeLessThan(750);
    expect(box.y).toBeGreaterThan(300);
    expect(box.y).toBeLessThan(500);
  }
});

test("the loading screen warms Listen assets without starting a map or audio", async ({ page }) => {
  const urls = new Set<string>();
  const errors: string[] = [];
  page.on("request", (request) => urls.add(new URL(request.url()).pathname));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect.poll(() => urls.has("/assets/listen/season-winter.webp")).toBe(true);
  await expect.poll(() => urls.has("/assets/listen/wx-storm.svg")).toBe(true);
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
  expect(page.workers()).toHaveLength(0);
  expect([...urls].some((url) => url.startsWith("/api/wind") || /\.mp3$/.test(url))).toBe(false);
  await expect(page.locator(".preloader")).toHaveCount(0);
  await page.getByRole("link", { name: "Enter without audio", exact: true }).click();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.getByRole("radio", { name: "TEMPERATURE", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
