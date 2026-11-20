/**
 * Physical ranges used to place a matched reading on a 0–1 sound control.
 * Pitch follows this number in the Listen hearing engine (`base + value * span`).
 * A missing reading stays null and is never treated as 0.
 *
 * Precipitation is the NASA POWER PRECTOTCORR annual mean in mm/day.
 * 0 is a dry desert. 12 mm/day is 4380 mm/year, above the Amazon basin
 * mean on this grid (~6.5 mm/day, ~2370 mm/year) and above Mawsynram
 * (~8.3 mm/day). Seattle (~3.4 mm/day) and the Amazon therefore sit on
 * different notes. Only wetter orographic cells, such as the Chocó
 * Pacific coast (~17 mm/day), share the top note.
 *
 * Elevation runs from the Dead Sea shore (−430 m) to Everest (8,849 m).
 * A linear map puts sea level at about 0.05 and every coastal plain on the
 * same note. The square root of that position stretches the bottom: sea
 * level is about 0.22, 500 m is about 0.32, and the summit stays at 1.
 * Ocean and sea level are low notes, not missing data.
 */
export const LAYER_SOUND_RANGES = {
  temperature: { min: -50, max: 50, unit: "°C", quantity: "Land surface temperature" },
  air: { min: -50, max: 50, unit: "°C", quantity: "Air temperature" },
  "sea-temp": { min: -2, max: 35, unit: "°C", quantity: "Sea surface temperature" },
  currents: { min: 0, max: 3, unit: "m/s", quantity: "Ocean current speed" },
  wind: { min: 0, max: 40, unit: "m/s", quantity: "Wind speed" },
  precip: { min: 0, max: 12, unit: "mm/day", quantity: "Average annual precipitation" },
  elevation: { min: -430, max: 8849, unit: "m", quantity: "Elevation", curve: "sqrt" },
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
  const linear = Math.min(1, Math.max(0, (value - range.min) / span));
  if ("curve" in range && range.curve === "sqrt") return Math.sqrt(linear);
  return linear;
}

export function elevationValueLabel(meters: number): string {
  return `${Math.round(meters)} m`;
}

/** Yearly total from a PRECTOTCORR daily mean. POWER's ANN is mm/day. */
export function precipitationAnnualMm(mmPerDay: number): number {
  return Math.round(mmPerDay * 365);
}

export function precipitationValueLabel(mmPerDay: number): string {
  return `${mmPerDay.toFixed(2)} mm/day`;
}

export function precipitationDetail(mmPerDay: number): string {
  return `${precipitationAnnualMm(mmPerDay)} mm/yr · NASA POWER climatology`;
}
