/**
 * Official NASA Scientific Visualization Studio (SVS) media proxy.
 * Serves verified stills and streams 1080p MP4 animations through the server.
 * Clients never receive upstream file links directly.
 */

export const SVS_HOST = "svs.gsfc.nasa.gov";

export interface SvsRecord {
  readonly id: string;
  readonly title: string;
  readonly stillUrl: string;
  readonly videoUrl?: string;
  readonly date: string;
}

export const SVS_REGISTRY: Record<string, {
  readonly id: string;
  readonly title: string;
  readonly stillUrl: string;
  readonly videoUrl?: string;
  readonly defaultDate: string;
}> = {
  "5101": {
    id: "5101",
    title: "Sea Surface Temperature (SST) - Near Real Time",
    stillUrl: "https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005101/sst_mur_most_recent_print.jpg",
    defaultDate: "2026-11-15",
  },
  "5196": {
    id: "5196",
    title: "DYAMOND Global Carbon Dioxide",
    stillUrl: "https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00200_print.jpg",
    videoUrl: "https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_3-29-2023a_dyamond_co2_anim_globe_zoom_1080p30.mp4",
    defaultDate: "2024-07-22",
  },
  "3912": {
    id: "3912",
    title: "Global Sea Surface Currents and Temperature",
    stillUrl: "https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_2028x1024.25000.jpg",
    videoUrl: "https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/ecco2_sst_flow.mp4",
    defaultDate: "2012-03-22",
  },
  "5011": {
    id: "5011",
    title: "Lightning Events Detected from the International Space Station (ISS) 2017-2023",
    stillUrl: "https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_preview.jpg",
    videoUrl: "https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_sphere_07312023.mp4",
    defaultDate: "2023-08-01",
  },
};

export function isAllowedSvsId(id: string): id is keyof typeof SVS_REGISTRY {
  return Object.hasOwn(SVS_REGISTRY, id);
}

export function allowedSvsUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.username || url.password) return null;
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.hostname !== SVS_HOST) return null;
    if (!url.pathname.startsWith("/vis/")) return null;
    url.protocol = "https:";
    return url;
  } catch {
    return null;
  }
}
