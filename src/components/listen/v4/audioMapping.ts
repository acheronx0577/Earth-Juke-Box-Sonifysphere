import type { LayerId, PitchMode, VariationId } from "@/components/listen/v4/model";

const VARIATION_RANGES: Record<VariationId, { base: number; span: number }> = {
  deep: { base: 98, span: 180 },
  soft: { base: 196, span: 320 },
  bright: { base: 294, span: 520 },
};

export interface LayerTimbre {
  readonly oscillator: "sine" | "triangle" | "square" | "sawtooth";
  readonly filterHz: number;
  readonly label: string;
}

const LAYER_TIMBRES: Record<LayerId, LayerTimbre> = {
  all: { oscillator: "sine", filterHz: 1050, label: "soft sine · visual pattern" },
  temperature: { oscillator: "triangle", filterHz: 1350, label: "warm triangle · temperature" },
  "sea-ice": { oscillator: "sine", filterHz: 900, label: "soft sine · sea ice" },
  co2: { oscillator: "square", filterHz: 1050, label: "rounded square · CO₂" },
  methane: { oscillator: "sawtooth", filterHz: 760, label: "low sawtooth · methane" },
  air: { oscillator: "sawtooth", filterHz: 1900, label: "bright sawtooth · air temperature" },
  "sea-temp": { oscillator: "triangle", filterHz: 1500, label: "warm triangle · sea temperature" },
  currents: { oscillator: "sine", filterHz: 820, label: "rounded sine · currents" },
  wind: { oscillator: "sawtooth", filterHz: 2300, label: "bright sawtooth · wind" },
};

export function layerTimbreFor(layer: LayerId): LayerTimbre {
  return LAYER_TIMBRES[layer];
}

export function frequencyForValue(
  value: number | null,
  variation: VariationId,
  pitchMode: PitchMode = "continuous",
): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const { base, span } = VARIATION_RANGES[variation];
  const frequency = base + Math.min(1, Math.max(0, value)) * span;
  if (pitchMode === "continuous") return frequency;

  const targetMidi = 69 + 12 * Math.log2(frequency / 440);
  const firstMidi = Math.floor(69 + 12 * Math.log2(base / 440)) - 1;
  const lastMidi = Math.ceil(69 + 12 * Math.log2((base + span) / 440)) + 1;
  const pentatonicClasses = new Set([0, 2, 4, 7, 9]);
  let closestMidi = firstMidi;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let midi = firstMidi; midi <= lastMidi; midi += 1) {
    if (!pentatonicClasses.has(((midi % 12) + 12) % 12)) continue;
    const distance = Math.abs(midi - targetMidi);
    if (distance < closestDistance) {
      closestMidi = midi;
      closestDistance = distance;
    }
  }
  return 440 * 2 ** ((closestMidi - 69) / 12);
}

export function noteNameForFrequency(frequency: number): string {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const name = names[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export function intervalForTempo(tempo: number): number {
  return Math.max(140, Math.round(520 / Math.max(0.5, tempo)));
}
