import { MAP_REGIONS, regionById, type MapRegion } from "@/data/exploreMap";
import { regionIdAt } from "@/components/listen/regionGeometry";
import type { LegendMetadata } from "@/components/listen/v4/legend";
import { dataAtProbeLabel, seaIceExample } from "@/components/listen/v4/exampleReading";
import { isSoundLayer, mapLayerToSound, readingNumber } from "@/components/listen/v4/layerRange";
import { acceptReading, probeInstant, type ReadingContext, type TaggedReading } from "@/components/listen/v4/readingContext";
import { formatUtcInstant } from "@/components/listen/v4/utcLabel";

export type LayerId = "all" | "temperature" | "sea-ice" | "co2" | "methane" | "air" | "sea-temp" | "currents" | "wind" | "precip" | "elevation";
export type SoundStyle = "synth" | "orchestra";
export type InstrumentId = "soft-synth" | "marimba" | "woodblock" | "strings";
export type VariationId = "soft" | "bright" | "deep";
export type PitchMode = "continuous" | "pentatonic";
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

export const PRIMARY_LAYERS: ReadonlyArray<{ id: LayerId; label: string; name?: string }> = [
  { id: "all", label: "ALL" },
  { id: "temperature", label: "TEMPERATURE" },
  { id: "sea-ice", label: "SEA ICE" },
  { id: "co2", label: "CO₂" },
  { id: "methane", label: "METHANE" },
];

export const EXTRA_LAYERS: ReadonlyArray<{ id: LayerId; label: string; name?: string }> = [
  { id: "air", label: "AIR" },
  { id: "sea-temp", label: "SEA TEMP" },
  { id: "currents", label: "CURRENTS" },
  { id: "wind", label: "WIND" },
  { id: "precip", label: "PRECIP", name: "Average annual precipitation" },
  { id: "elevation", label: "ELEVATION" },
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
  meta: "NOAA CPC · example, not live",
  preview: "",
  legend: TEMP_LEGEND,
};

export const CURATED_SOURCE_IDS = new Set<string>([
  "eic-svs-5101",
  MAP_SOURCE.id,
  "oco2-example",
  "currents-example",
  "iss-lightning-5011",
]);

export const SEED_SOURCES: readonly ListenSource[] = [
  MAP_SOURCE,
  {
    id: "oco2-example",
    title: "DYAMOND Global CO₂ (OCO-2)",
    kind: "image",
    eyebrow: "IMG",
    meta: "NASA SVS 5196 · image-derived",
    preview: "/api/listen/svs/image?id=5196",
    video: "/api/listen/svs/video?id=5196",
    layer: "co2",
    legend: null,
  },
  {
    id: "currents-example",
    title: "Global currents & SST (Ocean currents animation)",
    kind: "video",
    eyebrow: "VID",
    meta: "NASA SVS 3912 · image-derived",
    preview: "/api/listen/svs/image?id=3912",
    video: "/api/listen/svs/video?id=3912",
    duration: "0:48",
    layer: "currents",
    legend: null,
  },
  {
    id: "iss-lightning-5011",
    title: "ISS Lightning 2017–2023",
    kind: "video",
    eyebrow: "VID",
    meta: "NASA SVS 5011 · pulse triggers",
    preview: "/api/listen/svs/image?id=5011",
    video: "/api/listen/svs/video?id=5011",
    duration: "0:25",
    layer: "all",
    legend: null,
  },
];

export const SEED_SEARCHES: readonly SearchRecord[] = [];

