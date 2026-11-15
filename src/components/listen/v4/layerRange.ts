/**
 * Physical ranges used to place a matched reading on a 0–1 sound control.
 * Pitch follows this number in the Listen hearing engine (`base + value * span`).
 * A missing reading stays null and is never treated as 0.
 */
export const LAYER_SOUND_RANGES = {
  temperature: { min: -50, max: 50, unit: "°C", quantity: "Land surface temperature" },
  air: { min: -50, max: 50, unit: "°C", quantity: "Air temperature" },
  currents: { min: 0, max: 3, unit: "m/s", quantity: "Ocean current speed" },
  wind: { min: 0, max: 40, unit: "m/s", quantity: "Wind speed" },
} as const;

export type SoundLayerId = keyof typeof LAYER_SOUND_RANGES;

export function isSoundLayer(layer: string): layer is SoundLayerId {
  return Object.hasOwn(LAYER_SOUND_RANGES, layer);
}

/** Parses a scalar reading. Empty, blank, NaN, and non-numeric text are null. */
export function readingNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const token = value.trim().split(/\s+/, 1)[0] ?? "";
  if (!token || !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token)) return null;
  const number = Number(token);
  return Number.isFinite(number) ? number : null;
}

/** Clamps a finite reading into 0–1 for its layer. Null stays null. */
export function mapLayerToSound(layer: SoundLayerId, value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const range = LAYER_SOUND_RANGES[layer];
  const span = range.max - range.min;
  if (!(span > 0)) return null;
  return Math.min(1, Math.max(0, (value - range.min) / span));
}
