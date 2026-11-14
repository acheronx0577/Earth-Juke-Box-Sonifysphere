import { SEASONS, WEATHER } from "@/data/exploreMap";
import { canWarmAssets, warmImages } from "@/lib/assetCache";

let renderer: Promise<typeof import("maplibre-gl")> | undefined;

export function loadGlobeRenderer() {
  renderer ??= import("maplibre-gl").catch((error: unknown) => {
    renderer = undefined;
    throw error;
  });
  return renderer;
}

let warming: Promise<void> | undefined;

/** Warm the next view's small assets, without creating a map, workers or audio graph. */
export function warmListenAssets() {
  if (warming) return warming;
  if (!canWarmAssets()) return Promise.resolve();
  const urls = new Set([...SEASONS.flatMap((season) => [season.still, ...(season.hero ? [season.hero] : [])]), ...WEATHER.map((weather) => weather.icon)]);
  warming = Promise.all([warmImages([...urls]), loadGlobeRenderer()]).then(() => {}).catch(() => { warming = undefined; });
  return warming;
}
