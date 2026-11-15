export type LegendKind = "diverging" | "sequential" | "categorical" | "unknown";

export interface LegendStop {
  readonly color: string;
  readonly label: string;
}

export interface LegendModel {
  readonly title: string;
  readonly kind: LegendKind;
  readonly stops: readonly LegendStop[];
  readonly noData: { readonly color: string; readonly label: string } | null;
  readonly source: "From metadata" | "Estimated from pixels";
}

export interface LegendMetadata {
  readonly title: string;
  readonly kind: LegendKind;
  readonly stops: readonly LegendStop[];
  readonly noData?: { readonly color: string; readonly label: string } | null;
}

const NO_SCALE: LegendModel = {
  title: "NO COLORMAP DETECTED",
  kind: "unknown",
  stops: [],
  noData: { color: "#3a3a3a", label: "NO DATA HERE" },
  source: "From metadata",
};

export function legendFromMetadata(meta: LegendMetadata | null): LegendModel {
  if (!meta || meta.stops.length === 0) {
    return meta
      ? { ...NO_SCALE, title: meta.title, noData: meta.noData ?? NO_SCALE.noData }
      : NO_SCALE;
  }
  return {
    title: meta.title,
    kind: meta.kind,
    stops: meta.stops,
    noData: meta.noData ?? null,
    source: "From metadata",
  };
}

function bucket(value: number): number {
  return Math.round(value / 24) * 24;
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hex(r: number, g: number, b: number): string {
  const part = (n: number) => n.toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

interface Cluster {
  r: number;
  g: number;
  b: number;
  count: number;
}

function clustersFrom(data: Uint8ClampedArray, width: number, height: number, stride: number): Cluster[] {
  const bins = new Map<string, Cluster>();
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3] ?? 0;
      if (alpha < 200) continue;
      const r = bucket(data[i] ?? 0);
      const g = bucket(data[i + 1] ?? 0);
      const b = bucket(data[i + 2] ?? 0);
      const key = `${r},${g},${b}`;
      const found = bins.get(key);
      if (found) found.count += 1;
      else bins.set(key, { r, g, b, count: 1 });
    }
  }
  return [...bins.values()].sort((a, b) => b.count - a.count);
}

/** A thin, colorful strip along the top or bottom edge counts as an embedded colorbar. */
function colorbarStops(data: Uint8ClampedArray, width: number, height: number): LegendStop[] | null {
  const band = Math.max(2, Math.round(height * 0.08));
  const rows = [0, Math.max(0, height - band)];
  let best: LegendStop[] | null = null;
  for (const start of rows) {
    const colors: LegendStop[] = [];
    const seen = new Set<string>();
    const y = Math.min(height - 1, start + Math.floor(band / 2));
    for (let step = 0; step < 8; step += 1) {
      const x = Math.min(width - 1, Math.round(((step + 0.5) / 8) * width));
      const i = (y * width + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min < 28) continue;
      const color = hex(bucket(r), bucket(g), bucket(b));
      if (seen.has(color)) continue;
      seen.add(color);
      colors.push({ color, label: "" });
    }
    if (colors.length >= 4 && (!best || colors.length > best.length)) best = colors;
  }
  if (!best || best.length < 4) return null;
  return best.map((stop, index) => ({
    color: stop.color,
    label: index === 0 ? "LOW" : index === best.length - 1 ? "HIGH" : "",
  }));
}

export function legendFromPixels(data: Uint8ClampedArray, width: number, height: number, title: string): LegendModel {
  const bar = width > 8 && height > 8 ? colorbarStops(data, width, height) : null;
  if (bar) {
    return {
      title,
      kind: "sequential",
      stops: bar,
      noData: null,
      source: "Estimated from pixels",
    };
  }
  const top = clustersFrom(data, width, height, 4).slice(0, 5);
  if (top.length === 0) {
    return { ...NO_SCALE, title, source: "Estimated from pixels" };
  }
  const ordered = [...top].sort((a, b) => luminance(a.r, a.g, a.b) - luminance(b.r, b.g, b.b));
  const grey = top.find((item) => {
    const spread = Math.max(item.r, item.g, item.b) - Math.min(item.r, item.g, item.b);
    const total = top.reduce((sum, cluster) => sum + cluster.count, 0);
    return spread < 18 && item.count / total > 0.18 && luminance(item.r, item.g, item.b) < 80;
  });
  const stops = ordered
    .filter((item) => item !== grey)
    .map((item, index, list) => ({
      color: hex(item.r, item.g, item.b),
      label: index === 0 ? "LOW" : index === list.length - 1 ? "HIGH" : "",
    }));
  return {
    title,
    kind: stops.length <= 2 ? "sequential" : "categorical",
    stops,
    noData: grey ? { color: hex(grey.r, grey.g, grey.b), label: "NO DATA HERE" } : null,
    source: "Estimated from pixels",
  };
}

export function legendGradient(stops: readonly LegendStop[]): string {
  if (stops.length === 0) return "transparent";
  if (stops.length === 1) return stops[0].color;
  const parts = stops.map((stop, index) => {
    const at = (index / (stops.length - 1)) * 100;
    return `${stop.color} ${at.toFixed(1)}%`;
  });
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}
