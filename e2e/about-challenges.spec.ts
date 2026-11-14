import { expect, test } from "@playwright/test";
import { installErrorChecks, liveMain } from "./support";

installErrorChecks();

const TEAM = ["Richard Huynh", "Erin Sur", "Quoc Pham", "Ryan Wang", "Aqila Nasiry", "Irmuun Temuulel"] as const;

test("about lists the team and sound off stops a voice", async ({ page }) => {
  await page.goto("/about");
  const team = liveMain(page).getByTestId("about-team");
  await expect(team.getByRole("listitem")).toHaveCount(6);
  for (const [index, name] of TEAM.entries()) {
    await expect(team.getByRole("listitem").nth(index)).toContainText(name);
  }
  await expect(team.getByText("Team Owner", { exact: true })).toHaveCount(1);
  await expect(liveMain(page).getByTestId("voice-row")).toHaveCount(3);

  const player = page.locator("aside[aria-label='Persistent mini-player']");
  await page.getByRole("button", { name: "Hear it" }).click();
  await expect(player).toHaveAttribute("data-open", "true");
  await page.getByRole("button", { name: "Close player" }).click();
  await expect(player).toHaveAttribute("data-open", "false");

  const marker = page.getByRole("button", { name: /Press to select/ }).first();
  await marker.click();
  await expect(marker).toHaveAttribute("aria-pressed", "true");
  await expect(player).toHaveAttribute("data-open", "false");

  await page.getByRole("button", { name: "Hear pitch" }).click();
  await expect(liveMain(page).locator("[data-playing='true']")).toHaveCount(1);
  await page.evaluate(() => {
    const root = document.documentElement;
    let ticks = 0;
    const observer = new MutationObserver(() => {
      ticks += 1;
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-sonify-gain"] });
    Object.assign(window, { __gainTicks: () => ticks });
  });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Sound on", exact: true }).click();
  await expect(liveMain(page).locator("[data-playing='true']")).toHaveCount(0);
  await page.waitForTimeout(1500);
  const ticks = await page.evaluate(() => (window as unknown as { __gainTicks?: () => number }).__gainTicks?.() ?? 0);
  expect(ticks).toBeLessThanOrEqual(1);

  await page.evaluate(() => {
    document.documentElement.dataset.aboutMenu = "closed";
    document.querySelector("nav.sonify-nav")?.classList.remove("nav-open");
  });
  for (const id of ["team-h"]) {
    await page.locator(`#${id}`).evaluate((el) => el.scrollIntoView({ block: "start" }));
    await expect.poll(async () =>
      page.evaluate((headingId) => {
        const heading = document.getElementById(headingId);
        const nav = document.querySelector(".sonify-nav");
        if (!heading || !nav) return "missing";
        const style = getComputedStyle(nav);
        if (style.opacity === "0" || style.pointerEvents === "none") return "clear";
        const title = heading.getBoundingClientRect();
        const pill = nav.getBoundingClientRect();
        const hit = pill.bottom > title.top && pill.top < title.bottom && pill.right > title.left && pill.left < title.right;
        return hit ? "covered" : "clear";
      }, id)
    ).toBe("clear");
  }
});

test("the CO2 chart plots only the three published readings", async ({ page }) => {
  await page.goto("/about");
  const chart = liveMain(page).locator(".record");
  await expect(chart).toContainText("315.71");
  await expect(chart).toContainText("432.34");
  await expect(chart).toContainText("426.07");
  await expect(chart).not.toContainText("354");
  await expect(chart).not.toContainText("1990");
});

test("challenge hub explains both games", async ({ page }) => {
  await page.goto("/challenge");
  await expect(page.getByRole("heading", { name: "Guess the Signal" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Compose" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start round 1/ })).toHaveAttribute("href", "/challenge/guess");
  await expect(page.getByRole("link", { name: /Open the board/ })).toHaveAttribute("href", "/challenge/compose");
  await expect(page.locator("aside[aria-label='Persistent mini-player']")).toHaveAttribute("data-open", "false");
});

test("guess explains a miss and reaches the result", async ({ page }) => {
  await page.goto("/play/guess?seed=4");
  await expect(liveMain(page).getByText("Answers unlock after you hear the signal")).toBeVisible();
  await page.getByRole("button", { name: "Hear the signal" }).click();
  await page.keyboard.press("1");
  const reveal = liveMain(page).getByTestId("guess-reveal");
  await expect(reveal).toBeVisible();
  await expect(reveal).toContainText("Why:");
  await expect(reveal).not.toContainText("Hz");
  for (let round = 0; round < 4; round += 1) {
    await page.getByRole("button", { name: "Play next signal" }).click();
    await page.keyboard.press("4");
    await expect(liveMain(page).getByTestId("guess-reveal")).toBeVisible();
  }
  await page.getByRole("button", { name: "See result" }).click();
  await expect(liveMain(page).getByTestId("guess-result")).toContainText("Round by round");
  await expect(page.getByRole("link", { name: "Next: try Compose →" })).toHaveAttribute("href", "/challenge/compose");
});

test("guess refresh and play again keep the same deck", async ({ page }) => {
  await page.goto("/play/guess");
  await expect(liveMain(page).getByTestId("guess-game")).toHaveAttribute("data-ready", "true");
  await expect(page).toHaveURL(/seed=\d+/);
  await page.getByRole("button", { name: "Hear the signal" }).click();
  await page.keyboard.press("2");
  await expect(liveMain(page).getByTestId("guess-reveal")).toBeVisible();
  const choices = (await liveMain(page).getByTestId("guess-choice").allTextContents()).join("|");
  const score = await liveMain(page).locator(".sonify-score b").first().innerText();
  await page.reload();
  await expect(liveMain(page).getByTestId("guess-reveal")).toBeVisible();
  expect((await liveMain(page).getByTestId("guess-choice").allTextContents()).join("|")).toBe(choices);
  await expect(liveMain(page).locator(".sonify-score b").first()).toHaveText(score);

  for (let round = 0; round < 4; round += 1) {
    await page.getByRole("button", { name: "Play next signal" }).click();
    await page.keyboard.press("1");
  }
  await page.getByRole("button", { name: "See result" }).click();
  await page.getByRole("button", { name: "Play again" }).click();
  await page.getByRole("button", { name: "Hear the signal" }).click();
  await page.keyboard.press("1");
  const again = (await liveMain(page).getByTestId("guess-choice").allTextContents()).join("|");
  await page.goto("/challenge");
  await page.getByRole("link", { name: /Resume round/ }).click();
  await expect(liveMain(page).getByTestId("guess-reveal")).toBeVisible();
  expect((await liveMain(page).getByTestId("guess-choice").allTextContents()).join("|")).toBe(again);
});

test("browser Back returns to the same guess round", async ({ page }) => {
  await page.goto("/challenge", { waitUntil: "domcontentloaded" });
  const start = liveMain(page).getByRole("link", { name: /Start round 1/ });
  await expect(start).toBeVisible();
  await start.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const lenis = (window as unknown as { __lenis?: { scroll: number; targetScroll: number } }).__lenis;
    const link = [...document.querySelectorAll("body > #main-content a")].find((anchor) => anchor.textContent?.includes("Start round 1"));
    if (!link) return false;
    const box = link.getBoundingClientRect();
    const settled = !lenis || Math.abs(lenis.scroll - lenis.targetScroll) < 0.5;
    return settled && box.width > 0 && box.top >= 0 && box.bottom <= window.innerHeight;
  });
  await Promise.all([page.waitForURL(/\/challenge\/guess/), start.evaluate((anchor: HTMLAnchorElement) => anchor.click())]);
  await expect(page).toHaveURL(/seed=\d+/);
  const seed = new URL(page.url()).searchParams.get("seed");
  await page.getByRole("button", { name: "Hear the signal" }).click();
  await page.keyboard.press("1");
  await page.getByRole("button", { name: "Play next signal" }).click();
  await expect(liveMain(page).getByText("Round 2 of 5").first()).toBeVisible();
  await page.getByRole("link", { name: "← Challenges" }).click();
  await expect(page.getByRole("link", { name: /Resume round 2/ })).toBeVisible();
  await page.goBack();
  await page.waitForURL(/\/challenge\/guess\?seed=\d+/);
  await expect(liveMain(page).getByText("Round 2 of 5").first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get("seed")).toBe(seed);
});

test("a different guess seed asks before replacing a saved round", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "sonifysphere-guess-run",
      JSON.stringify({
        seed: 4,
        session: 0,
        index: 1,
        phase: "ready",
        score: 0,
        streak: 0,
        best: 0,
        correctCount: 0,
        pickedId: null,
        history: [
          {
            kind: "region",
            answerId: "arctic",
            pickedId: "europe",
            regionId: "arctic",
            layer: "co2",
            season: "spring",
            weather: "clear",
            answerLabel: "Arctic",
            pickedLabel: "Europe",
            correct: false,
          },
        ],
      })
    );
  });
  await page.goto("/challenge/guess?seed=9");
  await page.getByRole("button", { name: "Start this one" }).click();
  await expect(liveMain(page).getByText("Round 1 of 5").first()).toBeVisible();
  await expect(page).toHaveURL(/seed=9$/);

  await page.goto("/challenge/guess");
  await expect(liveMain(page).getByText("Round 2 of 5").first()).toBeVisible();
  await expect(page).toHaveURL(/seed=4$/);
});

