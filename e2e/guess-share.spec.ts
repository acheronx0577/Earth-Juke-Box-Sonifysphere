import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { installFinePointer } from "./finePointer";

const TOKEN = "v1.3.5.420.2";
const SHARED = `/challenge/guess?result=${TOKEN}`;
const TITLE = "3 of 5 named";
const SCORE = "420 PTS · BEST STREAK 2";

const OWN_TOKEN = "v1.4.5.880.4";
const OWN_TITLE = "4 of 5 named";
const OWN_SCORE = "880 PTS · BEST STREAK 4";

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

function visible(locator: Locator) {
  return locator.locator("visible=true");
}

async function clickMouse(page: Page, target: Locator) {
  const box = await target.boundingBox();
  if (!box || box.width < 1 || box.height < 1) throw new Error("control is not on screen");
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.click(x, y);
}

async function expectImageCarries(page: Page, file: string, title: string, scoreLine: string, token: string) {
  const bytes = await readFile(file);
  const png = PNG.sync.read(bytes);
  expect(png.width).toBe(1200);
  expect(png.height).toBe(1760);
  const scored = await page.evaluate(
    async ({ b64, title, scoreLine, token }) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const actual = canvas.getContext("2d");
      if (!actual) return null;
      actual.drawImage(bitmap, 0, 0);
      const pixels = actual.getImageData(0, 0, canvas.width, canvas.height);

      const mismatch = (text: string, font: string, x: number, y: number) => {
        const layer = document.createElement("canvas");
        layer.width = canvas.width;
        layer.height = canvas.height;
        const pen = layer.getContext("2d");
        if (!pen) return 1;
        pen.font = font;
        pen.fillStyle = "#ffffff";
        pen.textBaseline = "alphabetic";
        pen.fillText(text, x, y);
        const painted = pen.getImageData(0, 0, layer.width, layer.height);
        let diff = 0;
        let ink = 0;
        for (let i = 0; i < painted.data.length; i += 4) {
          if (painted.data[i + 3] < 180) continue;
          ink += 1;
          const sum = pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2];
          if (sum < 280) diff += 1;
        }
        return ink === 0 ? 1 : diff / ink;
      };

      const url = `${location.origin}/challenge/guess?result=`;
      return {
        title: mismatch(title, "560 64px sans-serif", 72, 240),
        score: mismatch(scoreLine, "600 28px ui-monospace, monospace", 72, 290),
        url: mismatch(`${url}${token}`, "500 20px ui-monospace, monospace", 72, canvas.height - 120),
        zeroTitle: mismatch("0 of 0 named", "560 64px sans-serif", 72, 240),
        zeroScore: mismatch("0 PTS · BEST STREAK 0", "600 28px ui-monospace, monospace", 72, 290),
        zeroUrl: mismatch(`${url}v1.0.0.0.0`, "500 20px ui-monospace, monospace", 72, canvas.height - 120),
      };
    },
    { b64: bytes.toString("base64"), title, scoreLine, token },
  );
  expect(scored, "result image could not be read").not.toBeNull();
  expect(scored?.title, JSON.stringify(scored)).toBeLessThan(0.02);
  expect(scored?.score, JSON.stringify(scored)).toBeLessThan(0.02);
  expect(scored?.url, JSON.stringify(scored)).toBeLessThan(0.02);
  expect(scored!.score).toBeLessThan(scored!.zeroScore);
  expect(scored!.title).toBeLessThan(scored!.zeroTitle);
  expect(scored!.url).toBeLessThan(scored!.zeroUrl);
}

async function openShared(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto(SHARED);
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  await expect(page.getByTestId("guess-shared-result")).toContainText("420");
  await expect(page.getByTestId("guess-shared-result")).toContainText(/best streak 2/i);
  await clickMouse(page, page.getByRole("button", { name: "Share" }));
  await expect(page.getByTestId("guess-share-popup")).toBeVisible();
  const preview = page.getByTestId("guess-share-preview");
  await expect(preview).toContainText(TITLE);
  await expect(preview).toContainText(SCORE);
  await expect(preview).not.toContainText("0 of 0");
  await expect(preview).not.toContainText("BEST STREAK 0");
  await expect(preview.locator("li")).toHaveCount(0);
  await expect(visible(page.getByTestId("guess-share-url"))).toContainText(`result=${TOKEN}`);
}