export function layerFromParam(value: string | undefined): LayerId {
  if (value === "co2") return "co2";
  if (value === "ch4" || value === "methane") return "methane";
  if (value === "sea-ice") return "sea-ice";
  if (value === "all") return "all";
  if (value === "air" || value === "sea-temp" || value === "currents" || value === "wind" || value === "precip" || value === "elevation") return value;
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
  if (layer === "sea-temp") return "Hear Sea temperature as";
  if (layer === "co2") return "Hear CO₂ as";
  if (layer === "methane") return "Hear Methane as";
  if (layer === "air") return "Hear Air temp as";
  if (layer === "currents") return "Hear Currents as";
  if (layer === "precip") return "Hear Precipitation as";
  if (layer === "elevation") return "Hear Elevation as";
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

function inNino(lng: number, lat: number): boolean {
  const x = ((lng + 180) % 360 + 360) % 360 - 180;
  return x <= -120 && x >= -170 && lat <= 5 && lat >= -5;
}

function regionAt(lng: number, lat: number): MapRegion | null {
  if (inNino(lng, lat)) return regionById("nino34");
  const id = regionIdAt(lng, lat);
  if (!id) return null;
  return MAP_REGIONS.find((item) => item.id === id) ?? null;
}

function scaleAnomaly(value: number, year: number): number {
  if (year >= YEAR_END) return value;
  const t = (year - YEAR_START) / (YEAR_END - YEAR_START);
  return value * (0.4 + 0.6 * t);
}

function formatAnomaly(value: number, precise: boolean): string {
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

function parseHexRgb(hexColor: string): [number, number, number] | null {
  const raw = hexColor.replace("#", "");
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((part) => Number.isNaN(part))) return null;
  return [r, g, b];
}

function bandName(hexColor: string): string {
  const rgb = parseHexRgb(hexColor);
  if (!rgb) return "No data";
  const [r, g, b] = rgb;
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

function paintColor(layer: LayerId, lng: number, lat: number): string {
  const region = regionAt(lng, lat);
  if (layer === "sea-ice") {
    if (region?.seaIce || region?.id === "arctic" || region?.id === "antarctica") return "#d5e6ee";
    return "#2a2a2a";
  }
  if (layer === "co2" || layer === "methane" || layer === "air" || layer === "sea-temp" || layer === "currents" || layer === "wind" || layer === "precip" || layer === "elevation") {
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
  measured: TaggedReading | null;
  measuring: boolean;
}): ProbeReading {
  const { layer, year, lat, lng, source, pixelColor, measured, measuring } = input;
  const currentContext: ReadingContext = {
    source: source.id,
    layer,
    lat,
    lon: lng,
    time: probeInstant(year),
  };
  const accepted = acceptReading(currentContext, measured);
  const when = formatUtcInstant(probeInstant(year)) ?? dateLabel(year);
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
  if (accepted && accepted.status === "reading" && layer === "temperature") {
    temperature = {
      id: "temperature",
      label: "TEMPERATURE",
      swatch: "#e08a3c",
      state: "matched",
      value: accepted.value,
      detail: accepted.detail,
    };
  } else if (source.kind === "map" && region) {
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
  } else if (source.id === "eic-svs-5101" || source.id === "default-eic" || (source.kind === "image" && source.layer === "all")) {
    temperature = {
      id: "temperature",
      label: "TEMPERATURE",
      swatch: source.kind !== "map" && !pixelColor ? "#3a3a3a" : color,
      state: "image",
      value: source.kind !== "map" && !pixelColor ? "No data" : bandName(color),
      detail: "FROM PIXELS · NOT A MEASUREMENT",
    };
  } else if (measuring && layer === "temperature") {
    temperature = {
      id: "temperature",
      label: "TEMPERATURE",
      swatch: "#e08a3c",
      state: "loading",
      value: "Processing satellite scene…",
      detail: "AZURE BACKGROUND JOB · MODIS",
    };
  } else if (accepted && accepted.status === "no-data" && layer === "temperature") {
    temperature = {
      id: "temperature",
      label: "TEMPERATURE",
      swatch: "#3a3a3a",
      state: "empty",
      value: accepted.value,
      detail: accepted.detail,
    };
  } else if (accepted && layer === "temperature") {
    temperature = {
      id: "temperature",
      label: "TEMPERATURE",
      swatch: "#e08a3c",
      state: "matched",
      value: accepted.value,
      detail: accepted.detail,
    };
  } else {
    temperature = emptyCard("temperature", "TEMPERATURE", "NO TEMPERATURE FIELD ON THIS SOURCE");
  }

  let seaIce: ReadingCard;
  if (source.kind === "map" && region?.seaIce) {
    const example = seaIceExample(when);
    seaIce = {
      id: "sea-ice",
      label: "SEA ICE",
      swatch: "#d5e6ee",
      state: "matched",
      value: example.value,
      detail: example.detail,
    };
  } else {
    seaIce = emptyCard("sea-ice", "SEA ICE", "SEA ICE IS ARCTIC + ANTARCTIC ONLY");
  }

  const co2: ReadingCard =
    source.kind === "map"
      ? {
          id: "co2",
          label: "CO₂",
          swatch: "#f2f2f0",
          state: "matched",
          value: "427 ppm",
          detail: "NOAA GML MAUNA LOA ANNUAL MEAN · 2025 · EXAMPLE",
        }
      : source.layer === "co2" || source.id === "oco2-example" || source.id === "dyamond-co2"
      ? {
          id: "co2",
          label: "CO₂",
          swatch: !pixelColor ? "#3a3a3a" : color,
          state: "image",
          value: !pixelColor ? "No data" : bandName(color),
          detail: "FROM PIXELS · NOT A MEASUREMENT",
        }
      : emptyCard("co2", "CO₂", "NEEDS A NASA CO₂ SOURCE");
  const methane: ReadingCard = source.kind === "map"
    ? {
        id: "methane",
        label: "METHANE",
        swatch: "#f2f2f0",
        state: "matched",
        value: "1936 ppb",
        detail: "NOAA GML GLOBAL ANNUAL MEAN · 2025 · EXAMPLE",
      }
    : emptyCard("methane", "METHANE", "NO METHANE LAYER ON THIS MAP");

  const extras = new Map<string, ReadingCard>();
  for (const id of ["air", "sea-temp", "currents", "wind", "precip", "elevation"] as const) {
    if (measuring && layer === id) {
      extras.set(id, {
        id,
        label: layerLabel(id),
        swatch: "#8a6248",
        state: "loading",
        value: "Loading matched data…",
        detail: "CHECKING THE MEASUREMENT SOURCE",
      });
    } else if (accepted?.status === "no-data" && layer === id) {
      extras.set(id, {
        id,
        label: layerLabel(id),
        swatch: "#3a3a3a",
        state: "empty",
        value: accepted.value,
        detail: accepted.detail,
      });
    } else if (accepted && layer === id) {
      extras.set(id, {
        id,
        label: layerLabel(id),
        swatch: "#8a6248",
        state: "matched",
        value: accepted.value,
        detail: accepted.detail,
      });
    } else if (id === "currents" && (source.id === "currents-example" || source.layer === "currents")) {
      extras.set("currents", {
        id: "currents",
        label: layerLabel("currents"),
        swatch: source.kind !== "map" && !pixelColor ? "#3a3a3a" : color,
        state: "image",
        value: source.kind !== "map" && !pixelColor ? "No data" : bandName(color),
        detail: "FROM PIXELS · NOT A MEASUREMENT",
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
  if (active.state === "matched" && accepted && layer === "temperature" && isSoundLayer(layer)) {
    normalized = mapLayerToSound(layer, readingNumber(accepted.value)) ?? Math.min(1, Math.max(0, (scaleAnomaly(region ? region.anomaly : 0, year) + 1) / 4));
  } else if (active.state === "matched" && source.kind === "map" && region && (layer === "temperature" || layer === "all")) {
    normalized = Math.min(1, Math.max(0, (scaleAnomaly(region.anomaly, year) + 1) / 4));
  } else if (active.state === "matched" && isSoundLayer(layer)) {
    normalized = mapLayerToSound(layer, readingNumber(accepted?.value ?? measured?.value));
  } else if (layer === "all" || active.state === "image") {
    const rgb = parseHexRgb(color);
    normalized = rgb ? (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 : 0.45;
  }

  const warmer = region ? scaleAnomaly(region.anomaly, year) : 0;
  const placeName = region ? (region.id === "nino34" ? "NIÑO 3.4" : region.name.toUpperCase()) : "THIS POINT";
  const tip = source.kind !== "map"
    ? bandName(color).toUpperCase()
    : layer === "sea-ice"
      ? region?.seaIce ? `${placeName} · ICE` : "NO SEA ICE HERE"
      : layer === "co2"
        ? source.kind === "map" ? "CO₂ · 427 PPM" : "NO CO₂ FIELD"
        : layer === "methane"
          ? source.kind === "map" ? "METHANE · 1936 PPB" : "NO METHANE FIELD"
          : layer === "wind"
            ? "NO WIND FIELD"
            : layer === "air"
              ? "NO AIR TEMP FIELD"
              : layer === "sea-temp"
                ? active.state === "matched" ? `SEA TEMP · ${active.value}` : active.state === "loading" ? "CHECKING SEA TEMP" : "NO MATCHED SEA TEMP"
              : layer === "currents"
                ? "NO CURRENT FIELD"
                : layer === "precip"
                  ? active.state === "matched" ? active.value.replace("mm/day", "mm/d") : active.state === "loading" ? "CHECKING PRECIP" : "NO PRECIP FIELD"
                : layer === "elevation"
                  ? active.state === "matched" ? active.value : active.state === "loading" ? "CHECKING ELEVATION" : "NO ELEVATION"
                : region
                  ? `${placeName} · ${warmer > 0.15 ? "WARMER ↑" : warmer < -0.15 ? "COOLER ↓" : "STEADY"}`
                  : "NO REGION FIELD";
  const pitch =
    layer === "temperature" || layer === "all"
      ? "SST ANOMALY °C"
      : layer === "sea-ice"
        ? "SEA ICE COVER"
        : layer === "sea-temp"
          ? "SEA SURFACE TEMP °C"
          : layer === "co2"
          ? "CO₂"
          : layer === "methane"
            ? "METHANE"
            : layer === "precip"
              ? "PRECIPITATION mm/day"
            : layer === "elevation"
              ? "ELEVATION m"
              : layerLabel(layer);

  return {
    cards,
    matched,
    imageDerived,
    empty,
    pitch: layer === "all" ? "VISUAL PATTERN" : pitch,
    dataAtProbe: dataAtProbeLabel(active.state, active.state === "matched" && (active.id === "temperature" || active.id === "sea-ice")),
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
