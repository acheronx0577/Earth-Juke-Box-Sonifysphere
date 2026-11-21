import { regionById, type LayerId, type SeasonId, type WeatherId } from "../../data/exploreMap";

const SEASON_SHIFT: Record<SeasonId, number> = { spring: 0, summer: 36, fall: -12, winter: -48 };
const WEATHER_SHIFT: Record<WeatherId, number> = { clear: 0, rain: -8, storm: -28, heat: 64 };

/** Same mapping as signalFrequency in signalTheory.ts. */
function signalFrequency(note: number, year: number, season: SeasonId, weather: WeatherId): number {
  return Math.max(90, note + (year - 1958) * 1.05 + SEASON_SHIFT[season] + WEATHER_SHIFT[weather]);
}

/**
 * The four years playRegionPhrase actually sounds, in order.
 * Kept beside the result curve so each card plots that clip, not a shared silhouette.
 */
export const RESULT_PHRASE_YEARS = [1968, 1988, 2006, 2024] as const;

/**
 * Added after the shared floor, matching triggerExploreNote in exploreAudio.
 * Season, weather, and the region note already live in signalFrequency.
 */
const LAYER_SHIFT: Record<LayerId, number> = {
  temperature: 0,
  co2: 48,
  methane: -36,
  "sea-ice": -24,
};

export interface ResultClip {
  readonly regionId: string;
  readonly layer: LayerId;
  readonly season: SeasonId;
  readonly weather: WeatherId;
}

/** Pitch of each note in the clip, same formula the synth plays. */
export function heardPhraseFreqs(clip: ResultClip): number[] {
  const note = regionById(clip.regionId).note;
  return RESULT_PHRASE_YEARS.map((year) => {
    const freq = signalFrequency(note, year, clip.season, clip.weather);
    return Math.max(90, freq + LAYER_SHIFT[clip.layer]);
  });
}

function plotY(freq: number, min: number, max: number, high: number, low: number): number {
  const span = Math.max(1, max - min);
  const t = Math.min(1, Math.max(0, (freq - min) / span));
  const eased = 1 - (1 - t) ** 1.9;
  return low - eased * (low - high);
}

function extendLevel(points: readonly [number, number][], left: number, right: number, floor: number): [number, number][] {
  const clampY = (y: number) => Math.min(y, floor);
  const leftSlope = (points[1][1] - points[0][1]) / (points[1][0] - points[0][0]);
  const last = points.length - 1;
  const rightSlope = (points[last][1] - points[last - 1][1]) / (points[last][0] - points[last - 1][0]);
  return [
    [left, clampY(points[0][1] - leftSlope * (points[0][0] - left))],
    ...points.map(([x, y]) => [x, clampY(y)] as [number, number]),
    [right, clampY(points[last][1] + rightSlope * (right - points[last][0]))],
  ];
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
const PLOT_HIGH = 14;
const PLOT_LOW = 50;
const PLOT_FLOOR = 58;

export interface DrawnCurve {
  readonly d: string;
  readonly fill: string;
  readonly samples: readonly [number, number][];
}

function curvePath(freqs: readonly number[], min: number, max: number): DrawnCurve {
  const step = (VIEW_W - 32) / Math.max(1, freqs.length - 1);
  const points = freqs.map((freq, index) => [16 + index * step, plotY(freq, min, max, PLOT_HIGH, PLOT_LOW)] as [number, number]);
  const built = monotone(extendLevel(points, 0, VIEW_W, PLOT_FLOOR));
  return { d: built.d, fill: `${built.d} L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z`, samples: built.samples };
}

/**
 * One path per clip, drawn on a single frequency scale.
 * Normalizing each clip to its own min and max erases the note, season,
 * weather, and layer: those are constant offsets, and the year slope is shared,
 * so every card became the same curve.
 */
export function drawResultCurves(clips: readonly ResultClip[]): DrawnCurve[] {
  const series = clips.map(heardPhraseFreqs);
  const values = series.flat();
  if (values.length === 0) return [];
  let min = Math.min(...values);
  let max = Math.max(...values);
  const span = Math.max(24, max - min);
  const mid = (min + max) / 2;
  min = mid - span / 2;
  max = mid + span / 2;
  const pad = (max - min) * 0.14;
  return series.map((freqs) => curvePath(freqs, min - pad, max + pad));
}

export function resultCurvePaths(clips: readonly ResultClip[]): string[] {
  return drawResultCurves(clips).map((curve) => curve.d);
}

export const RESULT_CURVE_VIEW = { width: VIEW_W, height: VIEW_H };
