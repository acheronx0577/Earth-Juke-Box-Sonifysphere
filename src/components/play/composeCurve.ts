/**
 * Fritsch–Carlson monotone cubic in x, the same construction as
 * d3's curveMonotoneX. The path passes through every point, and a
 * segment does not leave the y-range of its endpoints.
 */
export type CubicSegment = {
  readonly x0: number;
  readonly y0: number;
  readonly c1x: number;
  readonly c1y: number;
  readonly c2x: number;
  readonly c2y: number;
  readonly x1: number;
  readonly y1: number;
};

export type CurveSample = {
  readonly x: number;
  readonly y: number | null;
  readonly left: number;
  readonly right: number;
};

export type CurveModel = {
  readonly d: string;
  readonly bars: readonly { readonly index: number; readonly d: string }[];
};

function monotoneSegments(points: readonly [number, number][]): CubicSegment[] {
  const n = points.length;
  if (n < 2) return [];
  const dx: number[] = [];
  const slope: number[] = [];
  const tangent = new Array<number>(n).fill(0);
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = points[i + 1][0] - points[i][0] || 1;
    slope[i] = (points[i + 1][1] - points[i][1]) / dx[i];
  }
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i += 1) {
    if (Math.abs(slope[i]) < 1e-6) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
    } else {
      const a = tangent[i] / slope[i];
      const b = tangent[i + 1] / slope[i];
      const size = a * a + b * b;
      if (size > 9) {
        const scale = 3 / Math.sqrt(size);
        tangent[i] = scale * a * slope[i];
        tangent[i + 1] = scale * b * slope[i];
      }
    }
  }
  const segments: CubicSegment[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    segments.push({
      x0: points[i][0],
      y0: points[i][1],
      c1x: points[i][0] + dx[i] / 3,
      c1y: points[i][1] + (tangent[i] * dx[i]) / 3,
      c2x: points[i + 1][0] - dx[i] / 3,
      c2y: points[i + 1][1] - (tangent[i + 1] * dx[i]) / 3,
      x1: points[i + 1][0],
      y1: points[i + 1][1],
    });
  }
  return segments;
}

function fmt(value: number): string {
  return value.toFixed(2);
}

