import { expect, test, type Page } from "@playwright/test";
import { installFinePointer } from "./finePointer";

test.beforeEach(async ({ page }) => {
  await installFinePointer(page);
});

type CursorProbe = {
  ok: boolean;
  cursor: string;
  bracketShown: boolean;
  near: boolean;
  suppressed: boolean;
  hideZone: boolean;
  tag: string | null;
};

async function probe(page: Page, x: number, y: number): Promise<CursorProbe> {
  await page.mouse.move(x, y);
  await page.waitForTimeout(360);
  return page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    const cursor = el ? getComputedStyle(el).cursor : "no-element";
    const root = document.querySelector(".target-cursor");
    const dot = document.querySelector(".target-cursor__dot");
    const style = root ? getComputedStyle(root) : null;
    const rect = dot?.getBoundingClientRect();
    const suppressed = root?.getAttribute("data-suppressed") === "true";
    const opacity = style ? Number.parseFloat(style.opacity) : 0;
    const bracketShown = Boolean(
      root &&
        style &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        opacity > 0.35 &&
        !suppressed
    );
    const near = Boolean(rect && Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y) < 28);
    const systemOk = cursor !== "none" && cursor !== "no-element";
    return {
      ok: (bracketShown && near) || systemOk,
      cursor,
      bracketShown,
      near,
      suppressed: Boolean(suppressed),
      hideZone: Boolean(el?.closest("[data-hide-target-cursor]")),
      tag: el?.tagName ?? null,
    };
  }, { x, y });
}

async function expectCursor(page: Page, x: number, y: number) {
  const result = await probe(page, x, y);
  expect(result.ok, JSON.stringify(result)).toBe(true);
  return result;
}

async function expectBox(page: Page, selector: string) {
  const locator = page.locator(selector).first();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const view = page.viewportSize();
  expect(box, selector).toBeTruthy();
  expect(view).toBeTruthy();
  const x = Math.min(view!.width - 8, Math.max(8, box!.x + Math.min(box!.width / 2, 48)));
  const y = Math.min(view!.height - 8, Math.max(8, box!.y + Math.min(box!.height / 2, 36)));
  return expectCursor(page, x, y);
}

