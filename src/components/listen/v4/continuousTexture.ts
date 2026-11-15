import type { VariationId } from "./model";

/** Sustained harmonics become more prominent as the view gets closer. */
export function continuousTexture(input: {
  frequency: number;
  detail: number;
  ambience: boolean;
  tempo: number;
  layerCutoff: number;
  variation: VariationId;
}) {
  const detail = Math.max(0, Math.min(1, input.detail));
  const brightness = input.variation === "bright" ? 1.4 : input.variation === "deep" ? 0.7 : 1;
  return {
    // Root, lower octave, fifth and upper octave retain a stable musical anchor.
    frequencies: [input.frequency, input.frequency / 2, input.frequency * 1.5, input.frequency * 2],
    levels: [-8, input.ambience ? -17 : -27, -38 + detail * 23, -44 + detail * 25],
    cutoff: Math.min(7200, (input.layerCutoff * 0.3 + detail * 4400) * brightness),
    reverb: (input.ambience ? 0.42 : 0.28) * (1 - detail * 0.85),
    // Shallow movement never gates the continuous sound off.
    motionHz: 0.1 * Math.max(0.5, Math.min(2, input.tempo)),
  };
}
