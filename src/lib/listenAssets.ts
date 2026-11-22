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

/**
 * Warm the small stills for a later Listen visit.
 * The globe renderer stays on /listen/classic, which loads it when the map opens.
 * Pulling maplibre in here parsed about a megabyte of script on the homepage.
 */
export function warmListenAssets() {
  if (warming) return warming;
  if (!canWarmAssets()) return Promise.resolve();
  const urls = new Set([...SEASONS.flatMap((season) => [season.still, ...(season.hero ? [season.hero] : [])]), ...WEATHER.map((weather) => weather.icon)]);
  warming = warmImages([...urls]).catch(() => { warming = undefined; });
  return warming;
}
