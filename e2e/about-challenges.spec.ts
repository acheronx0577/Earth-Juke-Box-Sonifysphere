import { expect, test } from "@playwright/test";
import { installErrorChecks, liveMain } from "./support";

installErrorChecks();

const TEAM = [
  ["Richard Huynh", "Team Leader"],
  ["Erin Sur", "Visual & UI Design"],
  ["Quoc Pham", "Audio Architect"],
  ["Ryan Wang", "Frontend Engineer"],
  ["Aqila Nasiry", "Atmospheric Research"],
  ["Irmuun Temuulel", "Systems Engineer"],
] as const;

test("about lists the team and sound off stops a voice", async ({ page }) => {
  await page.goto("/about");
  const cards = liveMain(page).locator(".team .card");
  await expect(cards).toHaveCount(6);
  for (const [index, [name, role]] of TEAM.entries()) {
    await expect(cards.nth(index).getByRole("heading", { level: 3 })).toHaveText(name);
    await expect(cards.nth(index).locator(".card-content p")).toHaveText(role);
  }
  await expect(liveMain(page).getByText("Team Leader", { exact: true })).toHaveCount(1);
  await expect(liveMain(page).getByRole("heading", { name: "Three Voices", exact: true })).toBeAttached();
  await expect(liveMain(page).getByText("Pitch tracks CO₂ ppm, pulse tracks seasonal breathing, clicks mark all-time highs.")).toBeAttached();

  const player = page.locator("aside[aria-label='Persistent mini-player']");
  const live = () => page.evaluate(() => document.documentElement.dataset.sonifyLive ?? "");
  await page.getByRole("button", { name: "Hear it" }).click();
  await expect(page.getByRole("button", { name: "Playing" })).toBeVisible();
  await expect(player).toHaveAttribute("data-open", "true");
  await expect.poll(live).toBe("1");
  await page.getByRole("button", { name: "Close player" }).click();
  await expect(player).toHaveAttribute("data-open", "false");
  await expect(page.getByRole("button", { name: "Hear it" })).toBeVisible();
  await expect.poll(live).toBe("");

  const marker = page.getByRole("button", { name: /Press to select/ }).first();
  await marker.click();
  await expect(marker).toHaveAttribute("aria-pressed", "true");
  await expect(player).toHaveAttribute("data-open", "false");

  await page.getByRole("button", { name: "Hear it" }).click();
  await expect(page.getByRole("button", { name: "Playing" })).toBeVisible();
  await page.getByRole("button", { name: "Mute audio" }).click();
  await expect(page.getByRole("button", { name: "Hear it" })).toBeVisible();
  await expect(player).toHaveAttribute("data-open", "false");
  await expect.poll(live).toBe("");

  const heading = liveMain(page).getByRole("heading", { name: "Crew Registry" });
  await heading.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect.poll(async () =>
    page.evaluate(() => {
      const title = document.querySelector(".team-heading")?.getBoundingClientRect();
      const nav = document.querySelector(".sonify-nav");
      if (!title || !nav) return "missing";
      const style = getComputedStyle(nav);
      if (style.opacity === "0" || style.pointerEvents === "none") return "clear";
      const pill = nav.getBoundingClientRect();
      const hit = pill.bottom > title.top && pill.top < title.bottom && pill.right > title.left && pill.left < title.right;
      return hit ? "covered" : "clear";
    })
  ).toBe("clear");
});

test("the About page no longer renders the Mauna Loa record chart", async ({ page }) => {
  await page.goto("/about");
  await expect(page.locator(".record")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Record as music/i })).toHaveCount(0);
});

test("challenge carousel offers the three games", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/challenge");
  const gallery = liveMain(page).locator(".circular-gallery");
  await expect(gallery).toBeVisible();
  await expect(liveMain(page).getByRole("link", { name: "Play Guess the Signal" })).toHaveAttribute("href", "/challenge/guess");
  for (const name of ["Tune the Signal", "Waveform Ribbons"]) {
    await expect(gallery.getByRole("button", { name: new RegExp(name), includeHidden: true })).toHaveCount(1);
  }
  await expect(gallery.getByRole("button", { name: /Compose Track|Climate Console/, includeHidden: true })).toHaveCount(0);
  await expect(page.getByText(/Challenges · 3 games/i)).toBeVisible();
  await expect(page.locator("aside[aria-label='Persistent mini-player']")).toHaveAttribute("data-open", "false");
});

