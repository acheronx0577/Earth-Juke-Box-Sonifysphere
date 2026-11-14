export interface KeelingPath {
  readonly d: string;
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
}

function buildKeelingPath(amplitude: number): KeelingPath {
  const width = 1440;
  const height = 420;
  const count = 400;
  const parts: string[] = [];
  let startX = 12;
  let startY = height * 0.78;
  let endX = width - 12;
  let endY = height * 0.22;

  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    const x = 12 + t * (width - 24);
    const trend = height * 0.78 - t * (height * 0.56);
    const seasons = t * 68.166 * Math.PI * 2;
    const y = trend + Math.sin(seasons) * amplitude;
    if (index === 0) {
      startX = x;
      startY = y;
    }
    parts.push(`${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
    endX = x;
    endY = y;
  }

  return { d: parts.join(" "), startX, startY, endX, endY };
}

export const KEELING_AMP_4 = buildKeelingPath(4);
export const KEELING_AMP_8 = buildKeelingPath(8);
