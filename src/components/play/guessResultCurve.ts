import type { LayerId, SeasonId, WeatherId } from "../../data/exploreMap";
import { GISTEMP_MONTHLY, LISTEN_ONI, MAUNA_LOA_CO2, NOAA_METHANE, NSIDC_SEA_ICE } from "./guessRecords";

export interface ResultClip {
  readonly regionId: string;
  readonly layer: LayerId;
  readonly season: SeasonId;
  readonly weather: WeatherId;
}

export interface SignalRecord {
  readonly id: string;
  readonly source: string;
  readonly values: readonly number[];
}

const OCEAN_TEMPERATURE = new Set(["pacific", "atlantic", "indian", "nino34"]);

/** The embedded measurement series behind this clip. */
export function recordForClip(clip: ResultClip): SignalRecord {
  if (clip.layer === "sea-ice") {
    return {
      id: "nsidc-sea-ice",
      source: "NSIDC Sea Ice Index annual extent, embedded landing sparkline (48 years). The line falls as extent falls.",
      values: NSIDC_SEA_ICE,
    };
  }
  if (clip.layer === "methane") {
    return {
      id: "noaa-methane",
      source: "NOAA GML global monthly methane, embedded landing sparkline (516 months).",
      values: NOAA_METHANE,
    };
  }
  if (clip.layer === "co2") {
    return {
      id: "mauna-loa-co2",
      source: "NOAA GML Mauna Loa monthly CO₂, embedded landing sparkline (823 months, March 1958 through September 2026).",
      values: MAUNA_LOA_CO2,
    };
  }
  if (OCEAN_TEMPERATURE.has(clip.regionId)) {
    return {
      id: "listen-oni",
      source: "NOAA Oceanic Niño Index drawn on Listen (spark-line.svg). Ocean-temperature clips use this series.",
      values: LISTEN_ONI,
    };
  }
  return {
    id: "gistemp-v4",
    source: "NASA GISTEMP v4 monthly global surface anomaly, embedded landing sparkline (1761 months).",
    values: GISTEMP_MONTHLY,
  };
}

export const SERIES_NOTE_COUNT = 14;

/** Pitches whose contour matches the drawn series, low measurement to low note. */
export function seriesPitches(clip: ResultClip): number[] {
  const { values } = recordForClip(clip);
  const samples = resample(values, SERIES_NOTE_COUNT);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return samples.map((value) => Math.round(150 + ((value - min) / span) * 430));
}

function resample(values: readonly number[], count: number): number[] {
  if (values.length === 0) return [];
  if (values.length === 1 || count <= 1) return [values[0]];
  const out: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = (index * (values.length - 1)) / (count - 1);
    const left = Math.floor(t);
    const right = Math.min(values.length - 1, left + 1);
    const mix = t - left;
    out.push((values[left] ?? 0) * (1 - mix) + (values[right] ?? 0) * mix);
  }
  return out;
}

function cubicAt(p0: number, c1: number, c2: number, p1: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * p1;
}

function monotone(points: readonly [number, number][]): { d: string; samples: [number, number][] } {
  const n = points.length;
  if (n === 0) return { d: "", samples: [] };
  if (n === 1) return { d: `M ${points[0][0]} ${points[0][1]}`, samples: [[points[0][0], points[0][1]]] };
  const dx: number[] = [];
  const slope: number[] = [];
  const m = new Array<number>(n).fill(0);
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = points[i + 1][0] - points[i][0] || 1;
    slope[i] = (points[i + 1][1] - points[i][1]) / dx[i];
  }
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i += 1) {
    if (Math.abs(slope[i]) < 1e-6) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / slope[i];
      const b = m[i + 1] / slope[i];
      const h = a * a + b * b;
      if (h > 9) {
        const t = 3 / Math.sqrt(h);
        m[i] = t * a * slope[i];
        m[i + 1] = t * b * slope[i];
      }
    }
  }
  let d = `M ${points[0][0]} ${points[0][1]}`;
  const samples: [number, number][] = [[points[0][0], points[0][1]]];
  for (let i = 0; i < n - 1; i += 1) {
    const c1x = points[i][0] + dx[i] / 3;
    const c1y = points[i][1] + (m[i] * dx[i]) / 3;
    const c2x = points[i + 1][0] - dx[i] / 3;
    const c2y = points[i + 1][1] - (m[i + 1] * dx[i]) / 3;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${points[i + 1][0]} ${points[i + 1][1]}`;
    for (let step = 1; step <= 8; step += 1) {
      const t = step / 8;
      samples.push([
        cubicAt(points[i][0], c1x, c2x, points[i + 1][0], t),
        cubicAt(points[i][1], c1y, c2y, points[i + 1][1], t),
      ]);
    }
  }
  return { d, samples };
}

export function curveY(samples: readonly [number, number][], x: number): number {
  if (samples.length === 0) return VIEW_H / 2;
  if (x <= samples[0][0]) return samples[0][1];
  const last = samples[samples.length - 1];
  if (x >= last[0]) return last[1];
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid][0] <= x) lo = mid;
    else hi = mid;
  }
  const [x0, y0] = samples[lo];
  const [x1, y1] = samples[hi];
  return y0 + ((x - x0) / (x1 - x0 || 1)) * (y1 - y0);
}

const VIEW_W = 240;
const VIEW_H = 64;
const PLOT_HIGH = 8;
const PLOT_LOW = 56;

export interface DrawnCurve {
  readonly d: string;
  readonly fill: string;
  readonly samples: readonly [number, number][];
}

function curvePath(values: readonly number[]): DrawnCurve {
  const count = Math.min(220, Math.max(values.length, 2));
  const samples = resample(values, count);
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const span = max - min || 1;
  const points = samples.map((value, index) => {
    const x = (index / (samples.length - 1)) * VIEW_W;
    const t = (value - min) / span;
    const y = PLOT_LOW - t * (PLOT_LOW - PLOT_HIGH);
    return [x, y] as [number, number];
  });
  const built = monotone(points);
  return { d: built.d, fill: `${built.d} L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z`, samples: built.samples };
}

/** One path per clip, from that clip's embedded measurement series. */
export function drawResultCurves(clips: readonly ResultClip[]): DrawnCurve[] {
  return clips.map((clip) => curvePath(recordForClip(clip).values));
}

export function resultCurvePaths(clips: readonly ResultClip[]): string[] {
  return drawResultCurves(clips).map((curve) => curve.d);
}

export const RESULT_CURVE_VIEW = { width: VIEW_W, height: VIEW_H };
