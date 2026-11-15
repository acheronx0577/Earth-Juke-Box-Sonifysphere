import { expect, test } from "@playwright/test";

test("wheel zoom changes proximity without changing the data pitch", async ({ page }) => {
  await page.route("**/api/listen/measurements?**", (route) => route.fulfill({
    json: { value: 18, unit: "°C", source: "Fixture", time: "2026-09-15T12:00:00.000Z" },
  }));
  await page.route("**/api/listen/eic", (route) => route.fulfill({ json: null }));
  await page.goto("/listen?data=sea-temp&sound=off");
  const stage = page.locator(".lv-stage");
  const box = await stage.boundingBox();
  if (!box) throw new Error("Map is missing");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole("region", { name: "Readings at probe" })).toContainText("18.0 °C");
  await page.getByRole("button", { name: "Play sound", exact: true }).click();
  const sound = () => page.evaluate(() => (document.documentElement.dataset.listenHearing ?? "").split("|"));
  await expect.poll(async () => (await sound()).length).toBe(12);
  const wide = await sound();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let index = 0; index < 6; index += 1) {
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(80);
  }
  await expect.poll(async () => Number((await sound())[10])).toBeGreaterThan(0.3);
  const local = await sound();
  expect(local[3]).toBe(wide[3]);
  expect(Number(local[11])).toBeGreaterThan(Number(wide[11]));
  expect(Math.abs(Number(local[9]))).toBeLessThan(0.05);
  await stage.locator(".lv-map-zoom-readout").click();
  await expect.poll(async () => Number((await sound())[10])).toBe(0);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect.poll(async () => (await sound()).length).toBe(1);
});
