export type HeroMarker = {
  readonly id: string;
  readonly tag: string;
  readonly tier: "a" | "b";
  readonly x: number;
  readonly y: number;
  readonly name: string;
  readonly detail?: string;
  readonly caption?: string;
  readonly phone?: boolean;
};

/** Positions are percents of the 1440×900 Equal Earth frame. Antarctica is omitted. */
export const HERO_MARKERS: readonly HeroMarker[] = [
  {
    id: "mlo",
    tag: "CO₂",
    tier: "a",
    x: 51.16,
    y: 37.25,
    caption: "Mauna Loa · 432.34 ppm",
    name: "CO₂ in the air · Keeling curve",
    detail: "432.34 ppm, May 2026 · NOAA GML Mauna Loa · embedded example, not a live feed",
    phone: true,
  },
  {
    id: "nino34",
    tag: "12",
    tier: "a",
    x: 54.07,
    y: 48.55,
    caption: "Niño 3.4 · +2.84 °C",
    name: "Global surface temperature · Niño 3.4",
    detail: "+2.84 °C sea-surface anomaly · NOAA CPC, Sept 2026 · example, not a live feed",
    phone: true,
  },
  {
    id: "arctic",
    tag: "01",
    tier: "a",
    x: 48.2,
    y: 12.1,
    caption: "Arctic · 4.81M km²",
    name: "Arctic sea ice",
    detail: "4.81 million km², Sept. extent 2026 · NSIDC Sea Ice Index · example, not a live feed",
    phone: true,
  },
  { id: "north-america", tag: "02", tier: "b", x: 60.1, y: 22.7, name: "Global surface temperature · North America" },
  { id: "europe", tag: "03", tier: "b", x: 86, y: 20.8, name: "Global surface temperature · Europe" },
  { id: "asia", tag: "04", tier: "b", x: 24.3, y: 23.1, name: "Global surface temperature · Asia" },
  { id: "africa", tag: "05", tier: "b", x: 89, y: 38.6, name: "Global surface temperature · Africa" },
  { id: "south-america", tag: "06", tier: "b", x: 73.4, y: 56, name: "Global surface temperature · South America" },
  { id: "oceania", tag: "07", tier: "b", x: 31, y: 62.1, name: "Global surface temperature · Oceania" },
  { id: "atlantic", tag: "09", tier: "b", x: 78.8, y: 62.1, name: "Global surface temperature · Atlantic Ocean" },
  { id: "pacific", tag: "10", tier: "b", x: 44.3, y: 30.8, name: "Global surface temperature · Pacific Ocean" },
  { id: "indian", tag: "11", tier: "b", x: 14.9, y: 58.2, name: "Global surface temperature · Indian Ocean" },
];
