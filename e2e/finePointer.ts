import type { Page } from "@playwright/test";

/** Desktop Chrome in this environment reports no hover. Real visitors do, and that is when the site cursor hides the system pointer. */
export async function installFinePointer(page: Page) {
  await page.addInitScript(() => {
    const orig = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      const text = String(query);
      if (text.includes("hover") || text.includes("pointer")) {
        const matches = !text.includes("coarse") && !text.includes("hover: none") && !text.includes("pointer: none");
        return {
          matches,
          media: text,
          onchange: null,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() {
            return false;
          },
        } as MediaQueryList;
      }
      return orig(text);
    };
  });
}