test("a pointer stays visible across pages, overlays, drag, and re-entry", async ({ page }) => {
  test.setTimeout(180_000);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/challenge/guess?result=v1.3.5.420.2");
    await expect(page.getByTestId("guess-shared-result")).toBeVisible();
    await expectBox(page, "[data-testid='guess-shared-result']");
    await page.getByRole("button", { name: /share/i }).first().click();
    await expect(page.getByTestId("guess-share-popup")).toBeVisible();
    const backdrop = await expectBox(page, "[data-testid='guess-share-backdrop']");
    expect(backdrop.cursor).not.toBe("none");
    const dialog = await expectBox(page, "[data-testid='guess-share-popup']");
    expect(dialog.cursor).not.toBe("none");
    const close = await expectBox(page, "[aria-label='Close share']");
    expect(close.cursor).not.toBe("none");
    await page.keyboard.press("Escape");
  }

  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/");
  await page.locator(".preloader").waitFor({ state: "detached", timeout: 12_000 }).catch(() => {});
  const home = await expectCursor(page, 720, 420);
  expect(home.bracketShown).toBe(true);
  await expectBox(page, ".sonify-nav a");

  await page.goto("/listen");
  await expect(page.locator(".lv-stage")).toBeVisible();
  const map = await expectBox(page, ".lv-stage");
  expect(map.cursor).not.toBe("none");
  await expectBox(page, ".lv-search, .lv-chip, .lv-card");

  await page.goto("/challenge");
  await expectBox(page, "a[href='/challenge/guess']");

  await page.goto("/challenge/match");
  await expect(page.getByTestId("match-game")).toBeVisible();
  const scope = await expectBox(page, "svg[aria-label='Your wave against the target wave']");
  expect(scope.cursor).not.toBe("none");
  const dial = await expectBox(page, "#tune-freq");
  expect(dial.cursor).not.toBe("none");
  await page.getByRole("button", { name: "Show target zone" }).click();
  await expect(page.getByTestId("tune-freq-zone")).toBeVisible();
  await expectBox(page, "#tune-q");
  await page.locator("#tune-freq").evaluate((el) => {
    const input = el as HTMLInputElement;
    input.value = "260";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#tune-q").evaluate((el) => {
    const input = el as HTMLInputElement;
    input.value = "2.2";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.getByTestId("match-word")).toHaveText("Locked", { timeout: 4000 });
  const locked = await expectBox(page, "#tune-freq");
  expect(locked.cursor).not.toBe("none");
  await page.getByRole("button", { name: "Next anomaly →" }).click();
  await page.getByRole("button", { name: "Skip round" }).click();
  await expect(page.getByTestId("match-word")).toHaveText("Skipped");
  const skipped = await expectBox(page, "#tune-freq");
  expect(skipped.cursor).not.toBe("none");
  await page.goto("/challenge/match?result=v1.900.910.880");
  await expectBox(page, "[data-testid='match-result']");
  await expectBox(page, "[aria-label='Share your result'] button");

  await page.goto("/challenge/ribbons");
  await expectBox(page, "[role='slider']");
  await expectBox(page, "[data-testid='ribbons-play']");
  await page.getByRole("button", { name: /how this challenge works/i }).click();
  await expectBox(page, "#ribbon-info");

  await page.goto("/challenge/compose");
  const chip = page.locator("[aria-label='Sounds'] button").first();
  const slot = page.locator("[data-slot-index]").first();
  await expect(chip).toBeVisible();
  const chipBox = await chip.boundingBox();
  const slotBox = await slot.boundingBox();
  expect(chipBox && slotBox).toBeTruthy();
  await page.mouse.move(chipBox!.x + chipBox!.width / 2, chipBox!.y + chipBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(chipBox!.x + 36, chipBox!.y + chipBox!.height / 2 + 28, { steps: 6 });
  const dragging = await probe(page, chipBox!.x + 36, chipBox!.y + chipBox!.height / 2 + 28);
  expect(dragging.ok, JSON.stringify(dragging)).toBe(true);
  await page.mouse.up();
  await expectBox(page, "input[type='range']");
  await chip.click();
  await slot.click();
  const mixShare = page.getByTestId("compose-share").first();
  await expect(mixShare).toBeEnabled();
  await mixShare.click();
  await expect(page.getByRole("dialog", { name: "Share this mix" })).toBeVisible();
  const mixDialog = await expectBox(page, "[data-testid='share-dialog']");
  expect(mixDialog.cursor).not.toBe("none");
  const mixClose = await expectBox(page, "[data-testid='share-close']");
  expect(mixClose.cursor).not.toBe("none");
  await page.keyboard.press("Escape");

  await page.goto("/about");
  await expectBox(page, "#main-content");
  await page.locator("#credits-h").scrollIntoViewIfNeeded();
  await expectBox(page, "#credits-h");

  await page.goto("/contact");
  await expectBox(page, "a[href^='mailto:']");
  const canvas = page.locator("canvas").first();
  if (await canvas.count()) {
    const box = await canvas.boundingBox();
    if (box) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 30, y + 8, { steps: 4 });
      const held = await probe(page, x + 30, y + 8);
      expect(held.ok, JSON.stringify(held)).toBe(true);
      await page.mouse.up();
    }
  }

  await page.goto("/this-page-does-not-exist");
  await expectBox(page, "h1");
  await expectBox(page, "#main-content a");

  await page.goto("/challenge/ribbons?result=v1.4.400");
  const away = page.getByRole("link", { name: "All challenges" });
  await expect(away).toBeVisible();
  const awayBox = await away.boundingBox();
  expect(awayBox).toBeTruthy();
  const ax = awayBox!.x + awayBox!.width / 2;
  const ay = awayBox!.y + awayBox!.height / 2;
  await page.mouse.click(ax, ay);
  await page.waitForURL(/\/challenge\/?$/);
  await page.waitForTimeout(400);
  const landed = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    const cursor = el ? getComputedStyle(el).cursor : "no-element";
    const root = document.querySelector(".target-cursor");
    const dot = document.querySelector(".target-cursor__dot");
    const style = root ? getComputedStyle(root) : null;
    const rect = dot?.getBoundingClientRect();
    const suppressed = root?.getAttribute("data-suppressed") === "true";
    const opacity = style ? Number.parseFloat(style.opacity) : 0;
    const bracketShown = Boolean(root && style && style.display !== "none" && style.visibility !== "hidden" && opacity > 0.35 && !suppressed);
    const near = Boolean(rect && Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y) < 28);
    return { ok: (bracketShown && near) || (cursor !== "none" && cursor !== "no-element"), cursor, bracketShown, near, suppressed: Boolean(suppressed) };
  }, { x: ax, y: ay });
  expect(landed.ok, JSON.stringify(landed)).toBe(true);

  await page.goto("/about");
  await page.mouse.move(400, 280);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.documentElement.dispatchEvent(new PointerEvent("pointerleave", { clientX: -1, clientY: -1 }));
  });
  await page.waitForTimeout(200);
  const outside = await page.evaluate(() => {
    const el = document.elementFromPoint(400, 280);
    return el ? getComputedStyle(el).cursor : "no-element";
  });
  expect(outside).not.toBe("none");
  const returned = await expectCursor(page, 460, 320);
  expect(returned.bracketShown).toBe(true);
});

test("Guess gameplay, the sources sheet, and its links keep a pointer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/challenge/guess?sound=on");
  await expect(page.getByTestId("guess-game")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("guess-hear").click();
  await expect(page.getByTestId("guess-choice").first()).toHaveAttribute("aria-disabled", "false");
  const choice = await page.getByTestId("guess-choice").first().boundingBox();
  expect(choice).toBeTruthy();
  const playing = await expectCursor(page, choice!.x + 24, choice!.y + 16);
  expect(playing.cursor).not.toBe("none");

  for (let round = 0; round < 5; round += 1) {
    await page.keyboard.press("1");
    const next = page.getByRole("button", { name: "Next signal" });
    if ((await next.count()) === 0) break;
    await next.click();
  }

  await expect(page.getByTestId("guess-result")).toBeVisible();
  await page.getByRole("button", { name: "Sources" }).first().click();
  await expect(page.getByTestId("guess-sources")).toBeVisible();
  const sheet = await expectBox(page, "[data-testid='guess-sources']");
  expect(sheet.cursor).not.toBe("none");
  const link = page.getByTestId("guess-sources").locator("a").first();
  if (await link.count()) {
    const linked = await expectBox(page, "[data-testid='guess-sources'] a");
    expect(linked.cursor).not.toBe("none");
  }
});
