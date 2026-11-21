import type { LayerId, SeasonId, WeatherId } from "../../data/exploreMap";
import { SIGNAL_BY_ID, type SignalSeries } from "../../data/signals/catalog";

export interface ResultClip {
  readonly regionId: string;
  readonly layer: LayerId;
  readonly season: SeasonId;
  readonly weather: WeatherId;
}

export interface SignalRecord {
  readonly id: string;
  readonly source: string;
  readonly url: string;
  readonly caption: string;
  readonly name: string;
  readonly unit: string;
  readonly years: readonly number[];
  readonly values: readonly number[];
}

const LAND: Record<string, string> = {
  africa: "ncei-africa",
  asia: "ncei-asia",
  europe: "ncei-europe",
  "north-america": "ncei-north-america",
  oceania: "ncei-oceania",
  "south-america": "ncei-south-america",
  arctic: "ncei-arctic",
  antarctica: "ncei-antarctic",
};

const OCEAN: Record<string, string> = {
  atlantic: "ersst-atlantic",
  pacific: "ersst-pacific-nino4",
  indian: "ersst-indian-dmi",
  nino34: "ersst-nino34",
};

function fromSeries(series: SignalSeries): SignalRecord {
  return {
    id: series.id,
    source: series.source,
    url: series.url,
    caption: series.caption,
    name: series.name,
    unit: series.unit,
    years: series.points.map((point) => point.year),
    values: series.points.map((point) => point.value),
  };
}

/** The measurement series this clip is actually made from. */
export function recordForClip(clip: ResultClip): SignalRecord {
  if (clip.layer === "sea-ice") return fromSeries(SIGNAL_BY_ID["nsidc-sea-ice"]);
  if (clip.layer === "methane") return fromSeries(SIGNAL_BY_ID["noaa-methane"]);
  if (clip.layer === "co2") return fromSeries(SIGNAL_BY_ID["mauna-loa-co2"]);
  const ocean = OCEAN[clip.regionId];
  if (ocean) return fromSeries(SIGNAL_BY_ID[ocean]);
  return fromSeries(SIGNAL_BY_ID[LAND[clip.regionId] ?? "ncei-oceania"]);
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
  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  const samples: [number, number][] = [[points[0][0], points[0][1]]];
  for (let i = 0; i < n - 1; i += 1) {
    const c1x = points[i][0] + dx[i] / 3;
    const c1y = points[i][1] + (m[i] * dx[i]) / 3;
    const c2x = points[i + 1][0] - dx[i] / 3;
    const c2y = points[i + 1][1] - (m[i + 1] * dx[i]) / 3;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${points[i + 1][0].toFixed(2)} ${points[i + 1][1].toFixed(2)}`;
    for (let step = 1; step <= 6; step += 1) {
      const t = step / 6;
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

const VIEW_W = 640;
const VIEW_H = 84;
const PLOT_HIGH = 10;
const PLOT_LOW = 70;

export interface CurveMark {
  readonly x: number;
  readonly y: number;
  readonly kind: "end" | "high" | "low";
}

export interface DrawnCurve {
  readonly d: string;
  readonly fill: string;
  readonly samples: readonly [number, number][];
  readonly marks: readonly CurveMark[];
}

function curvePath(record: SignalRecord): DrawnCurve {
  const count = Math.min(160, Math.max(record.values.length, 2));
  const samples = resample(record.values, count);
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
  const end = points[points.length - 1];
  let highIndex = 0;
  let lowIndex = 0;
  samples.forEach((value, index) => {
    if (value > samples[highIndex]) highIndex = index;
    if (value < samples[lowIndex]) lowIndex = index;
  });
  const falling = record.values[record.values.length - 1] < record.values[0];
  const extreme = points[falling ? lowIndex : highIndex];
  return {
    d: built.d,
    fill: `${built.d} L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z`,
    samples: built.samples,
    marks: [
      { x: extreme[0], y: extreme[1], kind: falling ? "low" : "high" },
      { x: end[0], y: end[1], kind: "end" },
    ],
  };
}

/** One path per clip, each on its own measurement scale. */
export function drawResultCurves(clips: readonly ResultClip[]): DrawnCurve[] {
  return clips.map((clip) => curvePath(recordForClip(clip)));
}

export function resultCurvePaths(clips: readonly ResultClip[]): string[] {
  return drawResultCurves(clips).map((curve) => curve.d);
}

export const RESULT_CURVE_VIEW = { width: VIEW_W, height: VIEW_H };

export interface SeriesStat {
  readonly year: number;
  readonly text: string;
}

export interface SeriesReadout {
  readonly caption: string;
  readonly source: string;
  readonly url: string;
  readonly name: string;
  readonly start: SeriesStat;
  readonly extreme: SeriesStat & { readonly kind: "high" | "low" };
  readonly end: SeriesStat;
}

function formatValue(record: SignalRecord, value: number): string {
  const series = SIGNAL_BY_ID[record.id];
  const digits = series?.digits ?? 1;
  const rounded = value.toFixed(digits);
  if (series?.signed) {
    const number = Number(rounded);
    const body = `${number > 0 ? "+" : ""}${number.toFixed(digits)}`;
    return record.unit === "°C" ? `${body}°` : `${body} ${record.unit}`;
  }
  return `${rounded} ${record.unit}`;
}

export function seriesReadout(clip: ResultClip): SeriesReadout {
  const record = recordForClip(clip);
  const first = 0;
  const last = record.values.length - 1;
  let extremeIndex = 0;
  const falling = record.values[last] < record.values[first];
  for (let index = 1; index < record.values.length; index += 1) {
    const better = falling ? record.values[index] < record.values[extremeIndex] : record.values[index] > record.values[extremeIndex];
    if (better) extremeIndex = index;
  }
  const stat = (index: number): SeriesStat => ({
    year: record.years[index] ?? 0,
    text: formatValue(record, record.values[index] ?? 0),
  });
  return {
    caption: record.caption,
    source: record.source,
    url: record.url,
    name: record.name,
    start: stat(first),
    extreme: { ...stat(extremeIndex), kind: falling ? "low" : "high" },
    end: stat(last),
  };
}