test("compose plays a compiled mix and sound off stops it", async ({ page }) => {
  await page.goto("/challenge/compose");
  await expect(liveMain(page).getByTestId("compose-play")).toBeDisabled();
  await page.getByRole("button", { name: "Arctic", exact: true }).click();
  await page.getByRole("button", { name: "Slot 1, empty" }).click();
  await liveMain(page).getByTestId("compose-play").click({ force: true });
  await expect(liveMain(page).getByTestId("compose-board")).toHaveAttribute("data-audio", "idle");

  await liveMain(page).getByTestId("compose-compile").click();
  await liveMain(page).getByTestId("compose-play").click();
  await expect(liveMain(page).getByTestId("compose-board")).toHaveAttribute("data-audio", "playing");
  await expect(liveMain(page).locator(".sonify-slot.is-playing")).toHaveCount(1);

  await page.getByRole("button", { name: "Sound on", exact: true }).click();
  await expect(liveMain(page).getByTestId("compose-board")).toHaveAttribute("data-audio", "idle");
  await expect(liveMain(page).locator(".sonify-slot.is-playing")).toHaveCount(0);

  await page.getByRole("button", { name: "Sound off", exact: true }).click();
  await liveMain(page).getByTestId("compose-play").click();
  await page.getByRole("button", { name: "Share" }).click();
  const share = await page.getByTestId("compose-share-url").inputValue();
  expect(share).toContain("/challenge/compose?mix=");
  await page.goto(share);
  await expect(page.getByRole("button", { name: "Slot 1, Arctic" })).toBeVisible();
});
