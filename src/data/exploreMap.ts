export type LayerId = "temperature" | "sea-ice" | "co2" | "methane";
export type SeasonId = "spring" | "summer" | "fall" | "winter";
export type WeatherId = "clear" | "rain" | "storm" | "heat";

export interface MapRegion {
  readonly id: string;
  readonly index: number;
  readonly name: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly center: readonly [number, number];
  readonly bounds?: readonly [number, number, number, number];
  readonly hit: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly anomaly: number;
  readonly seaIce: boolean;
  readonly note: number;
  readonly box?: boolean;
}

export const MAP_REGIONS: readonly MapRegion[] = [
  { id: "arctic", index: 1, name: "Arctic", label: "01 ARCTIC", x: 48.2, y: 12.1, center: [0, 78], hit: { x: 40, y: 6, w: 22, h: 12 }, anomaly: 1, seaIce: true, note: 196 },
  { id: "north-america", index: 2, name: "North America", label: "02 NORTH AMERICA", x: 60.1, y: 22.7, center: [-100, 44], hit: { x: 55, y: 16, w: 18, h: 14 }, anomaly: 0.3, seaIce: false, note: 247 },
  { id: "europe", index: 3, name: "Europe", label: "03 EUROPE", x: 86, y: 20.8, center: [15, 50], hit: { x: 82, y: 16, w: 12, h: 12 }, anomaly: 0.5, seaIce: false, note: 262 },
  { id: "asia", index: 4, name: "Asia", label: "04 ASIA", x: 24.3, y: 23.1, center: [92, 36], hit: { x: 16, y: 16, w: 22, h: 16 }, anomaly: 0.3, seaIce: false, note: 233 },
  { id: "africa", index: 5, name: "Africa", label: "05 AFRICA", x: 89, y: 38.6, center: [21, 5], hit: { x: 84, y: 32, w: 12, h: 16 }, anomaly: 0.2, seaIce: false, note: 220 },
  { id: "south-america", index: 6, name: "South America", label: "06 SOUTH AMERICA", x: 73.4, y: 56, center: [-60, -16], hit: { x: 68, y: 48, w: 12, h: 18 }, anomaly: 0.1, seaIce: false, note: 208 },
  { id: "oceania", index: 7, name: "Oceania", label: "07 OCEANIA", x: 31, y: 62.1, center: [135, -24], hit: { x: 24, y: 54, w: 16, h: 14 }, anomaly: -1, seaIce: false, note: 175 },
  { id: "antarctica", index: 8, name: "Antarctica + Southern Ocean", label: "08 ANTARCTICA + SOUTHERN OCEAN", x: 25.7, y: 82.6, center: [15, -74], hit: { x: 18, y: 76, w: 40, h: 10 }, anomaly: -0.6, seaIce: true, note: 165 },
  { id: "atlantic", index: 9, name: "Atlantic Ocean", label: "09 ATLANTIC OCEAN", x: 78.8, y: 62.1, center: [-32, 16], hit: { x: 74, y: 52, w: 14, h: 16 }, anomaly: 0.3, seaIce: false, note: 196 },
  { id: "pacific", index: 10, name: "Pacific Ocean", label: "10 PACIFIC OCEAN", x: 44.3, y: 30.8, center: [-160, 22], hit: { x: 36, y: 26, w: 18, h: 12 }, anomaly: -0.3, seaIce: false, note: 185 },
  { id: "indian", index: 11, name: "Indian Ocean", label: "11 INDIAN OCEAN", x: 14.9, y: 58.2, center: [76, -18], hit: { x: 8, y: 50, w: 14, h: 14 }, anomaly: 0.1, seaIce: false, note: 190 },
  {
    id: "nino34",
    index: 12,
    name: "Niño 3.4 · Pacific",
    label: "NIÑO 3.4 · 5°N–5°S · 170°W–120°W",
    x: 47.3,
    y: 43.6,
    center: [-145, 0],
    bounds: [-170, -5, -120, 5],
    hit: { x: 47.3, y: 45.6, w: 13.54, h: 5.9 },
    anomaly: 2.84,
    seaIce: false,
    note: 311,
    box: true,
  },
];

export const SEASONS: readonly {
  id: SeasonId;
  label: string;
  month: string;
  still: string;
  hero?: string;
}[] = [
  { id: "spring", label: "SPRING", month: "Apr", still: "/assets/listen/season-spring.webp" },
  { id: "summer", label: "SUMMER", month: "Jul", still: "/assets/listen/season-summer.webp", hero: "/assets/listen/season-summer-hero.webp" },
  { id: "fall", label: "FALL", month: "Oct", still: "/assets/listen/season-fall.webp" },
  { id: "winter", label: "WINTER", month: "Jan", still: "/assets/listen/season-winter.webp" },
];

export const WEATHER: readonly { id: WeatherId; label: string; icon: string }[] = [
  { id: "clear", label: "CLEAR", icon: "/assets/listen/wx-clear.svg" },
  { id: "rain", label: "RAIN", icon: "/assets/listen/wx-rain.svg" },
  { id: "storm", label: "STORM", icon: "/assets/listen/wx-storm.svg" },
  { id: "heat", label: "HEAT", icon: "/assets/listen/wx-heat.svg" },
];

export const LAYERS: readonly { id: LayerId; label: string }[] = [
  { id: "temperature", label: "TEMPERATURE" },
  { id: "sea-ice", label: "SEA ICE" },
  { id: "co2", label: "CO₂" },
  { id: "methane", label: "METHANE" },
];

export function regionById(id: string): MapRegion {
  return MAP_REGIONS.find((region) => region.id === id) ?? MAP_REGIONS[11];
}

export interface RegionReading {
  readonly available: boolean;
  readonly value: string;
  readonly metric: string;
  readonly source: string;
}

export function readingFor(region: MapRegion, layer: LayerId): RegionReading {
  if (layer === "temperature") {
    const sign = region.anomaly > 0 ? "+" : "";
    const digits = region.id === "nino34" ? 2 : 1;
    return {
      available: true,
      value: `${sign}${region.anomaly.toFixed(digits)} °C`,
      metric: region.id === "nino34" ? "SEA SURFACE TEMP · ANOMALY" : "SURFACE TEMP · ANOMALY",
      source:
        region.id === "nino34"
          ? "NOAA CPC · Sept 2026 · Niño 3.4 monthly"
          : "EXAMPLE · regional anomaly",
    };
  }
  if (layer === "sea-ice" && region.seaIce) {
    return {
      available: true,
      value: region.id === "arctic" ? "4.81 million km²" : "Included",
      metric: "SEA ICE",
      source: region.id === "arctic" ? "NSIDC Sea Ice Index · Sept. extent" : "EXAMPLE · southern field lights up",
    };
  }
  return {
    available: false,
    value: "No data",
    metric: layer === "sea-ice" ? "SEA ICE" : layer === "co2" ? "CO₂" : "METHANE",
    source: "No regional field for this layer",
  };
}

export function layerLit(region: MapRegion, layer: LayerId): boolean {
  if (layer === "temperature") return true;
  if (layer === "sea-ice") return region.seaIce;
  return false;
}