function pathFromSegments(segments: readonly CubicSegment[]): string {
  const first = segments[0];
  if (!first) return "";
  let d = `M ${fmt(first.x0)} ${fmt(first.y0)}`;
  for (const segment of segments) {
    d += ` C ${fmt(segment.c1x)} ${fmt(segment.c1y)} ${fmt(segment.c2x)} ${fmt(segment.c2y)} ${fmt(segment.x1)} ${fmt(segment.y1)}`;
  }
  return d;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function splitSegment(segment: CubicSegment, t: number): [CubicSegment, CubicSegment] {
  const x01 = lerp(segment.x0, segment.c1x, t);
  const y01 = lerp(segment.y0, segment.c1y, t);
  const x12 = lerp(segment.c1x, segment.c2x, t);
  const y12 = lerp(segment.c1y, segment.c2y, t);
  const x23 = lerp(segment.c2x, segment.x1, t);
  const y23 = lerp(segment.c2y, segment.y1, t);
  const x012 = lerp(x01, x12, t);
  const y012 = lerp(y01, y12, t);
  const x123 = lerp(x12, x23, t);
  const y123 = lerp(y12, y23, t);
  const x = lerp(x012, x123, t);
  const y = lerp(y012, y123, t);
  return [
    { x0: segment.x0, y0: segment.y0, c1x: x01, c1y: y01, c2x: x012, c2y: y012, x1: x, y1: y },
    { x0: x, y0: y, c1x: x123, c1y: y123, c2x: x23, c2y: y23, x1: segment.x1, y1: segment.y1 },
  ];
}

function segmentX(segment: CubicSegment, t: number): number {
  const u = 1 - t;
  return u * u * u * segment.x0 + 3 * u * u * t * segment.c1x + 3 * u * t * t * segment.c2x + t * t * t * segment.x1;
}

function tAtX(segment: CubicSegment, x: number): number {
  if (x <= segment.x0) return 0;
  if (x >= segment.x1) return 1;
  let lo = 0;
  let hi = 1;
  for (let step = 0; step < 28; step += 1) {
    const mid = (lo + hi) / 2;
    if (segmentX(segment, mid) < x) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function sliceSegment(segment: CubicSegment, left: number, right: number): CubicSegment | null {
  if (right <= segment.x0 + 0.01 || left >= segment.x1 - 0.01) return null;
  const t0 = tAtX(segment, Math.max(left, segment.x0));
  const t1 = tAtX(segment, Math.min(right, segment.x1));
  if (t1 - t0 < 1e-4) return null;
  let piece = segment;
  if (t0 > 1e-4) piece = splitSegment(piece, t0)[1];
  if (t1 < 1 - 1e-4) {
    const local = t0 > 1e-4 ? (t1 - t0) / (1 - t0) : t1;
    piece = splitSegment(piece, Math.min(1, Math.max(0, local)))[0];
  }
  return piece;
}

/** Closed shape whose top edge is the curve between left and right, from the same cubics as the line. */
export function barUnderCurve(segments: readonly CubicSegment[], left: number, right: number, bottom: number): string {
  const pieces = segments.flatMap((segment) => {
    const piece = sliceSegment(segment, left, right);
    return piece ? [piece] : [];
  });
  const start = pieces[0];
  const end = pieces[pieces.length - 1];
  if (!start || !end) return "";
  let d = `M ${fmt(start.x0)} ${fmt(start.y0)}`;
  for (const piece of pieces) {
    d += ` C ${fmt(piece.c1x)} ${fmt(piece.c1y)} ${fmt(piece.c2x)} ${fmt(piece.c2y)} ${fmt(piece.x1)} ${fmt(piece.y1)}`;
  }
  d += ` L ${fmt(end.x1)} ${fmt(bottom)} L ${fmt(start.x0)} ${fmt(bottom)} Z`;
  return d;
}

function resolvedYs(samples: readonly CurveSample[]): number[] | null {
  const known = samples.map((sample) => sample.y);
  if (!known.some((y) => y !== null)) return null;
  return known.map((y, index) => {
    if (y !== null) return y;
    let previous = -1;
    let next = -1;
    for (let i = index - 1; i >= 0; i -= 1) {
      if (known[i] !== null) {
        previous = i;
        break;
      }
    }
    for (let i = index + 1; i < known.length; i += 1) {
      if (known[i] !== null) {
        next = i;
        break;
      }
    }
    if (previous >= 0 && next >= 0) {
      const span = next - previous;
      const t = (index - previous) / span;
      return known[previous]! + (known[next]! - known[previous]!) * t;
    }
    if (previous >= 0) return known[previous]!;
    if (next >= 0) return known[next]!;
    return 0;
  });
}

/** Line plus one filled shape per occupied slot. Both use the same cubics. */
export function curveModel(samples: readonly CurveSample[], width: number, bottom: number): CurveModel {
  if (samples.length < 2 || !(width > 1)) return { d: "", bars: [] };
  const ys = resolvedYs(samples);
  if (!ys) return { d: "", bars: [] };
  const points = samples.map((sample, index) => [sample.x, ys[index]] as [number, number]);
  const first = points[0] ?? [0, bottom];
  const last = points[points.length - 1] ?? first;
  const segments = monotoneSegments([
    [0, first[1]],
    ...points,
    [width, last[1]],
  ]);
  const bars = samples.flatMap((sample, index) => {
    if (sample.y === null) return [];
    const d = barUnderCurve(segments, sample.left, sample.right, bottom);
    return d ? [{ index, d }] : [];
  });
  return { d: pathFromSegments(segments), bars };
}

/** Equal columns in an 800×200 plot, used before the screen positions are measured. */
export function fallbackModel(heights: readonly number[]): CurveModel {
  const width = 800;
  const bottom = 200;
  const count = Math.max(1, heights.length);
  const slot = width / count;
  const samples = heights.map((value, index) => {
    const x = (index + 0.5) * slot;
    const half = (slot * 0.35) / 2;
    return {
      x,
      y: value > 0 ? bottom * (1 - value / 100) : null,
      left: x - half,
      right: x + half,
    };
  });
  return curveModel(samples, width, bottom);
}
