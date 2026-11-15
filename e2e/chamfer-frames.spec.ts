import { expect, test, type Page } from "@playwright/test";
import { liveMain } from "./support";

const PAGES = ["/", "/about", "/listen?sound=off"] as const;

/** Listen controls that must carry the shared chamfer, even when they have no CSS border. */
const LISTEN_FRAMES = [
  ".lv-hist",
  ".lv-search-glyph",
  ".lv-card",
  ".lv-chip",
  ".lv-search",
  ".lv-new",
  ".lv-play",
  ".lv-save",
  ".lv-history",
  ".lv-sound",
] as const;

/**
 * Chrome that is intentionally not a chamfered frame.
 * Do not add a new bordered control here. Give it ChamferMark instead.
 */
const ALLOWED_SQUARE = [
  "sonify-grid-block",
  "sonify-btn-primary",
  "sonify-mini",
  "am-btn",
  "mk-sq",
  "mk-tag",
  "mk-cap",
  "routine-",
  "card-img",
  "target-cursor",
];

async function missingChamfer(page: Page, selector: string) {
  return liveMain(page).locator(selector).evaluateAll((elements) =>
    elements.flatMap((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || box.width < 8 || box.height < 8) return [];
      const clip = style.clipPath || "";
      const stroke = element.querySelector(":scope > .lv-chamfer-svg polygon, :scope > .lv-chamfer-svg polyline");
      const strokeStyle = stroke ? getComputedStyle(stroke) : null;
      const strokeFollows =
        !!strokeStyle && strokeStyle.stroke !== "none" && Number.parseFloat(strokeStyle.strokeWidth) >= 1;
      const ok = element.classList.contains("lv-cut") && clip.startsWith("polygon") && strokeFollows;
      return ok ? [] : [element.className.toString().slice(0, 80) || element.tagName];
    }),
  );
}

test("listen frames use the shared chamfer stroke", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/listen?sound=off");
  await page.locator(".lv-hist > .lv-chamfer-svg polygon").first().waitFor();
  for (const selector of LISTEN_FRAMES) {
    expect(await missingChamfer(page, selector), selector).toEqual([]);
  }
});

test("new framed controls on the key pages keep a chamfer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const path of PAGES) {
    await page.goto(path);
    await page.locator("body > #main-content").waitFor();
    const offenders = await page.evaluate((allowed) => {
      const root = document.querySelector("body > #main-content");
      if (!root) return ["missing main"];
      const found: string[] = [];
      const candidates = root.querySelectorAll(
        "button, a, input, textarea, [class*='card'], [class*='chip'], [class*='btn'], [class*='glyph'], [class*='panel'], [class*='popup'], [class*='sheet'], [class*='hist']",
      );
      for (const element of candidates) {
        if (!(element instanceof HTMLElement) || element.closest("svg")) continue;
        const name = element.className?.toString?.() || "";
        if (allowed.some((token) => name.includes(token))) continue;
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const box = element.getBoundingClientRect();
        if (box.width < 20 || box.height < 20) continue;
        const sides = ["Top", "Right", "Bottom", "Left"] as const;
        const boxed = sides.every((side) => {
          const width = Number.parseFloat(style[`border${side}Width`]);
          return width >= 1 && style[`border${side}Style`] !== "none";
        });
        const inset = style.boxShadow.includes("inset");
        if (!boxed && !inset) continue;
        const radius = Number.parseFloat(style.borderTopLeftRadius);
        if (radius >= box.height / 2 - 1) continue;
        const clip = style.clipPath || "";
        const marked = element.classList.contains("lv-cut") || name.includes("chamfer") || name.includes("sonify-cut");
        if (marked || clip.startsWith("polygon")) continue;
        found.push(`${element.tagName}.${name.slice(0, 60)}`.trim());
      }
      return found;
    }, ALLOWED_SQUARE);
    expect(offenders, path).toEqual([]);
  }
});
