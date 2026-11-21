import { expect, test } from "@playwright/test";
import { installFinePointer } from "./finePointer";
import { installErrorChecks, liveMain } from "./support";

installErrorChecks();

test.beforeEach(async ({ page }) => {
  await installFinePointer(page);
});

const AUDIO_HOOK = `(() => {
  const contexts = new Set();
  const origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function(dest, ...rest) {
    const result = origConnect.call(this, dest, ...rest);
    try {
      const ctx = this.context;
      if (ctx && dest === ctx.destination) {
        if (!ctx.__qaAnalyser) {
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;
          ctx.__qaAnalyser = analyser;
          contexts.add(ctx);
        }
        origConnect.call(this, ctx.__qaAnalyser);
      }
    } catch (error) {
      window.__qaTapError = String(error);
    }
    return result;
  };
  const Orig = window.AudioContext;
  if (Orig) {
    window.AudioContext = new Proxy(Orig, {
      construct(target, args) {
        const ctx = new target(...args);
        contexts.add(ctx);
        return ctx;
      },
    });
  }
  const sample = () => {
    let peak = 0;
    const rows = [];
    for (const ctx of contexts) {
      let level = 0;
      const analyser = ctx.__qaAnalyser;
      if (analyser) {
        const data = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(data);
        for (let i = 0; i < data.length; i += 1) level = Math.max(level, Math.abs(data[i] - 128));
      }
      peak = Math.max(peak, level);
      rows.push({ state: ctx.state, level });
    }
    window.__qaPeak = Math.max(window.__qaPeak || 0, peak);
    window.__qaRows = rows;
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  window.__qaReset = () => { window.__qaPeak = 0; };
  window.__qaSnap = () => ({ peak: window.__qaPeak || 0, rows: window.__qaRows || [], tapError: window.__qaTapError || "" });
})();`;

function contrastAgainstInk(hexOrRgb: string): number {
  const match = hexOrRgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return 0;
  const fg = [Number(match[1]), Number(match[2]), Number(match[3])];
  const lin = (channel: number) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = (rgb: number[]) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const foreground = lum(fg);
  const background = lum([20, 20, 20]);
  return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
}

test("ribbons secondary text stays at least 4.5:1", async ({ page }) => {
  await page.goto("/challenge/ribbons");
  const month = await page.evaluate(() => {
    const node = [...document.querySelectorAll("#main-content span")].find((item) => item.textContent?.trim() === "NOV");
    return node ? getComputedStyle(node).color : "";
  });
  expect(contrastAgainstInk(month)).toBeGreaterThanOrEqual(4.5);

  await page.goto("/challenge/ribbons?result=v1.3.300");
  const label = await liveMain(page).getByText("CO₂ · MAY").evaluate((node) => getComputedStyle(node).color);
  expect(contrastAgainstInk(label)).toBeGreaterThanOrEqual(4.5);
  const link = await liveMain(page).getByRole("link", { name: "All challenges" }).evaluate((node) => getComputedStyle(node).color);
  expect(contrastAgainstInk(link)).toBeGreaterThanOrEqual(4.5);
});

test("ribbons keeps the system cursor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/challenge/ribbons");
  const main = liveMain(page);
  await page.mouse.move(640, 420, { steps: 12 });
  await page.addStyleTag({ content: "html, html * { cursor: none !important; }" });
  const cursors = await main.evaluate((root) => {
    const read = (el: Element | null) => (el ? getComputedStyle(el).cursor : "missing");
    const play = root.querySelector("[data-testid='ribbons-play']");
    const chart = root.querySelector("[role='slider']");
    return {
      main: read(root),
      heading: read(root.querySelector("h1")),
      play: read(play),
      playLabel: read(play?.querySelector("span") ?? null),
      chart: read(chart),
    };
  });
  expect(cursors.main).not.toBe("none");
  expect(cursors.heading).not.toBe("none");
  expect(cursors.play).toBe("pointer");
  expect(cursors.playLabel).toBe("pointer");
  expect(cursors.chart).toBe("pointer");
  await expect(page.locator(".target-cursor")).toHaveAttribute("data-suppressed", "true");
});

test("ribbons preview runs a Tone context, meters it, and pauses", async ({ page }) => {
  await page.addInitScript(AUDIO_HOOK);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/challenge/ribbons");
  const main = liveMain(page);
  const play = main.getByRole("button", { name: "Hear selected point" });
  await page.evaluate(() => {
    (window as unknown as { __qaReset?: () => void }).__qaReset?.();
  });
  await play.click();
  await expect(main).toHaveAttribute("data-audio", "playing");
  await expect(main).toHaveAttribute("data-tone", "running");
  await expect(main.getByTestId("ribbons-eq")).toHaveAttribute("data-audio", "playing");
  await expect(main.getByRole("button", { name: "Pause selected point" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => Number(await main.getAttribute("data-meter"))).toBeGreaterThan(0);
  const heard = await page.evaluate(() => (window as unknown as { __qaSnap?: () => { peak: number; rows: Array<{ state: string }> } }).__qaSnap?.());
  expect(heard?.peak ?? 0).toBeGreaterThan(0);
  expect(heard?.rows.some((row) => row.state === "running")).toBe(true);

  await main.getByRole("button", { name: "Pause selected point" }).click();
  await expect(main).toHaveAttribute("data-audio", "idle");
  await expect(main.getByRole("button", { name: "Hear selected point" })).toBeVisible();
  await expect(main.getByTestId("ribbons-eq")).toHaveAttribute("data-audio", "idle");
  await expect.poll(async () => Number(await main.getAttribute("data-meter"))).toBe(0);

  const contextsAfterFirst = heard?.rows.length ?? 0;
  const toggle = main.getByTestId("ribbons-play");
  for (let tap = 0; tap < 8; tap += 1) await toggle.click();
  const afterBurst = await page.evaluate(() => (window as unknown as { __qaSnap?: () => { rows: unknown[] } }).__qaSnap?.());
  expect(afterBurst?.rows.length ?? 0).toBeLessThanOrEqual(Math.max(1, contextsAfterFirst));

  if ((await main.getAttribute("data-audio")) === "playing") {
    await main.getByRole("button", { name: "Pause selected point" }).click();
    await expect(main).toHaveAttribute("data-audio", "idle");
  }
  const chart = main.getByRole("slider");
  await chart.focus();
  await page.keyboard.press("ArrowRight");
  await expect(main).toHaveAttribute("data-audio", "playing");
  await expect(main).toHaveAttribute("data-audio", "idle", { timeout: 4000 });
  await expect(main.getByTestId("ribbons-eq")).toHaveAttribute("data-audio", "idle");
});
