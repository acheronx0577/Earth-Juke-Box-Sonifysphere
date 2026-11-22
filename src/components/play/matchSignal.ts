/** Scoring, rounds, and the illustrative scope for Challenge 02. */

export const START_FREQ = 475;
export const START_Q = 4.5;
export const LOCK_AT = 88;
export const CLOSE_AT = 60;
export const WARM_AT = 35;
export const HOLD_MS = 600;
export const TARGET_MS = 1800;
export const STUCK_LISTENS = 3;
export const STUCK_MS = 45_000;
export const CLICK_GUARD_MS = 400;

export const FREQ = { min: 150, max: 800, step: 5, minor: 25, major: 100, width: 650 } as const;
export const RESONANCE = { min: 1, max: 8, step: 0.1, minor: 0.25, major: 1, width: 70 } as const;

export interface MatchRound {
  id: string;
  roundNumber: number;
  title: string;
  metric: string;
  year: number;
  line: string;
  targetFreq: number;
  targetQ: number;
  fact: string;
}

export const MATCH_ROUNDS: readonly MatchRound[] = [
  {
    id: "round-1",
    roundNumber: 1,
    title: "1958 Keeling Baseline",
    metric: "315.71 ppm CO₂",
    year: 1958,
    line: "First continuous reading atop Mauna Loa.",
    targetFreq: 260,
    targetQ: 2.2,
    fact: "Charles David Keeling's first reading in March 1958 proved human emissions were accumulating in the atmosphere.",
  },
  {
    id: "round-2",
    roundNumber: 2,
    title: "2025 Seasonal Swing",
    metric: "430.51 May · 424.37 Sep",
    year: 2025,
    line: "Northern forests inhale and exhale CO₂.",
    targetFreq: 440,
    targetQ: 4.2,
    fact: "Each spring, the Northern Hemisphere's biosphere pulls CO₂ down by over 6 ppm before leaves fall in autumn.",
  },
  {
    id: "round-3",
    roundNumber: 3,
    title: "2026 Peak Anomaly",
    metric: "432.34 ppm All-Time High",
    year: 2026,
    line: "Highest monthly CO₂ in 823 months.",
    targetFreq: 650,
    targetQ: 6.8,
    fact: "At 432.34 ppm, modern atmosphere holds over 116 ppm more CO₂ than when measurements began in 1958.",
  },
];

export const DEFAULT_HINT = "Press Compare, then slide until the lines overlap.";
export const ZONE_HINT = "The shaded band is where 88% is reachable. Match both.";
export const STUCK_HINT = "Stuck? Show the target zone, or skip this round.";

/** Live formula from the previous tuning game. */
export function coherence(userFreq: number, userQ: number, targetFreq: number, targetQ: number): number {
  const freqDiff = Math.abs(userFreq - targetFreq) / targetFreq;
  const qDiff = Math.abs(userQ - targetQ) / targetQ;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - 0.7 * freqDiff - 0.3 * qDiff))));
}

export function bandOf(value: number): { key: "lock" | "close" | "warm" | "far"; word: string } {
  if (value >= LOCK_AT) return { key: "lock", word: "Locked in" };
  if (value >= CLOSE_AT) return { key: "close", word: "Close" };
  if (value >= WARM_AT) return { key: "warm", word: "Warmer" };
  return { key: "far", word: "Far" };
}

/** Band where 88% is still reachable if the other dial is exact. */
export function lockZone(target: number, weight: number): readonly [number, number] {
  const span = (0.12 * target) / weight;
  return [target - span, target + span];
}

export function axisPercent(value: number, min: number, max: number): number {
  return ((value - min) / (max - min)) * 100;
}

export function zoneBox(span: readonly [number, number], min: number, max: number): { left: string; width: string } {
  const left = Math.max(0, axisPercent(span[0], min, max));
  const right = Math.min(100, axisPercent(span[1], min, max));
  return {
    left: `calc(14px + (100% - 28px) * ${left / 100})`,
    width: `calc((100% - 28px) * ${(right - left) / 100})`,
  };
}

/** Illustrative scope: cycles follow frequency, envelope width follows Q. Not an audio trace. */
export function wavePath(freq: number, q: number): string {
  const cycles = freq / 50;
  const sigma = 0.75 / Math.max(q, 0.1);
  let path = "";
  for (let i = 0; i <= 300; i += 1) {
    const x = i / 300;
    const env = Math.exp(-((x - 0.5) ** 2) / (2 * sigma * sigma));
    const y = 110 - 92 * env * Math.sin(2 * Math.PI * cycles * x);
    path += `${i ? "L" : "M"}${(x * 600).toFixed(1)} ${y.toFixed(1)}`;
  }
  return path;
}

export interface TickMark {
  x: number;
  major: boolean;
}

export function tickMarks(min: number, max: number, minor: number, major: number, width: number): TickMark[] {
  const count = Math.round((max - min) / minor);
  const marks: TickMark[] = [];
  for (let i = 0; i <= count; i += 1) {
    const value = min + i * minor;
    const x = (i / count) * width;
    const onMajor = Math.abs(value / major - Math.round(value / major)) < 1e-6;
    marks.push({ x, major: onMajor });
  }
  return marks;
}

export const FREQ_TICKS = tickMarks(FREQ.min, FREQ.max, FREQ.minor, FREQ.major, FREQ.width);
export const Q_TICKS = tickMarks(RESONANCE.min, RESONANCE.max, RESONANCE.minor, RESONANCE.major, RESONANCE.width);

export function fluidCuts(width: number, rootFont = 16): { lg: number; md: number; sm: number } {
  const vw = width / 100;
  const clamp = (min: number, preferred: number, max: number) =>
    Math.round(Math.min(max, Math.max(min, preferred)) * 100) / 100;
  return {
    lg: clamp(10, 0.4 * rootFont + 0.5 * vw, 18),
    md: clamp(7, 0.3 * rootFont + 0.2 * vw, 10),
    sm: clamp(5, 0.22 * rootFont + 0.1 * vw, 6),
  };
}
