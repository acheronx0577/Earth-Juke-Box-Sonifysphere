import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { writeFileSync } from "node:fs";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto("http://127.0.0.1:3456/listen?sound=off", { waitUntil: "networkidle" });
const glow = page.locator("[data-disc-cx]");
await glow.waitFor({ state: "attached", timeout: 30_000 });
await page.waitForTimeout(1500);
const metrics = await page.evaluate(() => {
  const el = document.querySelector("[data-disc-cx]");
  if (!el) return null;
  const host = el.parentElement?.getBoundingClientRect();
  if (!host) return null;
  return {
    cx: Number(el.dataset.discCx),
    cy: Number(el.dataset.discCy),
    radius: Number(el.dataset.discWidth) / 2,
    hostX: host.x,
    hostY: host.y,
  };
});
if (!metrics || !metrics.radius) throw new Error("globe disc was not measured");
const shot = await page.screenshot({ type: "png" });
await browser.close();

const source = PNG.sync.read(shot);
const scale = 2;
const centerX = Math.round((metrics.hostX + metrics.cx) * scale);
const centerY = Math.round((metrics.hostY + metrics.cy) * scale);
const radius = metrics.radius * scale;
const margin = radius * 0.16;
const size = Math.round((radius + margin) * 2);
const originX = Math.round(centerX - size / 2);
const originY = Math.round(centerY - size / 2);
const out = new PNG({ width: size, height: size });
for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const srcX = originX + x;
    const srcY = originY + y;
    const dest = (y * size + x) * 4;
    const dx = x - size / 2;
    const dy = y - size / 2;
    const distance = Math.hypot(dx, dy);
    const edge = radius + margin * 0.55;
    const fade = Math.max(0, Math.min(1, (edge - distance) / 8));
    if (srcX < 0 || srcY < 0 || srcX >= source.width || srcY >= source.height || fade <= 0) {
      out.data[dest + 3] = 0;
      continue;
    }
    const src = (srcY * source.width + srcX) * 4;
    out.data[dest] = source.data[src];
    out.data[dest + 1] = source.data[src + 1];
    out.data[dest + 2] = source.data[src + 2];
    out.data[dest + 3] = Math.round(source.data[src + 3] * fade);
  }
}
writeFileSync("public/assets/about/globe-listen.png", PNG.sync.write(out));
console.log(`wrote globe ${size}px from disc r=${Math.round(metrics.radius)}`);
