import { expect, test, type Page } from "@playwright/test";
import { installErrorChecks, liveMain } from "./support";

installErrorChecks();

async function moveTo(page: Page, index: number) {
  const chart = liveMain(page).getByRole("slider");
  await chart.focus();
  for (let step = 0; step < 8; step += 1) {
    const now = Number(await chart.getAttribute("aria-valuenow"));
    if (now === index) return;
    await page.keyboard.press(now < index ? "ArrowRight" : "ArrowLeft");
  }
  await expect(chart).toHaveAttribute("aria-valuenow", String(index));
}

test("waveform ribbons scores seasons, shows feedback, and opens the scorecard", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/challenge/ribbons");
  const main = liveMain(page);

  await expect(main.getByRole("heading", { name: "CO₂ Cycle" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "CO₂ Cycle" })).toHaveText("CO₂ Cycle");
  await expect(main.getByText("Challenge 03 · Waveform Ribbons")).toBeVisible();
  await expect(main.getByText("Round 1/3")).toBeVisible();
  await expect(main.getByRole("group", { name: "Round 1 of 3" })).toBeVisible();

  const infoBox = await main.getByRole("button", { name: "How this challenge works" }).boundingBox();
  expect(infoBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(infoBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  const summer = main.getByRole("button", { name: "Summer" });
  await summer.click();
  await expect(summer).toHaveAttribute("aria-pressed", "true");
  await expect(summer).toHaveCSS("background-color", "rgb(242, 242, 240)");
  await expect(main.locator("[data-season-span]").first()).toBeVisible();

  const feedback = main.getByTestId("ribbons-feedback");
  await main.getByRole("button", { name: "Check" }).click();
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText("not where it turns");
  await expect(feedback).not.toContainText("point 4");

  const info = main.getByRole("button", { name: "How this challenge works" });
  await info.click();
  await expect(main.getByRole("dialog")).not.toContainText("Keeling");
  await expect(main.getByRole("dialog")).not.toContainText("September minimum");
  await page.keyboard.press("Escape");

  const spring = main.getByRole("button", { name: "Spring" });
  await spring.click();
  await expect(summer).toHaveAttribute("aria-pressed", "false");

  await moveTo(page, 3);
  await expect(main.getByRole("slider")).toHaveAttribute("aria-valuetext", /May, level/i);
  await expect(main.getByRole("slider")).not.toHaveAttribute("aria-valuetext", /turn/i);

  await main.getByRole("button", { name: /Play the curve/ }).click();
  await expect(feedback).toContainText("Playing");
  await expect(main.getByTestId("ribbons-eq")).toHaveAttribute("data-audio", "playing");
  await main.getByTestId("ribbons-check").click();
  await expect(feedback).toContainText("spring");
  await expect(feedback).toContainText("May");
  await expect(main.getByRole("heading", { name: "CO₂ Cycle" })).toBeVisible();

  await info.click();
  await expect(main.getByRole("dialog")).toContainText("Keeling");
  await page.keyboard.press("Escape");

  await main.getByRole("button", { name: "Next" }).click();
  await expect(main.getByRole("heading", { name: "Sea Ice" })).toBeVisible();
  await expect(feedback).toBeHidden();
  await moveTo(page, 1);
  await expect(main.getByRole("slider")).toHaveAttribute("aria-valuetext", /May, falling/i);

  await main.getByRole("button", { name: "Autumn" }).click();
  await main.getByTestId("ribbons-check").click();
  await expect(feedback).toContainText("autumn");
  await main.getByRole("button", { name: "Next" }).click();

  await expect(main.getByRole("heading", { name: "Ocean Heat" })).toBeVisible();
  await main.getByRole("button", { name: "Summer" }).click();
  await main.getByTestId("ribbons-check").click();
  await main.getByRole("button", { name: "Results" }).click();

  await expect(page.getByTestId("ribbons-result")).toBeVisible();
  await expect(main.getByRole("heading", { name: /3\/3 turns/ })).toBeVisible();
  await expect(main.getByText("260", { exact: true })).toBeVisible();
  await expect(main.getByText("First try 2 of 3")).toBeVisible();
  await expect(main.getByText("Spring · May")).toBeVisible();
  await expect(main.getByText("Summer", { exact: true }).first()).toHaveCSS("text-decoration-line", "line-through");
});

test("waveform ribbons hints, reveals, and skips without leaking the answer early", async ({ page }) => {
  await page.goto("/challenge/ribbons");
  const main = liveMain(page);
  const feedback = main.getByTestId("ribbons-feedback");

  await main.getByRole("button", { name: "Winter" }).click();
  await main.getByTestId("ribbons-check").click();
  await expect(feedback).toContainText("Winter is not where it turns");
  await expect(feedback).not.toContainText("crest");

  await main.getByRole("button", { name: "Summer" }).click();
  await main.getByTestId("ribbons-check").click();
  await expect(feedback).toContainText("crest");
  await expect(feedback).not.toContainText("May");

  await main.getByRole("button", { name: "Autumn" }).click();
  await main.getByTestId("ribbons-check").click();
  await expect(feedback).toContainText("spring, in May");
  await expect(main.getByText("0 PTS")).toBeVisible();
  await main.getByRole("button", { name: "Next" }).click();

  await main.getByTestId("ribbons-skip").click();
  await expect(feedback).toContainText("Skipped");
  await expect(feedback).toContainText("autumn");
  await main.getByRole("button", { name: "Next" }).click();

  await main.getByRole("button", { name: "Summer" }).click();
  await main.getByTestId("ribbons-check").click();
  await main.getByRole("button", { name: "Results" }).click();
  await expect(main.getByRole("heading", { name: /1\/3 turns/ })).toBeVisible();
  await expect(main.getByText("100", { exact: true })).toBeVisible();
  await expect(main.getByText("Revealed")).toBeVisible();
  await expect(main.getByText("Skipped")).toBeVisible();
});

test("shared ribbons results recompute totals and reject a forged score", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/challenge/ribbons?result=v1.1.900");
  await expect(page.getByTestId("ribbons-result")).toHaveCount(0);
  await expect(liveMain(page).getByText("900")).toHaveCount(0);
  await expect(liveMain(page).getByRole("heading", { name: "CO₂ Cycle" })).toBeVisible();

  await page.goto("/challenge/ribbons?result=v2.100.60.900");
  const main = liveMain(page);
  await expect(page.getByTestId("ribbons-result")).toBeVisible();
  await expect(main.getByText("260", { exact: true })).toBeVisible();
  await expect(main.getByText("900")).toHaveCount(0);
  await expect(main.getByRole("heading", { name: /3\/3 turns/ })).toBeVisible();

  const back = await main.getByTestId("ribbons-back").boundingBox();
  const copy = await main.getByTestId("ribbons-copy").boundingBox();
  const save = await main.getByTestId("ribbons-save").boundingBox();
  const all = await main.getByTestId("ribbons-all").boundingBox();
  for (const box of [back, copy, save, all]) {
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  await main.getByTestId("ribbons-copy").click();
  await expect(main.getByTestId("ribbons-share-note")).toContainText("Result link copied.");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("result=v2.100.60.100");

  const downloadPromise = page.waitForEvent("download");
  await main.getByTestId("ribbons-save").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("waveform-ribbons");
  await expect(main).toHaveAttribute("data-image-font", /Geist/i);

  const share = main.getByTestId("ribbons-share-x");
  await expect(share).toHaveAttribute("href", /twitter\.com\/intent\/tweet/);
  await expect(share).toContainText("Share to X");

  await main.getByTestId("ribbons-replay").first().click();
  await expect(main.getByTestId("ribbons-replay").first()).toHaveAttribute("aria-pressed", "true");
  await main.getByTestId("ribbons-replay").first().click();
  await expect(main.getByTestId("ribbons-replay").first()).toHaveAttribute("aria-pressed", "false");

  await page.waitForTimeout(450);
  await main.getByTestId("ribbons-again").click();
  await expect(page).toHaveURL(/\/challenge\/ribbons$/);
  await expect(liveMain(page).getByRole("heading", { name: "CO₂ Cycle" })).toBeVisible();
});