test("guess explains a miss and reaches the result", async ({ page }) => {
  await page.goto("/play/guess?seed=4");
  await expect(liveMain(page).getByRole("button", { name: /locked/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Hear signal" }).click();
  await page.keyboard.press("1");
  const reveal = liveMain(page).getByTestId("guess-reveal");
  await expect(reveal).toBeVisible();
  await expect(reveal).not.toContainText("Hz");
  for (let round = 0; round < 4; round += 1) {
    await page.getByRole("button", { name: "Next signal" }).click();
    await page.keyboard.press("4");
    await expect(liveMain(page).getByTestId("guess-reveal")).toBeVisible();
  }
  await page.getByRole("button", { name: "Next signal" }).click();
  await expect(liveMain(page).getByTestId("guess-result")).toContainText("named");
  await expect(page.getByRole("link", { name: "Next · Compose" })).toHaveAttribute("href", "/challenge/compose");
});

test("guess refresh and play again keep the same deck", async ({ page }) => {
  await page.goto("/play/guess");
  await expect(liveMain(page).getByTestId("guess-game")).toHaveAttribute("data-ready", "true");
  await expect(page).toHaveURL(/seed=\d+/);
  await page.getByRole("button", { name: "Hear signal" }).click();
  await page.keyboard.press("2");
  await expect(liveMain(page).getByTestId("guess-reveal")).toBeVisible();
  const choices = (await liveMain(page).getByTestId("guess-choice").allTextContents()).join("|");
  const score = await liveMain(page).locator(".sonify-score b").first().innerText();
  await page.reload();
  await expect(liveMain(page).getByTestId("guess-reveal")).toBeVisible();
  expect((await liveMain(page).getByTestId("guess-choice").allTextContents()).join("|")).toBe(choices);
  await expect(liveMain(page).locator(".sonify-score b").first()).toHaveText(score);

  for (let round = 0; round < 4; round += 1) {
    await page.getByRole("button", { name: "Next signal" }).click();
    await page.keyboard.press("1");
  }
  await page.getByRole("button", { name: "Next signal" }).click();
  await page.getByRole("button", { name: "Play again" }).click();
  await page.getByRole("button", { name: "Hear signal" }).click();
  await page.keyboard.press("1");
  const again = (await liveMain(page).getByTestId("guess-choice").allTextContents()).join("|");
  await page.goto("/challenge/guess");
  await expect(liveMain(page).getByTestId("guess-reveal")).toBeVisible();
  expect((await liveMain(page).getByTestId("guess-choice").allTextContents()).join("|")).toBe(again);
});

test("browser Back returns to the same guess round", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/challenge", { waitUntil: "domcontentloaded" });
  const start = liveMain(page).getByRole("link", { name: "Play Guess the Signal" });
  await expect(start).toBeVisible();
  await Promise.all([page.waitForURL(/\/challenge\/guess/), start.click()]);
  await expect(page).toHaveURL(/seed=\d+/);
  const seed = new URL(page.url()).searchParams.get("seed");
  await page.getByRole("button", { name: "Hear signal" }).click();
  await page.keyboard.press("1");
  await page.getByRole("button", { name: "Next signal" }).click();
  await expect(liveMain(page).getByRole("group", { name: "Round 2 of 5" })).toBeVisible();
  await page.getByRole("link", { name: "Challenges", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/challenge$/);
  await page.goBack();
  await page.waitForURL(/\/challenge\/guess\?seed=\d+/);
  await expect(liveMain(page).getByRole("group", { name: "Round 2 of 5" })).toBeVisible();
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
  await expect(liveMain(page).getByRole("group", { name: "Round 1 of 5" })).toBeVisible();
  await expect(page).toHaveURL(/seed=9$/);

  await page.goto("/challenge/guess");
  await expect(liveMain(page).getByRole("group", { name: "Round 2 of 5" })).toBeVisible();
  await expect(page).toHaveURL(/seed=4$/);
});

test("compose plays a compiled mix and sound off stops it", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".preloader")).toHaveCount(0);
  await page.getByRole("button", { name: "Sound on", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sound off", exact: true })).toHaveAttribute("aria-pressed", "false");

  await page.goto("/challenge/compose");
  await expect(liveMain(page).getByTestId("compose-play")).toBeDisabled();
  await page.getByRole("button", { name: "Arctic", exact: true }).click();
  await page.getByRole("button", { name: "Slot 1, empty" }).click();
  await liveMain(page).getByTestId("compose-play").click();
  await expect(liveMain(page).getByText("Sound is off.")).toBeVisible();
  await expect(liveMain(page).getByTestId("compose-board")).toHaveAttribute("data-audio", "idle");
  await expect(liveMain(page).locator(".sonify-slot.is-playing")).toHaveCount(0);

  await page.getByRole("button", { name: "Turn sound on" }).click();
  await expect(liveMain(page).getByTestId("compose-board")).toHaveAttribute("data-audio", "playing");
  await expect(liveMain(page).locator(".sonify-slot.is-playing")).toHaveCount(1);
  await liveMain(page).getByTestId("compose-stop").click();
  await expect(liveMain(page).getByTestId("compose-board")).toHaveAttribute("data-audio", "idle");
  await expect(liveMain(page).locator(".sonify-slot.is-playing")).toHaveCount(0);

  await liveMain(page).getByTestId("compose-play").click();
  await page.getByRole("button", { name: "Share link" }).click();
  await expect(page).toHaveURL(/\/challenge\/compose\?mix=/);
  const share = page.url();
  expect(share).toContain("/challenge/compose?mix=");
  await page.goto(share);
  await expect(page.getByRole("button", { name: "Slot 1, Arctic" })).toBeVisible();
});
