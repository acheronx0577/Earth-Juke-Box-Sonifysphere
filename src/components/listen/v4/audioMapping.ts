import type { VariationId } from "@/components/listen/v4/model";

const VARIATION_RANGES: Record<VariationId, { base: number; span: number }> = {
  deep: { base: 98, span: 180 },
  soft: { base: 196, span: 320 },
  bright: { base: 294, span: 520 },
};

export function frequencyForValue(value: number | null, variation: VariationId): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const { base, span } = VARIATION_RANGES[variation];
  return base + Math.min(1, Math.max(0, value)) * span;
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
