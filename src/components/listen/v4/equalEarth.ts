/** Equal Earth projection (Šavrič, Patterson, Jenny). ViewBox is 0 0 1000 520. */

const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const SQRT3 = Math.sqrt(3);
const SCALE = 158;
const CX = 500;
const CY = 262;

export const MAP_VIEW = { width: 1000, height: 520 };

export function project(lng: number, lat: number): [number, number] {
  const lambda = (lng * Math.PI) / 180;
  const phi = (Math.max(-89, Math.min(89, lat)) * Math.PI) / 180;
  const theta = Math.asin((SQRT3 / 2) * Math.sin(phi));
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  const denom = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2);
  const x = (2 * SQRT3 * lambda * Math.cos(theta)) / (3 * denom);
  const y = A4 * theta * t2 * t6 + A3 * theta * t6 + A2 * theta * t2 + A1 * theta;
  return [CX + x * SCALE, CY - y * SCALE];
}

export function unproject(x: number, y: number): [number, number] | null {
  const px = (x - CX) / SCALE;
  const py = (CY - y) / SCALE;
  let theta = py;
  for (let step = 0; step < 14; step += 1) {
    const t2 = theta * theta;
    const t6 = t2 * t2 * t2;
    const f = theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) - py;
    const fp = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2);
    if (Math.abs(fp) < 1e-8) break;
    theta -= f / fp;
  }
  const cos = Math.cos(theta);
  if (Math.abs(cos) < 1e-6) return null;
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  const denom = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2);
  const lambda = (px * 3 * denom) / (2 * SQRT3 * cos);
  const sinPhi = Math.sin(theta) * (2 / SQRT3);
  if (sinPhi < -1 || sinPhi > 1 || Math.abs(lambda) > Math.PI + 0.05) return null;
  return [(lambda * 180) / Math.PI, (Math.asin(sinPhi) * 180) / Math.PI];
}

export function ringPath(ring: readonly (readonly number[])[], stride = 1): string {
  let d = "";
  let open = false;
  let prevLng = 0;
  for (let index = 0; index < ring.length; index += stride) {
    const point = ring[index];
    if (!point) continue;
    const lng = point[0];
    const lat = point[1];
    if (open && Math.abs(lng - prevLng) > 180) open = false;
    const [x, y] = project(lng, lat);
    d += `${open ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    open = true;
    prevLng = lng;
  }
  return open ? `${d}Z` : "";
}
