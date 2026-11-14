import { ASSETS } from "@/data/landingData";
import { canWarmAssets, warmImages } from "@/lib/assetCache";
import { warmListenAssets } from "@/lib/listenAssets";

const chapterImages = [1, 2, 3].map((index) => `/assets/landing/chapters/chapter-0${index}.webp`);
const routeImages: Record<string, readonly string[]> = {
  "/": [ASSETS.heroEarthSky, ASSETS.heroForegroundAstronaut, ASSETS.heroTitleEarth, ASSETS.heroTitleBreathes, ASSETS.headerWordmark],
  "/about": ["/assets/about/hero-map.svg"],
  "/challenge": chapterImages,
  "/story": chapterImages,
};

export function warmRouteAssets(pathname: string) {
  if (!canWarmAssets()) return Promise.resolve();
  return pathname === "/listen" ? warmListenAssets() : warmImages(routeImages[pathname] ?? []);
}

/** Wait only for the visible destination, with a short ceiling for failed/slow resources. */
export async function waitForFirstView(pathname: string, signal: AbortSignal) {
  if (signal.aborted) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let mapReady: (() => void) | undefined;
  let abort: (() => void) | undefined;
  const visibleImages = Array.from(document.querySelectorAll<HTMLImageElement>("main img")).filter((image) => {
    const box = image.getBoundingClientRect();
    return image.loading !== "lazy" && box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0;
  });
  // Explicit assets also cover images whose intrinsic size is still zero while loading.
  const ready: Promise<unknown>[] = [warmRouteAssets(pathname), ...visibleImages.map((image) => image.decode().catch(() => {}))];
  if (pathname === "/listen" && !document.querySelector("[data-listen-map-ready]")) {
    ready.push(new Promise<void>((resolve) => {
      mapReady = resolve;
      window.addEventListener("sonify-map-ready", mapReady, { once: true });
    }));
  }
  await Promise.race([
    Promise.all(ready),
    new Promise<void>((resolve) => { timer = setTimeout(resolve, 1200); }),
    new Promise<void>((resolve) => { abort = resolve; signal.addEventListener("abort", abort, { once: true }); }),
  ]);
  clearTimeout(timer);
  if (mapReady) window.removeEventListener("sonify-map-ready", mapReady);
  if (abort) signal.removeEventListener("abort", abort);
}
