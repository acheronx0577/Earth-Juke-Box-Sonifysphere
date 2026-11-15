import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
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

const outDir = resolve(process.cwd(), "screenshots/m4-satellite-jobs");
mkdirSync(outDir, { recursive: true });

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return true;
    } catch {
      // Retry
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

async function main() {
  const port = 3123;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Starting Next.js server on port ${port}...`);

  const server = spawn("npx", ["next", "start", "-p", String(port)], {
    shell: true,
    stdio: "pipe",
    env: { ...process.env, PORT: String(port) },
  });

  try {
    const ready = await waitForServer(`${baseUrl}/listen`);
    if (!ready) {
      throw new Error(`Server failed to respond on ${baseUrl} within 30s`);
    }
    console.log(`Server is ready on ${baseUrl}`);

    const browser = await chromium.launch({
      channel: "msedge",
      headless: true,
    });
    const context = await browser.newContext();

    for (const vp of VIEWPORTS) {
      const page = await context.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Mock the satellite job route to provide clean M4 reading
      await page.route("**/api/listen/pc/jobs**", async (route) => {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          json: {
            id: "job_m4_demo",
            status: "completed",
            progress: 100,
            result: {
              sceneId: "MOD11A1.A2026258.h10v05.061",
              collection: "modis-11A1-061",
              date: "2026-09-15",
              time: "12:00:00",
              resolution: "1000m",
              unit: "Kelvin",
              point: { lat: 0, lon: -145, kelvin: 301.55, celsius: 28.4, quality: "measured" },
              sceneStats: { minKelvin: 295, maxKelvin: 305, meanKelvin: 301.55, minCelsius: 22, maxCelsius: 32, meanCelsius: 28.4, sampleCount: 5 },
              sonification: { baseFreqHz: 440, harmonicRatio: 1.2, tempo: 1.1, normalized: 0.784 },
              cached: true,
              source: "Microsoft Planetary Computer · Azure",
              processedAt: new Date().toISOString(),
            },
          },
        });
      });

      console.log(`Capturing /listen with Temperature layer at ${vp.name} (${vp.width}x${vp.height})...`);
      await page.goto(`${baseUrl}/listen?source=map&data=temperature&sound=off`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(1000);

      const filePath = resolve(outDir, `listen-temperature-${vp.name}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`  -> Saved: ${filePath}`);
      await page.close();
    }

    await browser.close();
    console.log("All Milestone 4 viewports captured cleanly!");
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
