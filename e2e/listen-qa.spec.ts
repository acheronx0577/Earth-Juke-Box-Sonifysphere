import { expect, test } from "@playwright/test";
import { liveMain } from "./support";

const SIZES = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
  { name: "768", width: 768, height: 998 },
  { name: "390", width: 390, height: 844 },
  { name: "200%", width: 720, height: 450 },
] as const;

async function topControl(page: import("@playwright/test").Page, x: number, y: number) {
  return page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    const hit = el?.closest("button, a, input, nav") as HTMLElement | null;
    return hit?.getAttribute("aria-label") || hit?.textContent?.trim().slice(0, 40) || el?.tagName || "none";
  }, { x, y });
}

for (const size of SIZES) {
  test(`search and history close stay clear of the site nav at ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/listen?sound=off");
    const search = liveMain(page).locator("#nasa-search").locator("visible=true");
    await expect(search).toBeVisible();
    const box = await search.boundingBox();
    if (!box) throw new Error("search has no box");
    const hit = await topControl(page, box.x + box.width / 2, box.y + box.height / 2);
    expect(hit).not.toMatch(/menu/i);
    await search.click();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).not.toHaveAttribute("class", /nav-open/);

    if (size.width < 1100) {
      await page.getByRole("button", { name: "HISTORY", exact: true }).click();
      const close = page.getByRole("button", { name: "Close history" }).first();
      await expect(close).toBeVisible();
      const closeBox = await close.boundingBox();
      if (!closeBox) throw new Error("close has no box");
      const closeHit = await topControl(page, closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
      expect(closeHit).toMatch(/Close history/);
    }
  });
}

test("search results have room for several rows and empty searches are not saved", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/listen/nasa?**", (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get("q") ?? "";
    if (q === "zzzz-no-such-media") return route.fulfill({ json: { items: [], total: 0 } });
    return route.fulfill({
      json: {
        items: Array.from({ length: 6 }, (_, index) => ({
          id: `PIA1000${index}`,
          title: `Result ${index + 1}`,
          mediaType: "image",
          preview: "/favicon-32x32.png",
          date: "2020-01-01",
          center: "JPL",
          description: "row",
        })),
        total: 6,
      },
    });
  });
  await page.goto("/listen?sound=off");
  await liveMain(page).locator("#nasa-search").locator("visible=true").fill("ocean currents");
  await page.keyboard.press("Enter");
  const tray = page.getByRole("region", { name: "NASA search results" });
  await expect(tray).toBeVisible();
  const height = await tray.evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeGreaterThan(240);
  await expect(tray.getByRole("button")).toHaveCount(7);

  await liveMain(page).locator("#nasa-search").locator("visible=true").fill("zzzz-no-such-media");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /zzzz-no-such-media/ })).toHaveCount(0);
  await expect(tray).toHaveCount(0);
});

test("an image source samples the pixel under the pointer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/listen?sound=off");
  await page.getByRole("button", { name: /OCO-2/ }).click();
  await expect(page.getByText("MAP · EQUAL EARTH · NOAA CPC")).toHaveCount(0);
  await expect(page.getByText("MOVE OVER THE MAP TO HEAR LOCAL CHANGE")).toHaveCount(0);
  const stage = page.locator(".lv-stage");
  const box = await stage.boundingBox();
  if (!box) throw new Error("stage has no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator(".lv-ring")).toBeVisible();
  await expect(page.getByRole("region", { name: "Readings at probe" })).not.toContainText("0° 145°W");
});

test("NASA ids with spaces are not rejected as invalid", async ({ request }) => {
  const spaced = await request.get("/api/listen/nasa/asset?id=GSFC%2020171208%20Archive");
  expect(spaced.status()).not.toBe(400);
  const dotted = await request.get("/api/listen/nasa/asset?id=PIA12345.2");
  expect(dotted.status()).not.toBe(400);
  const traversal = await request.get("/api/listen/nasa/asset?id=..%2Fsecret");
  expect(traversal.status()).toBe(400);
});

test("new source stays full height and the file input is not a tab stop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/listen?sound=off");
  const button = page.getByRole("button", { name: "+ New source" });
  const box = await button.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(58);
  await expect(page.locator("input[type=file]")).toHaveAttribute("tabindex", "-1");
});

test("the history drawer leaves the phone tab bar tappable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/listen?sound=off");
  await page.getByRole("button", { name: "HISTORY", exact: true }).click();
  const saved = page.getByRole("button", { name: "SAVED", exact: true });
  const savedBox = await saved.boundingBox();
  if (!savedBox) throw new Error("saved tab has no box");
  expect(await topControl(page, savedBox.x + savedBox.width / 2, savedBox.y + savedBox.height / 2)).toMatch(/SAVED/);
  const drawer = await liveMain(page).locator(".lv-history.is-open").boundingBox();
  const tabs = await liveMain(page).locator(".lv-tabs").boundingBox();
  if (!drawer || !tabs) throw new Error("drawer or tabs missing");
  expect(drawer.y + drawer.height).toBeLessThanOrEqual(tabs.y + 1);
  await saved.click();
  await expect(page.getByRole("heading", { name: "Saved profiles" })).toBeVisible();
});

test("a failed NASA open clears the previous media and shows the error", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/listen/nasa?**", (route) => route.fulfill({
    json: {
      items: [{ id: "NASA’s Earth Observatory", title: "Introducing NASA’s NEW Earth System Observatory", mediaType: "video", preview: "/favicon-32x32.png", date: "2021-05-24", center: "NASA", description: "clip" }],
      total: 1,
    },
  }));
  await page.route("**/api/listen/nasa/asset?**", (route) => route.fulfill({ status: 400, json: { error: "Invalid NASA ID." } }));
  await page.goto("/listen?sound=off");
  await page.getByRole("button", { name: /Ocean currents animation/ }).click();
  await expect(page.locator("video.lv-media, canvas.lv-media, img.lv-media")).toBeVisible();
  await liveMain(page).locator("#nasa-search").locator("visible=true").fill("earth");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /Introducing NASA/ }).click();
  await expect(page.getByRole("region", { name: "NASA search results" })).toHaveCount(0);
  await expect(page.locator(".lv-status")).toHaveText("Invalid NASA ID.");
  await expect(page.locator("video, canvas.lv-media")).toHaveCount(0);
  await expect(page.getByRole("group", { name: /Map probe/ })).toBeVisible();
});

test("escape returns focus to the sound profile toggle", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/listen?sound=off");
  const toggle = page.getByRole("button", { name: "SOUND PROFILE" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
});

test("status text does not cover a readings card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/listen?sound=off");
  await page.getByRole("button", { name: "SAVE PROFILE" }).click();
  await expect(liveMain(page).locator(".lv-status")).toHaveText("Profile saved.");
  const overlaps = await page.evaluate(() => {
    const status = document.querySelector(".lv-status")?.getBoundingClientRect();
    const card = document.querySelector(".lv-card")?.getBoundingClientRect();
    if (!status || !card) return true;
    return !(status.right < card.left || status.left > card.right || status.bottom < card.top || status.top > card.bottom);
  });
  expect(overlaps).toBe(false);
});

test("chips are a single shape", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/listen?sound=off");
  const chip = page.getByRole("button", { name: "TEMPERATURE", exact: true });
  await expect(chip.locator("span")).toHaveCount(0);
  const shape = await chip.evaluate((el) => {
    const kids = [...el.children].map((child) => child.getAttribute("class"));
    const polygon = el.querySelector(".lv-chamfer-svg polygon");
    return {
      kids,
      fill: polygon ? getComputedStyle(polygon).fill : "",
      stroke: polygon ? getComputedStyle(polygon).stroke : "",
    };
  });
  expect(shape.kids).toEqual(["lv-chamfer-svg"]);
  expect(shape.fill).toBe("none");
  expect(shape.stroke).toBe("rgb(31, 37, 37)");
});

test("the probe tooltip stays inside the stage at the east edge", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/listen?sound=off");
  const stage = page.locator(".lv-stage");
  const box = await stage.boundingBox();
  if (!box) throw new Error("stage has no box");
  await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2);
  const tip = page.locator(".lv-tip");
  await expect(tip).toBeVisible();
  const tipBox = await tip.boundingBox();
  if (!tipBox) throw new Error("tip has no box");
  expect(tipBox.x).toBeGreaterThanOrEqual(box.x - 1);
  expect(tipBox.x + tipBox.width).toBeLessThanOrEqual(box.x + box.width + 1);
});

test("an image probe uses pixel position and does not call black pixels purple", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/listen?sound=off");
  await page.getByRole("button", { name: /OCO-2/ }).click();
  const stage = page.getByRole("group", { name: /Pixel probe/ });
  const before = await stage.getAttribute("aria-label");
  expect(before).toMatch(/Pixel probe/);
  expect(before).not.toMatch(/Map probe|145/);
  await stage.focus();
  await page.keyboard.press("ArrowRight");
  await expect(stage).not.toHaveAttribute("aria-label", before ?? "");
  const box = await stage.boundingBox();
  if (!box) throw new Error("stage has no box");
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  const readings = page.getByRole("region", { name: "Readings at probe" });
  await expect(readings).not.toContainText("Cool purple band");
  await expect(readings).toContainText("No data");
  const swatch = await page.locator(".lv-card[data-id='visual'] .lv-swatch").evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(swatch).not.toBe("rgb(127, 102, 204)");
});

test("a six-card temperature value stays on one line", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/listen?sound=off");
  await page.getByRole("button", { name: "MORE +" }).click();
  const strong = liveMain(page).locator(".lv-card[data-id='temperature'] strong");
  await expect(strong).toBeVisible();
  const oneLine = await strong.evaluate((el) => {
    const style = getComputedStyle(el);
    const line = Number.parseFloat(style.lineHeight);
    return el.getBoundingClientRect().height < line * 1.6;
  });
  expect(oneLine).toBe(true);
});

test("opening and closing history moves focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/listen?sound=off");
  await page.getByRole("button", { name: "HISTORY", exact: true }).click();
  await expect(page.getByRole("button", { name: "Close history" }).first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "HISTORY", exact: true })).toBeFocused();
});

test("starter searches do not invent result counts", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/listen?sound=off");
  await expect(page.getByText("3 NASA MEDIA RESULTS")).toHaveCount(0);
  await expect(page.getByText("12 RESULTS")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /ocean currents/ })).toBeVisible();
});

test("phone date attaches to the track and the sound sheet title is uppercase", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/listen?sound=off");
  const track = await page.locator(".lv-timeline-track").boundingBox();
  const date = await page.locator(".lv-date").boundingBox();
  if (!track || !date) throw new Error("timeline missing");
  expect(Math.abs(track.x + track.width - date.x)).toBeLessThan(2);
  await page.getByRole("button", { name: "SOUND PROFILE" }).click();
  const header = page.locator(".lv-grab span");
  await expect(header).toContainText(/TEMPERATURE · SOFT SYNTH/i);
  const style = await header.evaluate((el) => {
    const computed = getComputedStyle(el);
    return { align: computed.textAlign, transform: computed.textTransform };
  });
  expect(style.align).toBe("left");
  expect(style.transform).toBe("uppercase");
});

test("tablet readings do not scroll", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 998 });
  await page.goto("/listen?sound=off");
  const fits = await page.locator(".lv-cards").evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
  expect(fits).toBe(true);
});

test("NASA ids with a curly apostrophe are not rejected as invalid", async ({ request }) => {
  const curly = await request.get(`/api/listen/nasa/asset?id=${encodeURIComponent("NASA’s Earth")}`);
  expect(curly.status()).not.toBe(400);
});

test("sea ice does not reuse the temperature tooltip", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/listen?sound=off");
  await page.getByRole("button", { name: "SEA ICE", exact: true }).click();
  await expect(page.getByText("NIÑO 3.4 · WARMER")).toHaveCount(0);
  await expect(page.getByText("NO SEA ICE HERE")).toBeVisible();
});
