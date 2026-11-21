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

function monotone(points: readonly [number, number][]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0][0]} ${points[0][1]}`;
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
  for (let i = 0; i < n - 1; i += 1) {
    const c1x = points[i][0] + dx[i] / 3;
    const c1y = points[i][1] + (m[i] * dx[i]) / 3;
    const c2x = points[i + 1][0] - dx[i] / 3;
    const c2y = points[i + 1][1] - (m[i + 1] * dx[i]) / 3;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${points[i + 1][0]} ${points[i + 1][1]}`;
  }
  return d;
}

const VIEW_W = 240;
const VIEW_H = 64;
const PLOT_HIGH = 14;
const PLOT_LOW = 50;
const PLOT_FLOOR = 58;

function curvePath(freqs: readonly number[], min: number, max: number): string {
  const step = (VIEW_W - 32) / Math.max(1, freqs.length - 1);
  const points = freqs.map((freq, index) => [16 + index * step, plotY(freq, min, max, PLOT_HIGH, PLOT_LOW)] as [number, number]);
  return monotone(extendLevel(points, 0, VIEW_W, PLOT_FLOOR));
}

/**
 * One path per clip, drawn on a single frequency scale.
 * Normalizing each clip to its own min and max erases the note, season,
 * weather, and layer: those are constant offsets, and the year slope is shared,
 * so every card became the same curve.
 */
export function resultCurvePaths(clips: readonly ResultClip[]): string[] {
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

export const RESULT_CURVE_VIEW = { width: VIEW_W, height: VIEW_H };
