export function chamferClip(px: number): string {
  return `polygon(${px}px 0, calc(100% - ${px}px) 0, 100% ${px}px, 100% calc(100% - ${px}px), calc(100% - ${px}px) 100%, ${px}px 100%, 0 calc(100% - ${px}px), 0 ${px}px)`;
}

export type ChamferSides = "all" | "leading" | "trailing";

/**
 * Centerline for a stroke whose outer edge is a 45° chamfer.
 *
 * This is the same construction as the Challenges prev/next octagon:
 * the path is inset by half the stroke, and each cut starts at
 * `cut + half * (√2 − 1)` so the miter lands on the corner.
 *
 * A CSS border or inset shadow is rectangular. `clip-path` then cuts
 * those corners off, so the line stops at the diagonal instead of
 * following it. Draw this path with a non-scaling stroke instead.
 *
 * `leading` and `trailing` leave the inner edge open so two controls
 * can meet (the phone timeline and its date).
 */
export function chamferPoints(
  w: number,
  h: number,
  cut: number,
  stroke = 1.5,
  sides: ChamferSides = "all",
): { points: string; closed: boolean } {
  if (!(w > 1) || !(h > 1)) return { points: "", closed: sides === "all" };
  const half = stroke / 2;
  const limit = Math.min(w, h) / 2 - 0.25;
  const join = Math.min(Math.max(cut, 0) + half * (Math.SQRT2 - 1), Math.max(half, limit));
  const left = half;
  const top = half;
  const right = w - half;
  const bottom = h - half;
  const fmt = (pts: ReadonlyArray<readonly [number, number]>) =>
    pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

  if (sides === "leading") {
    return {
      closed: false,
      points: fmt([
        [w, top],
        [join, top],
        [left, join],
        [left, h - join],
        [join, bottom],
        [w, bottom],
        [w, top],
      ]),
    };
  }

  if (sides === "trailing") {
    return {
      closed: false,
      points: fmt([
        [0, bottom],
        [w - join, bottom],
        [right, h - join],
        [right, join],
        [w - join, top],
        [0, top],
      ]),
    };
  }

  return {
    closed: true,
    points: fmt([
      [join, top],
      [w - join, top],
      [right, join],
      [right, h - join],
      [w - join, bottom],
      [join, bottom],
      [left, h - join],
      [left, join],
    ]),
  };
}
