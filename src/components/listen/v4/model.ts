import { MAP_REGIONS, regionById, type MapRegion } from "@/data/exploreMap";
import { regionIdAt } from "@/components/listen/regionGeometry";
import type { LegendMetadata } from "@/components/listen/v4/legend";

export type LayerId = "all" | "temperature" | "sea-ice" | "co2" | "methane" | "air" | "currents" | "wind";
export type SoundStyle = "synth" | "orchestra";
export type InstrumentId = "soft-synth" | "marimba" | "woodblock" | "strings";
export type VariationId = "soft" | "bright" | "deep";
export type MediaKind = "map" | "image" | "video" | "search";

export interface ListenSource {
  readonly id: string;
  readonly title: string;
  readonly kind: MediaKind;
  readonly eyebrow: string;
  readonly meta: string;
  readonly preview: string;
  readonly video?: string;
  readonly duration?: string;
  readonly layer?: LayerId;
  readonly legend: LegendMetadata | null;
}

export interface SearchRecord {
  readonly id: string;
  readonly term: string;
  readonly detail: string;
}

export const YEAR_START = 1958;
export const YEAR_END = 2026;

export const PRIMARY_LAYERS: ReadonlyArray<{ id: LayerId; label: string }> = [
  { id: "all", label: "ALL" },
  { id: "temperature", label: "TEMPERATURE" },
  { id: "sea-ice", label: "SEA ICE" },
  { id: "co2", label: "CO₂" },
  { id: "methane", label: "METHANE" },
];

export const EXTRA_LAYERS: ReadonlyArray<{ id: LayerId; label: string }> = [
  { id: "air", label: "AIR" },
  { id: "currents", label: "CURRENTS" },
  { id: "wind", label: "WIND" },
];

export const STYLES: ReadonlyArray<{ id: SoundStyle; label: string }> = [
  { id: "synth", label: "SYNTH" },
  { id: "orchestra", label: "ORCHESTRA" },
];

export const INSTRUMENTS: ReadonlyArray<{ id: InstrumentId; label: string }> = [
  { id: "soft-synth", label: "SOFT SYNTH" },
  { id: "marimba", label: "MARIMBA" },
  { id: "woodblock", label: "WOODBLOCK" },
  { id: "strings", label: "STRINGS" },
];

export const VARIATIONS: ReadonlyArray<{ id: VariationId; label: string }> = [
  { id: "soft", label: "SOFT" },
  { id: "bright", label: "BRIGHT" },
  { id: "deep", label: "DEEP" },
];

const TEMP_LEGEND: LegendMetadata = {
  title: "TEMP ANOMALY °C · EXAMPLE",
  kind: "diverging",
  stops: [
    { color: "#5c4f96", label: "COLDER" },
    { color: "#8d6a58", label: "" },
    { color: "#e08a3c", label: "WARMER" },
  ],
  noData: { color: "#3a3a3a", label: "NO DATA HERE" },
};

const ICE_LEGEND: LegendMetadata = {
  title: "SEA ICE · EXAMPLE",
  kind: "categorical",
  stops: [
    { color: "#d5e6ee", label: "ICE" },
    { color: "#2a2a2a", label: "OPEN" },
  ],
  noData: { color: "#3a3a3a", label: "NO DATA HERE" },
};

const UNKNOWN_FIELD: LegendMetadata = {
  title: "NO COLORMAP ON THIS MAP",
  kind: "unknown",
  stops: [],
  noData: { color: "#3a3a3a", label: "NO DATA HERE" },
};

export const MAP_SOURCE: ListenSource = {
  id: "explore-nino",
  title: "Explore map · Niño 3.4",
  kind: "map",
  eyebrow: "MAP",
  meta: "NOAA CPC · TODAY",
  preview: "",
  legend: TEMP_LEGEND,
};

const CO2_PREVIEW =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#241433"/><stop offset="0.45" stop-color="#6a4ad4"/><stop offset="1" stop-color="#d7c4ff"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><rect y="150" width="320" height="30" fill="url(#g)"/></svg>`,
  );

const REEF_PREVIEW =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#12343a"/><circle cx="90" cy="110" r="46" fill="#e07a4a"/><circle cx="170" cy="80" r="34" fill="#f0d2a8"/><circle cx="230" cy="120" r="40" fill="#2f6f78"/></svg>`,
  );

