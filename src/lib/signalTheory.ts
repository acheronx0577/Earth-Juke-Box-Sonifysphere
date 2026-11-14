import {
  LAYERS,
  MAP_REGIONS,
  regionById,
  type LayerId,
  type SeasonId,
  type WeatherId,
} from "@/data/exploreMap";

export type GuessKind = "region" | "layer";

export interface GuessChoice {
  readonly id: string;
  readonly label: string;
}

export interface GuessRound {
  readonly kind: GuessKind;
  readonly regionId: string;
  readonly layer: LayerId;
  readonly season: SeasonId;
  readonly weather: WeatherId;
  readonly choices: readonly GuessChoice[];
  readonly answerId: string;
  readonly prompt: string;
}

export type MixSource = "region" | "layer";

export interface MixSlot {
  readonly source: MixSource;
  readonly id: string;
}

export interface MixNote {
  readonly time: number;
  readonly frequency: number;
  readonly duration: number;
  readonly oscillator: "sine" | "triangle";
  readonly slotIndex: number;
}

export interface MixPlan {
  readonly notes: readonly MixNote[];
  readonly duration: number;
  readonly bpm: number;
}

export const MIX_SLOT_COUNT = 8;
export const GUESS_ROUND_COUNT = 5;

const SEASONS: readonly SeasonId[] = ["spring", "summer", "fall", "winter"];
const WEATHERS: readonly WeatherId[] = ["clear", "rain", "storm", "heat"];

const SEASON_SHIFT: Record<SeasonId, number> = { spring: 0, summer: 36, fall: -12, winter: -48 };
const WEATHER_SHIFT: Record<WeatherId, number> = { clear: 0, rain: -8, storm: -28, heat: 64 };

const LAYER_SIGNATURE: Record<LayerId, { note: number; season: SeasonId; weather: WeatherId; oscillator: "sine" | "triangle" }> = {
  temperature: { note: 247, season: "summer", weather: "clear", oscillator: "sine" },
  "sea-ice": { note: 165, season: "winter", weather: "clear", oscillator: "triangle" },
  co2: { note: 294, season: "summer", weather: "heat", oscillator: "sine" },
  methane: { note: 220, season: "fall", weather: "rain", oscillator: "triangle" },
};

export function signalFrequency(note: number, year: number, season: SeasonId, weather: WeatherId): number {
  return Math.max(90, note + (year - 1958) * 1.05 + SEASON_SHIFT[season] + WEATHER_SHIFT[weather]);
}

export function emptyMix(): (MixSlot | null)[] {
  return Array.from({ length: MIX_SLOT_COUNT }, () => null);
}

export function slotLabel(slot: MixSlot | null): string {
  if (!slot) return "Empty";
  if (slot.source === "region") return regionById(slot.id).name;
  return LAYERS.find((layer) => layer.id === slot.id)?.label ?? slot.id;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(rng: () => number, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap];
    copy[swap] = current;
  }
  return copy;
}

function layerLabel(layer: LayerId): string {
  return LAYERS.find((item) => item.id === layer)?.label ?? layer;
}

export function buildGuessRounds(count: number, rng: () => number): GuessRound[] {
  return Array.from({ length: count }, (_, index) => {
    const kind: GuessKind = index % 2 === 0 ? "region" : "layer";
    const region = MAP_REGIONS[Math.floor(rng() * MAP_REGIONS.length)];
    const layer = LAYERS[Math.floor(rng() * LAYERS.length)].id;
    const season = SEASONS[Math.floor(rng() * SEASONS.length)];
    const weather = WEATHERS[Math.floor(rng() * WEATHERS.length)];
    if (kind === "region") {
      const distractors = shuffle(rng, MAP_REGIONS.filter((item) => item.id !== region.id)).slice(0, 3);
      const choices = shuffle(rng, [region, ...distractors]).map((item) => ({ id: item.id, label: item.name }));
      return {
        kind,
        regionId: region.id,
        layer,
        season,
        weather,
        choices,
        answerId: region.id,
        prompt: `${layerLabel(layer)} · ${season} · ${weather}`,
      };
    }
    return {
      kind,
      regionId: region.id,
      layer,
      season,
      weather,
      choices: shuffle(rng, LAYERS.map((item) => ({ id: item.id, label: item.label }))),
      answerId: layer,
      prompt: region.name,
    };
  });
}

function noteForSlot(slot: MixSlot): { frequency: number; oscillator: "sine" | "triangle" } {
  if (slot.source === "region") {
    const region = regionById(slot.id);
    return { frequency: signalFrequency(region.note, 2020, "summer", "clear"), oscillator: "sine" };
  }
  const signature = LAYER_SIGNATURE[slot.id as LayerId];
  return {
    frequency: signalFrequency(signature.note, 2020, signature.season, signature.weather),
    oscillator: signature.oscillator,
  };
}

export function scheduleMix(slots: readonly (MixSlot | null)[], bpm: number): MixPlan {
  const tempo = Math.min(160, Math.max(60, Math.round(bpm)));
  const beat = 60 / tempo;
  const notes: MixNote[] = [];
  slots.forEach((slot, index) => {
    if (!slot) return;
    const spec = noteForSlot(slot);
    notes.push({
      time: index * beat,
      frequency: spec.frequency,
      duration: Math.max(0.12, beat * 0.82),
      oscillator: spec.oscillator,
      slotIndex: index,
    });
  });
  return { notes, duration: MIX_SLOT_COUNT * beat + 0.5, bpm: tempo };
}

export function encodeMix(slots: readonly (MixSlot | null)[], bpm: number): string {
  const body = slots
    .map((slot) => (slot ? `${slot.source === "region" ? "r" : "l"}.${slot.id}` : "-"))
    .join(",");
  return `${Math.round(bpm)}~${body}`;
}

export function decodeMix(raw: string): { slots: (MixSlot | null)[]; bpm: number } | null {
  const separator = raw.indexOf("~");
  if (separator <= 0) return null;
  const bpm = Number(raw.slice(0, separator));
  if (!Number.isInteger(bpm) || bpm < 60 || bpm > 160) return null;
  const parts = raw.slice(separator + 1).split(",");
  if (parts.length !== MIX_SLOT_COUNT) return null;
  const slots: (MixSlot | null)[] = [];
  for (const part of parts) {
    if (part === "-") {
      slots.push(null);
      continue;
    }
    const dot = part.indexOf(".");
    if (dot <= 0) return null;
    const kind = part.slice(0, dot);
    const id = part.slice(dot + 1);
    if (kind === "r" && MAP_REGIONS.some((region) => region.id === id)) {
      slots.push({ source: "region", id });
      continue;
    }
    if (kind === "l" && LAYERS.some((layer) => layer.id === id)) {
      slots.push({ source: "layer", id });
      continue;
    }
    return null;
  }
  return { slots, bpm };
}

export function scoreGain(streakAfter: number): number {
  return 100 + (streakAfter - 1) * 25;
}
