import { expect, test } from "@playwright/test";
import { installFinePointer } from "./finePointer";
import { installErrorChecks, liveMain } from "./support";

installErrorChecks();

test.beforeEach(async ({ page }) => {
  await installFinePointer(page);
});

test("compose keeps the system cursor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/challenge/compose");
  const main = liveMain(page);
  await page.mouse.move(720, 420, { steps: 12 });
  await page.addStyleTag({ content: "html, html * { cursor: none !important; }" });
  const cursors = await main.evaluate((root) => {
    const read = (el: Element | null) => (el ? getComputedStyle(el).cursor : "missing");
    const play = root.querySelector("[data-testid='compose-play']");
    const slot = root.querySelector("[data-testid='compose-slots'] button");
    return {
      main: read(root),
      heading: read(root.querySelector("h1")),
      play: read(play),
      playLabel: read(play?.querySelector("span") ?? null),
      slot: read(slot),
      slotLabel: read(slot?.querySelector("span") ?? null),
    };
  });
  expect(cursors.main).not.toBe("none");
  expect(cursors.heading).not.toBe("none");
  expect(cursors.play).toBe("default");
  expect(cursors.playLabel).toBe("default");
  expect(cursors.slot).toBe("pointer");
  expect(cursors.slotLabel).toBe("pointer");
  await expect(page.locator(".target-cursor")).toHaveAttribute("data-suppressed", "true");
});

test("compose names the playing mix and runs the tone context", async ({ page }) => {
  await page.addInitScript(() => {
    const Orig = window.AudioContext;
    window.AudioContext = new Proxy(Orig, {
      construct(target, args) {
        const ctx = new target(...args);
        (window as Window & { __audioCtx?: AudioContext }).__audioCtx = ctx;
        return ctx;
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/challenge/compose");
  const main = liveMain(page);
  await main.getByRole("button", { name: "Arctic", exact: true }).click();
  await main.getByRole("button", { name: "Slot 1, empty" }).click();
  await main.getByTestId("compose-play").click();
  await expect(main.getByTestId("compose-board")).toHaveAttribute("data-audio", "playing");
  await expect(main.getByTestId("compose-status")).toHaveText("Playing the mix.");
  await expect(main.locator(".sonify-slot.is-playing")).toHaveCount(1);
  const placeHere = await page.evaluate(() => [...document.querySelectorAll("span")].some((node) => node.textContent?.trim() === "Place here"));
  expect(placeHere).toBe(false);
  await expect.poll(async () => page.evaluate(() => (window as Window & { __audioCtx?: AudioContext }).__audioCtx?.state ?? "missing")).toBe("running");
  await main.getByTestId("compose-stop").click();
  await expect(main.getByTestId("compose-board")).toHaveAttribute("data-audio", "idle");
  await expect(main.getByRole("heading", { name: "Earth mixtape" })).toBeVisible();
  await expect(main.locator(".sonify-slot.is-playing")).toHaveCount(0);
});