export const SEED_SOURCES: readonly ListenSource[] = [
  MAP_SOURCE,
  {
    id: "oco2-example",
    title: "OCO-2 CO₂ map",
    kind: "image",
    eyebrow: "IMG",
    meta: "NASA EARTHDATA · YESTERDAY",
    preview: CO2_PREVIEW,
    layer: "co2",
    legend: null,
  },
  {
    id: "currents-example",
    title: "Ocean currents animation",
    kind: "video",
    eyebrow: "VID",
    meta: "NASA MEDIA · NOV 12",
    preview: "",
    duration: "0:48",
    legend: null,
  },
  {
    id: "reef-example",
    title: "reef-survey.jpg",
    kind: "image",
    eyebrow: "IMG",
    meta: "YOUR UPLOAD · NOV 10",
    preview: REEF_PREVIEW,
    legend: null,
  },
];

export const SEED_SEARCHES: readonly SearchRecord[] = [
  { id: "ocean-currents", term: "ocean currents", detail: "3 NASA MEDIA RESULTS" },
  { id: "carbon-dioxide", term: "carbon dioxide", detail: "EARTHDATA LAYER" },
  { id: "arctic-ice", term: "arctic sea ice 1979", detail: "12 RESULTS" },
];

export function layerFromParam(value: string | undefined): LayerId {
  if (value === "co2") return "co2";
  if (value === "ch4" || value === "methane") return "methane";
  if (value === "sea-ice") return "sea-ice";
  if (value === "all") return "all";
  if (value === "air" || value === "currents" || value === "wind") return value;
  return "temperature";
}

export function paramForLayer(layer: LayerId): string {
  if (layer === "co2") return "co2";
  if (layer === "methane") return "ch4";
  if (layer === "temperature") return "temp";
  return layer;
}

export function layerLabel(layer: LayerId): string {
  return [...PRIMARY_LAYERS, ...EXTRA_LAYERS].find((item) => item.id === layer)?.label ?? "TEMPERATURE";
}

export function hearTitle(layer: LayerId): string {
  if (layer === "all") return "Hear the field as";
  if (layer === "temperature") return "Hear Temperature as";
  if (layer === "sea-ice") return "Hear Sea ice as";
  if (layer === "co2") return "Hear CO₂ as";
  if (layer === "methane") return "Hear Methane as";
  if (layer === "air") return "Hear Air temp as";
  if (layer === "currents") return "Hear Currents as";
  return "Hear Wind as";
}

export function dateLabel(year: number): string {
  return year >= YEAR_END ? "SEP 2026" : String(year);
}

export function formatCoord(lat: number, lng: number): string {
  const latAbs = Math.abs(lat);
  const lngAbs = Math.abs(lng);
  const ns = latAbs < 0.5 ? "0°" : `${Math.round(latAbs)}°${lat >= 0 ? "N" : "S"}`;
  const ew = lngAbs < 0.5 ? "0°" : `${Math.round(lngAbs)}°${lng >= 0 ? "E" : "W"}`;
  return `${ns} ${ew}`;
}

export function inNino(lng: number, lat: number): boolean {
  const x = ((lng + 180) % 360 + 360) % 360 - 180;
  return x <= -120 && x >= -170 && lat <= 5 && lat >= -5;
}

export function regionAt(lng: number, lat: number): MapRegion | null {
  if (inNino(lng, lat)) return regionById("nino34");
  const id = regionIdAt(lng, lat);
  if (!id) return null;
  return MAP_REGIONS.find((item) => item.id === id) ?? null;
}

export function scaleAnomaly(value: number, year: number): number {
  if (year >= YEAR_END) return value;
  const t = (year - YEAR_START) / (YEAR_END - YEAR_START);
  return value * (0.4 + 0.6 * t);
}

