/**
 * Fritsch–Carlson monotone cubic in x, the same construction as
 * d3's curveMonotoneX. The path passes through every point, and a
 * segment does not leave the y-range of its endpoints.
 */
export function monotonePath(points: readonly [number, number][]): string {
  const n = points.length;
  if (n < 2) return "";
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
  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const c1x = points[i][0] + dx[i] / 3;
    const c1y = points[i][1] + (tangent[i] * dx[i]) / 3;
    const c2x = points[i + 1][0] - dx[i] / 3;
    const c2y = points[i + 1][1] - (tangent[i + 1] * dx[i]) / 3;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${points[i + 1][0].toFixed(2)} ${points[i + 1][1].toFixed(2)}`;
  }
  return d;
}

export type CurveSample = { readonly x: number; readonly y: number | null };

/** Filled samples keep their y. Rests interpolate between the nearest filled neighbors, and the ends hold. */
export function curveThroughSamples(samples: readonly CurveSample[], width: number): string {
  if (samples.length < 2 || !(width > 1)) return "";
  const known = samples.map((sample) => sample.y);
  if (!known.some((y) => y !== null)) return "";
  const ys = known.map((y, index) => {
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
  const points = samples.map((sample, index) => [sample.x, ys[index]] as [number, number]);
  const first = points[0];
  const last = points[points.length - 1];
  return monotonePath([
    [0, first[1]],
    ...points,
    [width, last[1]],
  ]);
}

/** Fallback before the plot has been measured. 0–100 bar heights in an 800×200 viewBox. */
export function sequencePath(heights: readonly number[]): string {
  const width = 800;
  const plot = 200;
  const yFor = (value: number) => plot * (1 - value / 100);
  const samples = heights.map((value, index) => ({
    x: ((index + 0.5) / heights.length) * width,
    y: value > 0 ? yFor(value) : null,
  }));
  return curveThroughSamples(samples, width);
}
