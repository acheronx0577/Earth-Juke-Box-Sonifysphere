import { expect, test, type Page } from "@playwright/test";
import { liveMain } from "./support";

async function openGuess(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
    const Orig = window.AudioContext;
    const Wrapped = function AudioContextWrap(this: AudioContext, ...args: ConstructorParameters<typeof AudioContext>) {
      const ctx = new Orig(...args);
      const bucket = window as Window & { __audioCtx?: AudioContext };
      bucket.__audioCtx = ctx;
      return ctx;
    };
    Wrapped.prototype = Orig.prototype;
    window.AudioContext = Wrapped as unknown as typeof AudioContext;
  });
  await page.goto("/challenge/guess?seed=4");
  await expect(liveMain(page).getByTestId("guess-game")).toHaveAttribute("data-ready", "true");
}

test("the guess page keeps the system cursor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuess(page);
  const main = liveMain(page);
  await page.mouse.move(720, 420);
  await page.addStyleTag({ content: "html, html * { cursor: none !important; }" });
  const cursors = await main.evaluate((root) => {
    const read = (el: Element | null) => (el ? getComputedStyle(el).cursor : "missing");
    const play = root.querySelector("[data-testid='guess-play']");
    return {
      main: read(root),
      heading: read(root.querySelector("h1")),
      play: read(play),
      playLabel: read(play?.querySelector("span") ?? null),
      choice: read(root.querySelector("[data-testid='guess-choice']")),
    };
  });
  expect(cursors.main).not.toBe("none");
  expect(cursors.heading).not.toBe("none");
  expect(cursors.play).toBe("pointer");
  expect(cursors.playLabel).toBe("pointer");
  expect(cursors.choice).toBe("default");
});

test("play toggles to pause and the indicator animates", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGuess(page);
  const main = liveMain(page);
  const play = main.getByRole("button", { name: "Play clue" });
  const progress = main.getByRole("progressbar", { name: "Clue progress" });
  const bar = main.getByTestId("guess-meter").locator("span").first();
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await play.click();
  const pause = main.getByRole("button", { name: "Pause clue" });
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => bar.evaluate((el) => getComputedStyle(el).animationName)).not.toBe("none");
  await expect.poll(async () => page.evaluate(() => (window as Window & { __audioCtx?: AudioContext }).__audioCtx?.state ?? "missing")).toBe("running");
  await expect.poll(async () => Number(await progress.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
  await pause.click();
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => bar.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  const mid = Number(await progress.getAttribute("aria-valuenow"));
  expect(mid).toBeGreaterThan(0);
  expect(mid).toBeLessThan(100);
  await page.waitForTimeout(400);
  expect(Number(await progress.getAttribute("aria-valuenow"))).toBe(mid);
  await play.focus();
  await page.keyboard.press("Enter");
  await expect(main.getByRole("button", { name: "Pause clue" })).toBeFocused();
});

test("the indicator stops when the clue ends", async ({ page }) => {
  await openGuess(page);
  const main = liveMain(page);
  await main.getByRole("button", { name: "Play clue" }).click();
  await expect(main.getByRole("button", { name: "Pause clue" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Play clue" })).toBeVisible({ timeout: 4_000 });
  await expect(main.getByRole("progressbar", { name: "Clue progress" })).toHaveAttribute("aria-valuenow", "100");
  const animation = await main.getByTestId("guess-meter").locator("span").first().evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).toBe("none");
});

test("reduced motion keeps the playing indicator still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openGuess(page);
  const main = liveMain(page);
  await main.getByRole("button", { name: "Play clue" }).click();
  const bar = main.getByTestId("guess-meter").locator("span").first();
  await expect(main.getByRole("button", { name: "Pause clue" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => bar.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});

test("the transport fits narrow and short screens", async ({ page }) => {
  for (const size of [
    { width: 390, height: 844 },
    { width: 853, height: 1280 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(size);
    await openGuess(page);
    const transport = liveMain(page).getByTestId("guess-transport");
    await expect(transport.getByRole("button", { name: "Play clue" })).toBeVisible();
    const overflow = await transport.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, `${size.width}x${size.height}`).toBeLessThanOrEqual(1);
  }
});
