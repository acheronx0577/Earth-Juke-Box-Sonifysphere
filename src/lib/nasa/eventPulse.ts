import type { EonetEvent } from "@/lib/nasa/eonet";

export type PulseInstrument = "sine" | "membrane" | "fm" | "noise";

export interface EventPulse {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly instrument: PulseInstrument;
  readonly frequency: number;
  readonly gain: number;
  readonly duration: number;
  readonly open: boolean;
}

const INSTRUMENT: Record<string, PulseInstrument> = {
  wildfires: "noise",
  severeStorms: "membrane",
  volcanoes: "fm",
  earthquakes: "membrane",
  floods: "sine",
  seaLakeIce: "sine",
  drought: "fm",
  dustHaze: "noise",
  landslides: "membrane",
  snow: "sine",
  tempExtremes: "fm",
  waterColor: "sine",
  manmade: "noise",
};

const FREQUENCY: Record<string, number> = {
  wildfires: 180,
  severeStorms: 90,
  volcanoes: 70,
  earthquakes: 55,
  floods: 240,
  seaLakeIce: 520,
  drought: 130,
  dustHaze: 160,
  landslides: 80,
  snow: 390,
  tempExtremes: 300,
  waterColor: 260,
  manmade: 150,
};

/** Loudness spans for units EONET actually publishes. Unknown units use 0–100. */
const UNIT_SPAN: Record<string, readonly [number, number]> = {
  kts: [0, 140],
  M: [0, 10],
  mag: [0, 10],
};

/** One pulse per event. Category picks the instrument. Magnitude, when present, picks loudness. */
export function pulsesForEvents(events: readonly EonetEvent[]): EventPulse[] {
  return events.map((event) => {
    const open = event.open;
    const base = gainFor(event.magnitude, event.magnitudeUnit);
    return {
      id: event.id,
      title: event.title,
      category: event.category,
      instrument: INSTRUMENT[event.category] ?? "sine",
      frequency: FREQUENCY[event.category] ?? 200,
      gain: open ? base : base * 0.6,
      duration: open ? 0.12 : 0.45,
      open,
    };
  });
}

function gainFor(magnitude: number | null, unit: string | null): number {
  if (magnitude === null || !Number.isFinite(magnitude)) return 0.45;
  const span = (unit && UNIT_SPAN[unit]) || [0, 100];
  const normalized = (magnitude - span[0]) / (span[1] - span[0] || 1);
  return 0.2 + Math.min(1, Math.max(0, normalized)) * 0.8;
}