export function formatAnomaly(value: number, precise: boolean): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(precise ? 2 : 1)} °C`;
}

export interface ReadingCard {
  readonly id: string;
  readonly label: string;
  readonly swatch: string;
  readonly state: "matched" | "image" | "empty" | "loading";
  readonly value: string;
  readonly detail: string;
}

export interface ProbeReading {
  readonly cards: readonly ReadingCard[];
  readonly matched: number;
  readonly imageDerived: number;
  readonly empty: number;
  readonly pitch: string;
  readonly dataAtProbe: string;
  readonly normalized: number | null;
  readonly tip: string;
  readonly tipTone: "warm" | "cool" | "flat";
}

function emptyCard(id: string, label: string, detail: string): ReadingCard {
  return { id, label, swatch: "#3a3a3a", state: "empty", value: "No matched data for this point", detail };
}

export function bandName(hexColor: string): string {
  const raw = hexColor.replace("#", "");
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((part) => Number.isNaN(part))) return "No data";
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 48) return "No data";
  if (max - min < 28) return max < 96 ? "Dark field" : "Muted band";
  if (r > 150 && r > g + 15 && r > b) return "Warm orange band";
  if (b > 90 && r > 70 && b >= g && Math.abs(r - b) < 80) return "Cool purple band";
  if (b > r + 15 && b > g) return "Cool blue band";
  if (r > 90 && g > 50 && b < 90) return "Warm brown band";
  if (r < 50 && g < 50 && b < 50) return "Dark field";
  return "Muted band";
}

export function paintColor(layer: LayerId, lng: number, lat: number): string {
  const region = regionAt(lng, lat);
  if (layer === "sea-ice") {
    if (region?.seaIce || region?.id === "arctic" || region?.id === "antarctica") return "#d5e6ee";
    return "#2a2a2a";
  }
  if (layer === "co2" || layer === "methane" || layer === "air" || layer === "currents" || layer === "wind") {
    return region ? "#3a3a3a" : "#161311";
  }
  if (inNino(lng, lat)) return "#e08a3c";
  if (!region) return "#161311";
  if (region.anomaly <= -0.7) return "#6a59b0";
  if (region.anomaly < 0) return "#6e5a78";
  return "#8a6248";
}

export function legendMetaFor(layer: LayerId, source: ListenSource): LegendMetadata | null {
  if (source.kind !== "map") return null;
  if (layer === "temperature" || layer === "all") return TEMP_LEGEND;
  if (layer === "sea-ice") return ICE_LEGEND;
  return { ...UNKNOWN_FIELD, title: `${layerLabel(layer)} · NO COLORMAP` };
}

export function readProbe(input: {
  layer: LayerId;
  year: number;
  lat: number;
  lng: number;
  source: ListenSource;
  pixelColor: string | null;
  measured: { value: string; detail: string } | null;
  measuring: boolean;
}): ProbeReading {
  const { layer, year, lat, lng, source, pixelColor, measured, measuring } = input;
  const when = dateLabel(year);
  const region = source.kind === "map" ? regionAt(lng, lat) : null;
  const color = pixelColor ?? (source.kind === "map" ? paintColor(layer === "all" ? "temperature" : layer, lng, lat) : "#161311");
  const visual: ReadingCard = {
    id: "visual",
    label: "VISUAL PATTERN",
    swatch: source.kind !== "map" && !pixelColor ? "#3a3a3a" : color,
    state: "image",
    value: source.kind !== "map" && !pixelColor ? "No data" : bandName(color),
    detail: source.kind === "map" ? "FROM MAP PIXELS · NOT A MEASUREMENT" : "FROM PIXELS · NOT A MEASUREMENT",
  };

  let temperature: ReadingCard;
  if (source.kind === "map" && region) {
    const anomaly = scaleAnomaly(region.anomaly, year);
    const nino = region.id === "nino34";
    temperature = {
      id: "temperature",
      label: "TEMPERATURE",
      swatch: "#e08a3c",
      state: "matched",
      value: formatAnomaly(anomaly, nino),
      detail: nino
        ? `SST ANOMALY · NOAA CPC · ${when} · EXAMPLE DATA`
        : `SURFACE TEMP · ANOMALY · ${when} · EXAMPLE DATA`,
    };
  } else {
    temperature = emptyCard("temperature", "TEMPERATURE", "NO TEMPERATURE FIELD ON THIS SOURCE");
  }

  let seaIce: ReadingCard;
  if (source.kind === "map" && region?.seaIce) {
    seaIce = {
      id: "sea-ice",
      label: "SEA ICE",
      swatch: "#d5e6ee",
      state: "matched",
      value: region.id === "arctic" ? "4.81 million km²" : "Included",
      detail: region.id === "arctic" ? `NSIDC · ${when} · EXAMPLE DATA` : "EXAMPLE · SOUTHERN FIELD",
    };
  } else {
    seaIce = emptyCard("sea-ice", "SEA ICE", "SEA ICE IS ARCTIC + ANTARCTIC ONLY");
  }

  const co2 = emptyCard("co2", "CO₂", "NEEDS A NASA OCO-2 SOURCE");
  const methane = emptyCard("methane", "METHANE", "NO METHANE LAYER ON THIS MAP");

  const extras = new Map<string, ReadingCard>();
  for (const id of ["air", "currents", "wind"] as const) {
    if (measuring && layer === id) {
      extras.set(id, {
        id,
        label: layerLabel(id),
        swatch: "#8a6248",
        state: "loading",
        value: "Loading matched data…",
        detail: "CHECKING THE MEASUREMENT SOURCE",
      });
    } else if (measured && layer === id) {
      extras.set(id, {
        id,
        label: layerLabel(id),
        swatch: "#8a6248",
        state: "matched",
        value: measured.value,
        detail: measured.detail,
      });
    } else {
      extras.set(id, emptyCard(id, layerLabel(id), "NO MATCHED DATA FOR THIS POINT"));
    }
  }

  const cards = [visual, temperature, seaIce, co2, methane];
  if (EXTRA_LAYERS.some((item) => item.id === layer)) {
    const extra = extras.get(layer);
    if (extra) cards.push(extra);
  }

  const matched = cards.filter((card) => card.state === "matched").length;
  const imageDerived = cards.filter((card) => card.state === "image").length;
  const empty = cards.filter((card) => card.state === "empty").length;

  const active =
    layer === "all"
      ? visual
      : layer === "temperature"
        ? temperature
        : layer === "sea-ice"
          ? seaIce
          : layer === "co2"
            ? co2
            : layer === "methane"
              ? methane
              : extras.get(layer) ?? temperature;

  let normalized: number | null = null;
  if (active.state === "matched" && source.kind === "map" && region && (layer === "temperature" || layer === "all")) {
    normalized = Math.min(1, Math.max(0, (scaleAnomaly(region.anomaly, year) + 1) / 4));
  } else if (active.state === "matched" && layer === "sea-ice") {
    normalized = 0.72;
  } else if (layer === "all") {
    const raw = color.replace("#", "");
    const r = Number.parseInt(raw.slice(0, 2), 16);
    const g = Number.parseInt(raw.slice(2, 4), 16);
    const b = Number.parseInt(raw.slice(4, 6), 16);
    if (![r, g, b].some((part) => Number.isNaN(part))) normalized = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  } else if (active.state === "image") {
    normalized = 0.45;
  }

  const warmer = region ? scaleAnomaly(region.anomaly, year) : 0;
  const placeName = region ? (region.id === "nino34" ? "NIÑO 3.4" : region.name.toUpperCase()) : "THIS POINT";
  const tip = source.kind !== "map"
    ? bandName(color).toUpperCase()
    : layer === "sea-ice"
      ? region?.seaIce ? `${placeName} · ICE` : "NO SEA ICE HERE"
      : layer === "co2"
        ? "NO CO₂ FIELD"
        : layer === "methane"
          ? "NO METHANE FIELD"
          : layer === "wind"
            ? "NO WIND FIELD"
            : layer === "air"
              ? "NO AIR TEMP FIELD"
              : layer === "currents"
                ? "NO CURRENT FIELD"
                : region
                  ? `${placeName} · ${warmer > 0.15 ? "WARMER ↑" : warmer < -0.15 ? "COOLER ↓" : "STEADY"}`
                  : "NO REGION FIELD";
  const pitch =
    layer === "temperature" || layer === "all"
      ? "SST ANOMALY °C"
      : layer === "sea-ice"
        ? "SEA ICE COVER"
        : layer === "co2"
          ? "CO₂"
          : layer === "methane"
            ? "METHANE"
            : layerLabel(layer);

  return {
    cards,
    matched,
    imageDerived,
    empty,
    pitch: layer === "all" ? "VISUAL PATTERN" : pitch,
    dataAtProbe: active.state === "matched" ? "MATCHED · EXAMPLE" : active.state === "image" ? "IMAGE-DERIVED" : active.state === "loading" ? "LOADING" : "NO DATA",
    normalized: active.state === "empty" ? null : normalized,
    tip,
    tipTone: warmer < -0.15 ? "cool" : warmer > 0.15 ? "warm" : "flat",
  };
}

export function placeMatch(query: string): MapRegion | null {
  const clean = query.trim().toLowerCase();
  if (clean.length < 3) return null;
  return (
    MAP_REGIONS.find((region) => region.name.toLowerCase() === clean) ??
    MAP_REGIONS.find((region) => clean.includes(region.name.toLowerCase()) || region.name.toLowerCase().includes(clean)) ??
    null
  );
}
