import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
  { name: "2560", width: 2560, height: 1440 },
  { name: "853x1280", width: 853, height: 1280 },
];

const outDir = resolve(process.cwd(), "screenshots/listen-c1-c4");
mkdirSync(outDir, { recursive: true });

async function run() {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });
  const context = await browser.newContext();

  for (const vp of VIEWPORTS) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    console.log(`Navigating to /listen at ${vp.width}x${vp.height}...`);
    try {
      await page.goto("http://localhost:3000/listen?sound=off", { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(2000);
      const filePath = resolve(outDir, `listen-${vp.name}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`Saved screenshot: ${filePath}`);
    } catch (err) {
      console.error(`Failed at ${vp.name}:`, err.message);
    } finally {
      await page.close();
    }
  }

  // Also capture /about for the new SVS credits
  for (const vp of [{ name: "1440", width: 1440, height: 900 }, { name: "390", width: 390, height: 844 }]) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    try {
      await page.goto("http://localhost:3000/about", { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        const el = document.querySelector(".about-credits");
        if (el) el.scrollIntoView();
      });
      await page.waitForTimeout(1000);
      const filePath = resolve(outDir, `about-credits-${vp.name}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`Saved screenshot: ${filePath}`);
    } catch (err) {
      console.error(`Failed about at ${vp.name}:`, err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log("All screenshots captured successfully.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
