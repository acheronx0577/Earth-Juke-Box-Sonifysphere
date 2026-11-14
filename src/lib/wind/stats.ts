import { placeCells, type GridSpec } from "@/lib/live/geo";
import type { LivePlace, WindStats } from "@/lib/live/types";
import { HEIGHT, WIDTH, type WindField } from "@/lib/wind/field";

export const WIND_GRID: GridSpec = {
  lats: Array.from({ length: HEIGHT }, (_, row) => 90 - row),
  lons: Array.from({ length: WIDTH }, (_, col) => col - 180),
  dLat: 1,
  dLon: 1,
};

/**
 * Box statistics from the same 1° field the particles use (Wind-Report §4):
 * S̄ = Σw·|V|/Σw, ū, v̄ = Σw·u/Σw …, direction (from) = atan2(−ū, −v̄), R = V/S̄, gustiness = σ_S/S̄.
 * Weights are cos(lat) × fraction of the 1° cell inside the box (see src/lib/live/geo.ts).
 */
export function windStats(field: WindField, place: LivePlace): (WindStats & { cells: number }) | null {
  const cells = placeCells(WIND_GRID, place);
  let w = 0;
  let s = 0;
  let s2 = 0;
  let su = 0;
  let sv = 0;
  let max = 0;
  let used = 0;
  for (const cell of cells) {
    const index = cell.i * WIDTH + cell.j;
    const u = field.u[index];
    const v = field.v[index];
    if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
    const speed = Math.hypot(u, v);
    w += cell.w;
    s += cell.w * speed;
    s2 += cell.w * speed * speed;
    su += cell.w * u;
    sv += cell.w * v;
    max = Math.max(max, speed);
    used += 1;
  }
  if (w === 0) return null;
  const mean = s / w;
  const ub = su / w;
  const vb = sv / w;
  const vector = Math.hypot(ub, vb);
  const sd = Math.sqrt(Math.max(0, s2 / w - mean * mean));
  return {
    meanSpeed: mean,
    vectorSpeed: vector,
    directionFrom: ((Math.atan2(-ub, -vb) * 180) / Math.PI + 360) % 360,
    steadiness: mean > 0 ? vector / mean : 1,
    gustiness: mean > 0 ? sd / mean : 0,
    maxSpeed: max,
    validUtc: field.meta.validUtc,
    sourceKind: field.meta.kind,
    cells: used,
  };
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export function compass(deg: number): string {
  return POINTS[Math.round(deg / 22.5) % 16];
}
