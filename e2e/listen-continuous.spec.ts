import { expect, test, type Page } from "@playwright/test";

async function output(page: Page, frequency: number, frames = 1) {
  return page.evaluate(async ({ frequency, frames }) => {
    const analysers = (window as Window & { __listenAnalysers?: AnalyserNode[] }).__listenAnalysers ?? [];
    let analyser = analysers[0];
    if (!analyser) throw new Error("No audio output connected");
    const samples = new Float32Array(analyser.fftSize);
    const spectrum = new Float32Array(analyser.frequencyBinCount);
    const rms: number[] = [];
    let high = 0;
    let total = 0;
    for (let frame = 0; frame < frames; frame += 1) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      let peak = 0;
      for (const candidate of analysers) {
        candidate.getFloatTimeDomainData(samples);
        const level = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
        if (level > peak) { peak = level; analyser = candidate; }
      }
      rms.push(peak);
      analyser.getFloatFrequencyData(spectrum);
      spectrum.forEach((db, index) => {
        const energy = 10 ** (db / 10);
        total += energy;
        if (index * analyser.context.sampleRate / analyser.fftSize > frequency * 1.35) high += energy;
      });
    }
    return { rms, highRatio: total > 0 ? high / total : 0, contexts: analysers.map((node) => node.context.state) };
  }, { frequency, frames });
}

test("audio stays continuous and zoom audibly reveals harmonics", async ({ page }) => {
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (this: AudioNode, destination: AudioNode | AudioParam, ...args: number[]) {
      const result = Reflect.apply(connect, this, [destination, ...args]);
      if (this.context instanceof AudioContext && destination === this.context.destination) {
        const analyser = this.context.createAnalyser();
        analyser.fftSize = 4096;
        Reflect.apply(connect, this, [analyser]);
        const monitor = window as Window & { __listenAnalysers?: AnalyserNode[] };
        (monitor.__listenAnalysers ??= []).push(analyser);
      }
      return result;
    } as typeof AudioNode.prototype.connect;
  });
  let missing = false;
  await page.route("**/api/listen/measurements?**", (route) => route.fulfill(missing
    ? { status: 404, json: { error: "No data for this date" } }
    : { json: { value: 18, unit: "°C", source: "Fixture", time: "2026-09-15T12:00:00.000Z" } }));
  await page.route("**/api/listen/eic", (route) => route.fulfill({ json: null }));
  await page.goto("/listen?data=sea-temp&sound=off");
  const stage = page.locator(".lv-stage");
  const box = await stage.boundingBox();
  if (!box) throw new Error("Map missing");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole("region", { name: "Readings at probe" })).toContainText("18.0 °C");
  await page.getByRole("button", { name: "Play sound", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-listen-texture", "continuous");
  const frequency = await page.evaluate(() => Number(document.documentElement.dataset.listenHearing?.split("|")[3]));
  await page.waitForTimeout(700);
  const wide = await output(page, frequency, 50);
  expect(Math.min(...wide.rms), JSON.stringify(wide)).toBeGreaterThan(0.001);
  expect(Math.min(...wide.rms) / Math.max(...wide.rms)).toBeGreaterThan(0.4);
  await stage.focus();
  for (let index = 0; index < 30; index += 1) await page.keyboard.press("+");
  await expect(stage.locator(".lv-map-zoom-readout")).toHaveText("400%");
  await page.waitForTimeout(700);
  const local = await output(page, frequency, 15);
  expect(local.highRatio).toBeGreaterThan(wide.highRatio * 1.5);
  expect(Math.min(...local.rms)).toBeGreaterThan(Math.min(...wide.rms));
  await test.info().attach("audio-evidence.json", {
    body: JSON.stringify({
      wide: { minRms: Math.min(...wide.rms), maxRms: Math.max(...wide.rms), upperHarmonics: wide.highRatio },
      local: { minRms: Math.min(...local.rms), upperHarmonics: local.highRatio },
    }, null, 2),
    contentType: "application/json",
  });
  // Every selected instrument must sustain, including formerly percussive choices.
  for (const name of ["MARIMBA", "WOODBLOCK", "ORCHESTRA"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(1000);
    const sound = await output(page, frequency, 25);
    expect(Math.min(...sound.rms), name).toBeGreaterThan(0.001);
  }
  missing = true;
  await stage.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("html")).not.toHaveAttribute("data-listen-texture");
  await page.waitForTimeout(400);
  const silent = await output(page, frequency, 5);
  expect(Math.max(...silent.rms)).toBeLessThan(0.0001);
  missing = false;
  await stage.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("html")).toHaveAttribute("data-listen-texture", "continuous");
  await page.waitForTimeout(500);
  expect(Math.min(...(await output(page, frequency, 5)).rms)).toBeGreaterThan(0.001);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.waitForTimeout(200);
  expect(Math.max(...(await output(page, frequency, 5)).rms)).toBeLessThan(0.0001);
});