test("a shared guess result shares that same result", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  await installFinePointer(page);
  await openShared(page, { width: 1440, height: 900 });

  await page.mouse.move(720, 420);
  const cursors = await page.evaluate(() => {
    const read = (selector: string) => {
      const node = document.querySelector(selector);
      return node ? getComputedStyle(node).cursor : "missing";
    };
    const copy = [...document.querySelectorAll("button")].find(
      (node) => node.textContent?.includes("Copy link") && node.getClientRects().length > 0,
    );
    return {
      dialog: read("[data-testid='guess-share-popup']"),
      copy: copy ? getComputedStyle(copy).cursor : "missing",
      share: read("[data-testid='guess-shared-result'] button"),
    };
  });
  expect(cursors.dialog).not.toBe("none");
  expect(cursors.copy).toBe("pointer");
  expect(cursors.share).not.toBe("none");

  const xHref = await page.getByRole("link", { name: "Share to X" }).getAttribute("href");
  const shown = (await visible(page.getByTestId("guess-share-url")).innerText()).trim();
  expect(xHref).toBe(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${TITLE}. ${SCORE} ${shown}`)}`);
  expect(shown).toContain(`result=${TOKEN}`);

  for (const [width, height, name] of SIZES) {
    await page.setViewportSize({ width, height });
    await expect(page.getByTestId("guess-share-preview")).toContainText(TITLE);
    await expect(page.getByTestId("guess-share-preview")).toContainText(SCORE);
    await expect(visible(page.getByTestId("guess-share-url"))).toContainText(`result=${TOKEN}`);
    await page.screenshot({ path: `/opt/cursor/artifacts/guess-share-dialog-${name}.png` });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await clickMouse(page, visible(page.getByRole("button", { name: "Copy link" })));
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(shown);
  expect(copied).toContain(`result=${TOKEN}`);
  expect(copied).not.toContain("result=v1.0.0.0.0");

  const downloadPromise = page.waitForEvent("download");
  await clickMouse(page, page.getByRole("button", { name: "Save image" }));
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sonifysphere-guess-result.png");
  const imagePath = "/tmp/guess-share-shared.png";
  await download.saveAs(imagePath);
  await expectImageCarries(page, imagePath, TITLE, SCORE, TOKEN);

  await page.goto(copied);
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  await expect(page.getByTestId("guess-shared-result")).toContainText("420");
  await expect(page.getByTestId("guess-shared-result")).toContainText(/best streak 2/i);

  await page.setViewportSize({ width: 390, height: 844 });
  await openShared(page, { width: 390, height: 844 });
  const phoneUrl = (await visible(page.getByTestId("guess-share-url")).innerText()).trim();
  const phoneX = await page.getByRole("link", { name: "Share to X" }).getAttribute("href");
  expect(phoneX).toBe(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${TITLE}. ${SCORE} ${phoneUrl}`)}`);
  await clickMouse(page, visible(page.getByRole("button", { name: "Copy link" })));
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(phoneUrl);
  const phoneDownload = page.waitForEvent("download");
  await clickMouse(page, page.getByRole("button", { name: "Save image" }));
  const phoneFile = await phoneDownload;
  const phoneImage = "/tmp/guess-share-shared-390.png";
  await phoneFile.saveAs(phoneImage);
  await expectImageCarries(page, phoneImage, TITLE, SCORE, TOKEN);
  await page.goto(phoneUrl);
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  await expect(page.getByTestId("guess-shared-result")).toContainText(/best streak 2/i);

  await context.close();
});

test("an owned guess run still shares its own result", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  await installFinePointer(page);
  await page.addInitScript(() => {
    const regions = ["arctic", "europe", "asia", "africa", "pacific"];
    const history = regions.map((regionId, index) => ({
      kind: "region",
      answerId: regionId,
      pickedId: index === 4 ? "europe" : regionId,
      regionId,
      layer: "temperature",
      season: "summer",
      weather: "clear",
      answerLabel: regionId,
      pickedLabel: index === 4 ? "europe" : regionId,
      correct: index < 4,
    }));
    sessionStorage.setItem(
      "sonifysphere-guess-run",
      JSON.stringify({
        seed: 11,
        session: 0,
        index: 5,
        phase: "result",
        score: 880,
        streak: 4,
        best: 4,
        correctCount: 4,
        pickedId: null,
        history,
      }),
    );
  });
  await page.goto("/challenge/guess");
  await expect(page.getByTestId("guess-result")).toBeVisible();
  await expect(page.getByTestId("guess-result")).toContainText("880");
  await expect(page.getByTestId("guess-result")).toContainText(/best streak 4/i);

  await clickMouse(page, page.getByRole("button", { name: "Share" }));
  await expect(page.getByTestId("guess-share-popup")).toBeVisible();
  await expect(page.getByTestId("guess-share-preview")).toContainText(OWN_TITLE);
  await expect(page.getByTestId("guess-share-preview")).toContainText(OWN_SCORE);
  await expect(page.getByTestId("guess-share-preview")).not.toContainText(TITLE);
  await expect(page.getByTestId("guess-share-preview")).not.toContainText("420 PTS");
  const marks = page.getByTestId("guess-share-preview").locator("li");
  await expect(marks).toHaveCount(5);
  await expect(marks.nth(0)).toHaveAttribute("data-correct", "true");
  await expect(marks.nth(3)).toHaveAttribute("data-correct", "true");
  await expect(marks.nth(4)).toHaveAttribute("data-correct", "false");

  const shown = (await visible(page.getByTestId("guess-share-url")).innerText()).trim();
  expect(shown).toContain(`result=${OWN_TOKEN}`);
  expect(shown).not.toContain(`result=${TOKEN}`);
  const xHref = await page.getByRole("link", { name: "Share to X" }).getAttribute("href");
  expect(xHref).toBe(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${OWN_TITLE}. ${OWN_SCORE} ${shown}`)}`);

  await clickMouse(page, visible(page.getByRole("button", { name: "Copy link" })));
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(shown);

  const downloadPromise = page.waitForEvent("download");
  await clickMouse(page, page.getByRole("button", { name: "Save image" }));
  const download = await downloadPromise;
  const imagePath = "/tmp/guess-share-own.png";
  await download.saveAs(imagePath);
  await expectImageCarries(page, imagePath, OWN_TITLE, OWN_SCORE, OWN_TOKEN);

  await page.goto(shown);
  await expect(page.getByRole("heading", { name: OWN_TITLE })).toBeVisible();
  await expect(page.getByTestId("guess-shared-result")).toContainText("880");
  await expect(page.getByTestId("guess-shared-result")).toContainText(/best streak 4/i);

  await context.close();
});
