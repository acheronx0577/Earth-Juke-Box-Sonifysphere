"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChamferMark } from "@/components/listen/ChamferMark";
import { encodeRibbonsResult, type SharedRibbonsResult } from "@/lib/challengeResults";
import styles from "./ribbons.module.css";

const VW = 1480;
const BASE = 548;
const XS = [150, 350, 550, 750, 950, 1150, 1350];
/** One pass of the curve, in seconds. The buffer and the transport share this length. */
const CYCLE = 2;
/** Tail of each cycle that glides the last pitch back to the first so the join is continuous. */
const GLIDE = 0.045;
const TIP_GUTTER = 12;

const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;
type SeasonName = (typeof SEASONS)[number];

const SEASON_OF: Record<string, SeasonName> = {
  Jan: "Winter",
  Feb: "Winter",
  Mar: "Spring",
  Apr: "Spring",
  May: "Spring",
  Jun: "Summer",
  Jul: "Summer",
  Aug: "Summer",
  Sep: "Autumn",
  Oct: "Autumn",
  Nov: "Autumn",
  Dec: "Winter",
};

interface RibbonPattern {
  readonly id: string;
  readonly shortTitle: string;
  readonly resultLabel: string;
  readonly defaultSeason: string;
  readonly turnIndex: number;
  readonly points: readonly [number, number][];
  readonly months: readonly string[];
  readonly turnReason: string;
  readonly missHint: string;
  readonly infoFact: string;
}

const HOW =
  "Play the curve and leave it running. Pitch follows the line, higher where the curve is higher, and the phrase loops until you pause. Choose the season where it turns, then Check.";

const PATTERNS: readonly RibbonPattern[] = [
  {
    id: "co2-keeling",
    shortTitle: "CO₂ Cycle",
    resultLabel: "CO₂ · MAY",
    defaultSeason: "Spring",
    turnIndex: 3,
    points: [
      [0, 185],
      [100, 160],
      [200, 105],
      [300, 70],
      [400, 90],
      [500, 145],
      [600, 190],
    ],
    months: ["Nov", "Jan", "Mar", "May", "Jul", "Sep", "Nov"],
    turnReason: "Yes! At point 4 (late spring / May), atmospheric CO₂ crests before Northern Hemisphere photosynthesis accelerates.",
    missHint: "Listen for the crest, where the line stops rising and turns down into the summer drawdown.",
    infoFact: "CO₂ peaks each May, before northern forests leaf out. Keeling first measured this “inhale” on Mauna Loa in 1958.",
  },
  {
    id: "sea-ice-minimum",
    shortTitle: "Sea Ice",
    resultLabel: "SEA ICE · SEP",
    defaultSeason: "Autumn",
    turnIndex: 3,
    points: [
      [0, 80],
      [100, 115],
      [200, 160],
      [300, 205],
      [400, 175],
      [500, 125],
      [600, 85],
    ],
    months: ["Mar", "May", "Jul", "Sep", "Nov", "Jan", "Mar"],
    turnReason: "Correct! Point 4 marks the annual September minimum extent, after which freezing resumes.",
    missHint: "Listen for the trough, where the summer melt stops and the line turns back up.",
    infoFact: "The September minimum is the turn, after which the pack freezes again. NASA has tracked it since 1979.",
  },
  {
    id: "ocean-heat-content",
    shortTitle: "Ocean Heat",
    resultLabel: "OCEAN HEAT · AUG",
    defaultSeason: "Summer",
    turnIndex: 3,
    points: [
      [0, 180],
      [100, 150],
      [200, 100],
      [300, 65],
      [400, 85],
      [500, 140],
      [600, 185],
    ],
    months: ["Feb", "Apr", "Jun", "Aug", "Oct", "Dec", "Feb"],
    turnReason: "Spot on! Point 4 represents the late-summer crest in upper ocean heat content before autumn cooling.",
    missHint: "Listen for the thermal crest, where the line stops rising and turns down.",
    infoFact: "Upper-ocean heat crests in late summer, then releases to the air. Most of Earth's extra heat is stored in the ocean.",
  },
];

function freqForCoord(y: number): number {
  return Math.round(220 + (220 - y) * 2.8);
}

function answerSeason(pattern: RibbonPattern): SeasonName {
  return SEASON_OF[pattern.months[pattern.turnIndex]] ?? (pattern.defaultSeason as SeasonName);
}

function cellEdge(index: number, side: "left" | "right"): number {
  const gap = XS[1] - XS[0];
  if (side === "left") return index <= 0 ? XS[0] - gap / 2 : (XS[index - 1] + XS[index]) / 2;
  return index >= XS.length - 1 ? XS[index] + gap / 2 : (XS[index] + XS[index + 1]) / 2;
}

function seasonSpans(months: readonly string[], season: string): Array<[number, number]> {
  const groups: Array<[number, number]> = [];
  let start = -1;
  months.forEach((month, index) => {
    const on = SEASON_OF[month] === season;
    if (on && start < 0) start = index;
    const closes = start >= 0 && (!on || index === months.length - 1);
    if (!closes) return;
    const end = on ? index : index - 1;
    groups.push([cellEdge(start, "left"), cellEdge(end, "right")]);
    start = -1;
  });
  return groups;
}

function directionWord(index: number, turn: number): string {
  if (index < turn) return "RISING";
  if (index === turn) return "TURN";
  return "FALLING";
}

function tangents(points: readonly [number, number][]): number[] {
  const n = points.length;
  const dx: number[] = [];
  const slope: number[] = [];
  const m = new Array<number>(n).fill(0);
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = points[i + 1][0] - points[i][0];
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
  return m;
}

function cubicAt(points: readonly [number, number][], slope: readonly number[], index: number, t: number): [number, number] {
  const p0 = points[index];
  const p1 = points[index + 1];
  const dx = p1[0] - p0[0];
  const c1x = p0[0] + dx / 3;
  const c1y = p0[1] + (slope[index] * dx) / 3;
  const c2x = p1[0] - dx / 3;
  const c2y = p1[1] - (slope[index + 1] * dx) / 3;
  const mt = 1 - t;
  return [
    mt * mt * mt * p0[0] + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * p1[0],
    mt * mt * mt * p0[1] + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * p1[1],
  ];
}

function sampleCurve(points: readonly [number, number][], t: number): [number, number] {
  const n = points.length;
  if (t <= 0) return [points[0][0], points[0][1]];
  if (t >= 1) return [points[n - 1][0], points[n - 1][1]];
  const slope = tangents(points);
  const x = t * (n - 1);
  const index = Math.min(n - 2, Math.floor(x));
  return cubicAt(points, slope, index, x - index);
}

function forwardT(u: number): number {
  const body = 1 - GLIDE;
  return u >= body ? 1 : u / body;
}

function freqAt(raw: readonly [number, number][], u: number): number {
  const wrapped = ((u % 1) + 1) % 1;
  const body = 1 - GLIDE;
  const start = freqForCoord(raw[0][1]);
  const end = freqForCoord(raw[raw.length - 1][1]);
  if (wrapped >= body) return end + (start - end) * ((wrapped - body) / GLIDE);
  return freqForCoord(sampleCurve(raw, wrapped / body)[1]);
}

/** Sine cycle whose phase advances by a whole number of turns, so the loop point matches. */
function fillSeamless(channel: Float32Array, raw: readonly [number, number][], sampleRate: number) {
  const length = channel.length;
  let phase = 0;
  const step = new Float64Array(length);
  for (let i = 0; i < length; i += 1) {
    step[i] = (2 * Math.PI * freqAt(raw, i / length)) / sampleRate;
    phase += step[i];
  }
  const turns = phase / (2 * Math.PI);
  const scale = Math.max(1, Math.round(turns)) / turns;
  phase = 0;
  for (let i = 0; i < length; i += 1) {
    channel[i] = Math.sin(phase) * 0.55;
    phase += step[i] * scale;
  }
}

function monotone(points: readonly [number, number][]): string {
  const n = points.length;
  const slope = tangents(points);
  const dx: number[] = [];
  for (let i = 0; i < n - 1; i += 1) dx[i] = points[i + 1][0] - points[i][0];
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const [c1x, c1y] = [points[i][0] + dx[i] / 3, points[i][1] + (slope[i] * dx[i]) / 3];
    const [c2x, c2y] = [points[i + 1][0] - dx[i] / 3, points[i + 1][1] - (slope[i + 1] * dx[i]) / 3];
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${points[i + 1][0]} ${points[i + 1][1]}`;
  }
  return d;
}

function chartGeometry(raw: readonly [number, number][]) {
  const ys = raw.map((point) => point[1]);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const mapped = raw.map((point, index) => [XS[index], 150 + ((point[1] - min) / span) * 360] as [number, number]);
  const floor = BASE - 12;
  const clampPlot = (y: number) => Math.min(y, floor);
  const leftSlope = (mapped[1][1] - mapped[0][1]) / (mapped[1][0] - mapped[0][0]);
  const rightSlope = (mapped[6][1] - mapped[5][1]) / (mapped[6][0] - mapped[5][0]);
  const extended: [number, number][] = [
    [0, clampPlot(mapped[0][1] - leftSlope * mapped[0][0])],
    ...mapped,
    [VW, clampPlot(mapped[6][1] + rightSlope * (VW - mapped[6][0]))],
  ];
  const line = monotone(extended);
  return { mapped, line, fill: `${line} L ${VW} ${BASE} L 0 ${BASE} Z` };
}

function uForIndex(index: number): number {
  return (index / (XS.length - 1)) * (1 - GLIDE);
}

function nearestIndex(mapped: readonly [number, number][], x: number): number {
  let closest = 0;
  let best = Number.POSITIVE_INFINITY;
  mapped.forEach((point, index) => {
    const distance = Math.abs(point[0] - x);
    if (distance < best) {
      best = distance;
      closest = index;
    }
  });
  return closest;
}

function resultUrl(score: number, solved: number) {
  const url = new URL("/challenge/ribbons", window.location.origin);
  url.searchParams.set("result", encodeRibbonsResult({ patternsSolved: solved, totalScore: score }));
  return url.toString();
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Clipboard access was blocked.");
}

function cutStyle(cut: number): React.CSSProperties {
  return { ["--cut" as string]: `${cut}px` };
}

interface LoopEngine {
  player: import("tone").Player;
  meter: import("tone").Meter;
  gain: import("tone").Gain;
  duration: number;
  patternId: string;
  anchor: { contextTime: number; offset: number };
}

export function WaveformRibbonsGame({
  sharedResult = null,
}: {
  readonly sharedResult?: SharedRibbonsResult | null;
}) {
  const [patternIdx, setPatternIdx] = useState(0);
  const [headU, setHeadU] = useState(() => uForIndex(1));
  const [season, setSeason] = useState<SeasonName | null>(null);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(Boolean(sharedResult));
  const [infoOpen, setInfoOpen] = useState(false);
  const [live, setLive] = useState("");
  const [verdict, setVerdict] = useState<"idle" | "choice" | "correct" | "wrong" | "empty">("idle");
  const [shareNote, setShareNote] = useState("");
  const chartRef = useRef<SVGSVGElement | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const infoRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const eqRef = useRef<HTMLSpanElement | null>(null);
  const toneRef = useRef<typeof import("tone") | null>(null);
  const chimeRef = useRef<import("tone").Synth | null>(null);
  const engineRef = useRef<LoopEngine | null>(null);
  const buildingRef = useRef<Promise<LoopEngine> | null>(null);
  const playingRef = useRef(false);
  const headRef = useRef(uForIndex(1));
  const patternRef = useRef(PATTERNS[0]);
  const cycleRef = useRef(0);
  const prevURef = useRef(0);
  const gateRef = useRef({ starts: 0, stops: 0 });
  const playToken = useRef(0);
  const wantPlay = useRef(false);
  const [audio, setAudio] = useState<"idle" | "playing">("idle");
  const [toneState, setToneState] = useState("suspended");
  const [transportState, setTransportState] = useState("stopped");
  const [looping, setLooping] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [gate, setGate] = useState({ starts: 0, stops: 0 });
  const [cue, setCue] = useState("");
  const [tipShift, setTipShift] = useState(0);
  const [tipAnchor, setTipAnchor] = useState<"center" | "start" | "end">("center");
  const fillId = `${useId().replace(/:/g, "")}fill`;
  const glowId = `${useId().replace(/:/g, "")}glow`;
  const plotClipId = `${useId().replace(/:/g, "")}plot`;

  const pattern = PATTERNS[patternIdx] ?? PATTERNS[0];
  patternRef.current = pattern;
  headRef.current = headU;
  const geometry = chartGeometry(pattern.points);
  const posePoint = sampleCurve(geometry.mapped, forwardT(headU));
  const pointIdx = nearestIndex(geometry.mapped, posePoint[0]);
  const freq = freqForCoord(pattern.points[pointIdx]?.[1] ?? 160);
  const month = pattern.months[pointIdx] ?? "";
  const direction = directionWord(pointIdx, pattern.turnIndex);
  const valueText = `${month}, ${direction.toLowerCase()}, ${freq} hertz`;
  const spans = season ? seasonSpans(pattern.months, season) : [];
  const answer = answerSeason(pattern);
  const playheadX = posePoint[0];

  useLayoutEffect(() => {
    const tip = tipRef.current;
    const plot = plotRef.current;
    if (!tip || !plot) return;
    const place = () => {
      const width = tip.offsetWidth;
      if (width < 1) return;
      const plotBox = plot.getBoundingClientRect();
      const playhead = plotBox.left + (playheadX / VW) * plotBox.width;
      const minLeft = TIP_GUTTER;
      const maxLeft = window.innerWidth - TIP_GUTTER - width;
      let shift = -width / 2;
      let anchor: "center" | "start" | "end" = "center";
      const leftOf = (next: number) => playhead + next;
      if (leftOf(shift) < minLeft) {
        anchor = "start";
        shift = 0;
      } else if (leftOf(shift) + width > window.innerWidth - TIP_GUTTER) {
        anchor = "end";
        shift = -width;
      }
      const clampedLeft = Math.min(Math.max(leftOf(shift), minLeft), Math.max(minLeft, maxLeft));
      shift = clampedLeft - playhead;
      setTipShift((prev) => (Math.abs(prev - shift) < 0.5 ? prev : shift));
      setTipAnchor((prev) => (prev === anchor ? prev : anchor));
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(tip);
    observer.observe(plot);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [playheadX, month, direction, freq]);

  const publishGate = (next: { starts: number; stops: number }) => {
    gateRef.current = next;
    setGate(next);
    if (rootRef.current) {
      rootRef.current.dataset.starts = String(next.starts);
      rootRef.current.dataset.stops = String(next.stops);
    }
  };

  const readOffset = () => {
    const engine = engineRef.current;
    const Tone = toneRef.current;
    if (!engine) return headRef.current * CYCLE;
    if (!playingRef.current || !Tone) return engine.anchor.offset;
    const elapsed = Tone.now() - engine.anchor.contextTime;
    const duration = engine.duration;
    return ((engine.anchor.offset + elapsed) % duration + duration) % duration;
  };

  const moveTo = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(XS.length - 1, next));
    const u = uForIndex(clamped);
    setHeadU(u);
    headRef.current = u;
    const engine = engineRef.current;
    const Tone = toneRef.current;
    if (!engine || !Tone || !playingRef.current) return;
    const offset = u * engine.duration;
    const now = Tone.now();
    engine.anchor.offset = offset;
    engine.anchor.contextTime = now;
    engine.player.seek(offset, now);
  }, []);

  useEffect(() => {
    if (!infoOpen) return;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setInfoOpen(false);
      infoRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [infoOpen]);

  const releaseEngine = () => {
    const Tone = toneRef.current;
    const engine = engineRef.current;
    playingRef.current = false;
    if (Tone) {
      const transport = Tone.getTransport();
      if (transport.state === "started") transport.pause();
      transport.loop = false;
    }
    engine?.player.stop();
    engine?.player.dispose();
    engine?.meter.dispose();
    engine?.gain.dispose();
    engineRef.current = null;
    setLooping(false);
    setAudio("idle");
  };

  const armTone = async () => {
    const Tone = toneRef.current ?? (await import("tone"));
    toneRef.current = Tone;
    await Tone.start();
    const state = Tone.getContext().state;
    setToneState(state);
    if (rootRef.current) rootRef.current.dataset.tone = state;
    if (!chimeRef.current) {
      const chimeVoice = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.12, sustain: 0.2, release: 0.2 },
      }).toDestination();
      chimeVoice.volume.value = -4;
      chimeRef.current = chimeVoice;
    }
    return Tone;
  };

  const buildEngine = async (current: RibbonPattern): Promise<LoopEngine> => {
    const Tone = await armTone();
    const raw = Tone.getContext().rawContext;
    const sampleRate = raw.sampleRate;
    const length = Math.round(sampleRate * CYCLE);
    const buffer = raw.createBuffer(1, length, sampleRate);
    fillSeamless(buffer.getChannelData(0), current.points, sampleRate);
    const player = new Tone.Player(buffer);
    player.loop = true;
    player.fadeIn = 0;
    player.fadeOut = 0;
    const gain = new Tone.Gain(0.9).toDestination();
    const meter = new Tone.Meter({ normalRange: true, smoothing: 0.18 });
    player.connect(gain);
    player.connect(meter);
    const transport = Tone.getTransport();
    transport.bpm.value = 120;
    transport.loop = true;
    transport.loopStart = 0;
    transport.loopEnd = buffer.duration;
    const engine: LoopEngine = {
      player,
      meter,
      gain,
      duration: buffer.duration,
      patternId: current.id,
      anchor: { contextTime: 0, offset: headRef.current * buffer.duration },
    };
    engineRef.current = engine;
    return engine;
  };

  const ensureEngine = async () => {
    const current = patternRef.current;
    const existing = engineRef.current;
    if (existing && existing.patternId === current.id) return existing;
    if (existing) releaseEngine();
    if (!buildingRef.current) {
      buildingRef.current = buildEngine(current).finally(() => {
        buildingRef.current = null;
      });
    }
    return buildingRef.current;
  };

  const pauseLoop = () => {
    const engine = engineRef.current;
    const Tone = toneRef.current;
    if (!engine || !Tone) return;
    const offset = readOffset();
    engine.anchor.offset = offset;
    playingRef.current = false;
    engine.player.stop(Tone.now());
    const transport = Tone.getTransport();
    if (transport.state === "started") transport.pause();
    setHeadU(offset / engine.duration);
    setAudio("idle");
    setTransportState(transport.state);
    setCue("Paused.");
    if (rootRef.current) rootRef.current.dataset.audio = "idle";
  };

  const playLoop = async (token: number) => {
    try {
      const engine = await ensureEngine();
      const Tone = toneRef.current;
      if (!Tone || playToken.current !== token || !wantPlay.current) return;
      const now = Tone.now();
      const offset = Math.min(engine.duration - 0.001, Math.max(0, headRef.current * engine.duration));
      engine.anchor.offset = offset;
      engine.anchor.contextTime = now;
      prevURef.current = offset / engine.duration;
      engine.player.start(now, offset);
      const transport = Tone.getTransport();
      transport.loop = true;
      transport.loopStart = 0;
      transport.loopEnd = engine.duration;
      if (transport.state !== "started") transport.start(now, offset);
      if (playToken.current !== token || !wantPlay.current) {
        engine.player.stop(Tone.now());
        if (transport.state === "started") transport.pause();
        return;
      }
      playingRef.current = true;
      wantPlay.current = false;
      setAudio("playing");
      setLooping(true);
      setTransportState(transport.state);
      setCue("Playing the curve.");
      if (rootRef.current) {
        rootRef.current.dataset.audio = "playing";
        rootRef.current.dataset.loop = "true";
        rootRef.current.dataset.playerLoop = "true";
      }
    } catch {
      if (playToken.current !== token) return;
      wantPlay.current = false;
      playingRef.current = false;
      setAudio("idle");
      setCue("The curve did not play.");
    }
  };

  const togglePlay = () => {
    if (playingRef.current || wantPlay.current) {
      wantPlay.current = false;
      pauseLoop();
      return;
    }
    wantPlay.current = true;
    const token = (playToken.current += 1);
    void playLoop(token);
  };

  const chime = async () => {
    try {
      const Tone = await armTone();
      chimeRef.current?.triggerAttackRelease(587.33, 0.14, Tone.now());
      chimeRef.current?.triggerAttackRelease(880, 0.28, Tone.now() + 0.15);
    } catch {
      setCue("The preview did not play.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    let detach = () => {};
    void import("tone").then((Tone) => {
      if (cancelled) return;
      toneRef.current = Tone;
      const transport = Tone.getTransport();
      const onStart = () => publishGate({ starts: gateRef.current.starts + 1, stops: gateRef.current.stops });
      const onStop = () => publishGate({ starts: gateRef.current.starts, stops: gateRef.current.stops + 1 });
      transport.on("start", onStart);
      transport.on("stop", onStop);
      detach = () => {
        transport.off("start", onStart);
        transport.off("stop", onStop);
      };
    });
    return () => {
      cancelled = true;
      detach();
      releaseEngine();
      chimeRef.current?.dispose();
      chimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine && engine.patternId !== pattern.id) {
      releaseEngine();
      cycleRef.current = 0;
      setCycle(0);
      if (rootRef.current) rootRef.current.dataset.cycle = "0";
    }
  }, [pattern.id]);

  useEffect(() => {
    if (audio !== "playing") {
      eqRef.current?.style.setProperty("--level", "0");
      if (rootRef.current) rootRef.current.dataset.meter = "0";
      return;
    }
    let frame = 0;
    const tick = () => {
      const engine = engineRef.current;
      const Tone = toneRef.current;
      const value = engine?.meter.getValue();
      const level = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
      eqRef.current?.style.setProperty("--level", level.toFixed(3));
      if (engine && Tone && playingRef.current) {
        const offset = readOffset();
        const u = offset / engine.duration;
        const previous = prevURef.current;
        if (previous > 0.85 && u < 0.2) {
          cycleRef.current += 1;
          setCycle(cycleRef.current);
        }
        prevURef.current = u;
        if (Math.abs(u - headRef.current) > 0.0015) setHeadU(u);
        const transport = Tone.getTransport();
        const contextState = Tone.getContext().state;
        if (rootRef.current) {
          rootRef.current.dataset.meter = level.toFixed(3);
          rootRef.current.dataset.tone = contextState;
          rootRef.current.dataset.transport = transport.state;
          rootRef.current.dataset.loop = String(Boolean(transport.loop) && engine.player.loop);
          rootRef.current.dataset.playerLoop = String(engine.player.loop);
          rootRef.current.dataset.cycle = String(cycleRef.current);
          rootRef.current.dataset.head = u.toFixed(4);
          rootRef.current.dataset.starts = String(gateRef.current.starts);
          rootRef.current.dataset.stops = String(gateRef.current.stops);
        }
        setToneState((current) => (current === contextState ? current : contextState));
        setTransportState((current) => (current === transport.state ? current : transport.state));
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [audio]);

  const onChartKey = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const current = nearestIndex(geometry.mapped, sampleCurve(geometry.mapped, forwardT(headRef.current))[0]);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveTo(current + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveTo(current - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveTo(pattern.points.length - 1);
    }
  };

  const onChartClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = chartRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VW;
    let closest = 0;
    let best = Number.POSITIVE_INFINITY;
    XS.forEach((tick, index) => {
      const distance = Math.abs(tick - x);
      if (distance < best) {
        best = distance;
        closest = index;
      }
    });
    moveTo(closest);
    svg.focus();
  };

  const chooseSeason = (name: SeasonName) => {
    setSeason(name);
    setVerdict("choice");
    setLive(`${name} selected.`);
  };

  const check = () => {
    if (!season) {
      setVerdict("empty");
      setLive("Pick the season where the curve turns.");
      return;
    }
    const correct = season === answer;
    if (!correct) {
      setVerdict("wrong");
      setLive(`${season} is not where it turns. ${pattern.missHint}`);
      return;
    }
    setVerdict("correct");
    setLive(pattern.turnReason);
    void chime();
    if (playingRef.current) pauseLoop();
    setScore((value) => value + 100);
    if (patternIdx < PATTERNS.length - 1) {
      const next = patternIdx + 1;
      setPatternIdx(next);
      setHeadU(uForIndex(1));
      headRef.current = uForIndex(1);
      setSeason(null);
      setInfoOpen(false);
      setVerdict("idle");
    } else {
      setIsComplete(true);
    }
  };

  const restart = () => {
    releaseEngine();
    cycleRef.current = 0;
    setCycle(0);
    setPatternIdx(0);
    setHeadU(uForIndex(1));
    headRef.current = uForIndex(1);
    setSeason(null);
    setScore(0);
    setLive("");
    setVerdict("idle");
    setShareNote("");
    setIsComplete(false);
  };

  const copyLink = async (total: number, solved: number) => {
    try {
      await copyText(resultUrl(total, solved));
      setShareNote("Result link copied.");
    } catch (error) {
      setShareNote(error instanceof Error ? error.message : "The result link could not be copied.");
    }
  };

  const saveImage = async (total: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#141414";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f2f2f0";
    context.font = "600 64px sans-serif";
    context.fillText("Harmonics aligned", 72, 280);
    context.font = "500 28px ui-monospace, monospace";
    context.fillText(`${total} PTS`, 72, 360);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "sonifysphere-waveform-ribbons-result.png";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setShareNote("Result image downloaded.");
  };

  if (isComplete) {
    const displayScore = sharedResult ? sharedResult.totalScore : score;
    const solved = sharedResult ? sharedResult.patternsSolved : PATTERNS.length;
    return (
      <main id="main-content" tabIndex={-1} className={styles.page} data-hide-target-cursor="true">
        <header className={styles.header}>
          <Link href="/challenge" className={styles.resultBack}>
            ← Challenges
          </Link>
          <div className={styles.scoreSide}>
            <span>{displayScore} PTS</span>
            <span className={styles.dots} aria-hidden="true">
              {PATTERNS.map((item) => (
                <i key={item.id} className={styles.dot} data-on="true" />
              ))}
            </span>
          </div>
        </header>
        <div className={styles.result} data-testid="ribbons-result">
          <span className={`${styles.frame} ${styles.mark} lv-cut`} style={cutStyle(8)} aria-hidden="true">
            <ChamferMark />
            <span className={styles.frameFace}>✓</span>
          </span>
          <h1>Harmonics aligned</h1>
          <div className={styles.ribbons}>
            {PATTERNS.map((item) => {
              const mini = chartGeometry(item.points);
              return (
                <div key={item.id} className={styles.mini}>
                  <svg viewBox={`0 120 ${VW} 460`} preserveAspectRatio="none" aria-hidden="true">
                    <path d={mini.line} fill="none" stroke="#f2f2f0" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    <circle cx={mini.mapped[item.turnIndex][0]} cy={mini.mapped[item.turnIndex][1]} r="5" fill="#f2f2f0" />
                  </svg>
                  <div className={styles.miniRow}>
                    <span>{item.resultLabel}</span>
                    <span>+100</span>
                  </div>
                </div>
              );
            })}
          </div>
          {sharedResult ? (
            <Link href="/challenge/ribbons" className={`${styles.frame} ${styles.again} lv-cut`} style={cutStyle(10)}>
              <ChamferMark />
              <span className={styles.frameFace}>Play again</span>
            </Link>
          ) : (
            <button type="button" className={`${styles.frame} ${styles.again} lv-cut`} style={cutStyle(10)} onClick={restart}>
              <ChamferMark />
              <span className={styles.frameFace}>Play again</span>
            </button>
          )}
          <div className={styles.links}>
            <button type="button" onClick={() => void copyLink(displayScore, solved)}>
              Copy link
            </button>
            <button type="button" onClick={() => void saveImage(displayScore)}>
              Save image
            </button>
            <Link href="/challenge">All challenges</Link>
          </div>
          <p className={styles.sr} role="status">{shareNote}</p>
        </div>
      </main>
    );
  }

  return (
    <main
      ref={rootRef}
      id="main-content"
      tabIndex={-1}
      className={styles.page}
      data-hide-target-cursor="true"
      data-audio={audio}
      data-tone={toneState}
      data-transport={transportState}
      data-loop={looping ? "true" : "false"}
      data-player-loop={looping ? "true" : "false"}
      data-cycle={cycle}
      data-starts={gate.starts}
      data-stops={gate.stops}
      data-head={headU.toFixed(4)}
    >
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.num}>03</span>
          <h1>{pattern.shortTitle}</h1>
          <span className={styles.infoWrap}>
            <button
              ref={infoRef}
              type="button"
              className={`${styles.frame} ${styles.info} lv-cut c3-info`}
              style={cutStyle(7)}
              aria-expanded={infoOpen}
              aria-controls="ribbon-info"
              aria-label="How this challenge works"
              onClick={() => setInfoOpen((open) => !open)}
            >
              <ChamferMark />
              <span className={styles.frameFace}>i</span>
            </button>
            {infoOpen ? (
              <div
                ref={dialogRef}
                id="ribbon-info"
                className={`${styles.frame} ${styles.popover} lv-cut`}
                style={cutStyle(12)}
                role="dialog"
                aria-label="How it works"
                tabIndex={-1}
              >
                <ChamferMark />
                <div className={styles.frameFace}>
                  <span className={styles.num}>How it works</span>
                  <p>{HOW}</p>
                  <p>{pattern.infoFact}</p>
                </div>
              </div>
            ) : null}
          </span>
        </div>
        <div className={styles.scoreSide}>
          <span>{score} PTS</span>
          <span className={styles.dots} role="group" aria-label={`Pattern ${patternIdx + 1} of ${PATTERNS.length}`}>
            {PATTERNS.map((item, index) => (
              <i key={item.id} className={styles.dot} data-on={index === patternIdx ? "true" : "false"} />
            ))}
          </span>
        </div>
      </header>

      <div className={`${styles.stage} c3-plot`}>
        <div className={styles.plot} ref={plotRef}>
          <svg
            ref={chartRef}
            className={styles.curve}
            viewBox={`0 0 ${VW} ${BASE}`}
            preserveAspectRatio="none"
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={pattern.points.length - 1}
            aria-valuenow={pointIdx}
            aria-valuetext={valueText}
            aria-label={`${pattern.shortTitle} curve`}
            onKeyDown={onChartKey}
            onClick={onChartClick}
          >
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f2f2f0" stopOpacity="0.28" />
                <stop offset="70%" stopColor="#f2f2f0" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#f2f2f0" stopOpacity="0" />
              </linearGradient>
              <filter id={glowId} x="-8%" y="-40%" width="116%" height="180%">
                <feGaussianBlur stdDeviation="8" />
              </filter>
              <clipPath id={plotClipId}>
                <rect x="0" y="0" width={VW} height={BASE} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${plotClipId})`}>
              <path d={geometry.fill} fill={`url(#${fillId})`} />
              <path className={styles.glow} d={geometry.line} filter={`url(#${glowId})`} />
            </g>
            <path className={styles.line} d={geometry.line} />
            <line x1="0" y1={BASE} x2={VW} y2={BASE} stroke="rgba(242,242,240,0.28)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className={styles.markerCol} style={{ left: `${(posePoint[0] / VW) * 100}%` }} aria-hidden="true">
            <div
              ref={tipRef}
              className={`${styles.frame} ${styles.tip} lv-cut c3-tip`}
              data-tip-anchor={tipAnchor}
              style={{ ...cutStyle(6), transform: `translate(${tipShift}px, calc(-100% - 14px))`, top: `${(posePoint[1] / BASE) * 100}%` }}
            >
              <ChamferMark />
              <span className={styles.tipFace}>
                {month.toUpperCase()} · {direction} · {freq} HZ
              </span>
            </div>
            <span className={styles.stem} style={{ top: `${(posePoint[1] / BASE) * 100}%`, height: `${((BASE - posePoint[1]) / BASE) * 100}%` }} />
            <span className={styles.ring} style={{ top: `${(posePoint[1] / BASE) * 100}%` }} />
          </div>
        </div>
        <div className={styles.timeline}>
          {spans.map(([x0, x1]) => (
            <span
              key={`bar-${x0}`}
              className={styles.spanBar}
              data-season-span={season ?? ""}
              style={{ left: `${(x0 / VW) * 100}%`, width: `${((x1 - x0) / VW) * 100}%` }}
            />
          ))}
          {pattern.months.map((name, index) => {
            const inSpan = Boolean(season) && SEASON_OF[name] === season;
            const here = index === pointIdx;
            return (
              <span key={`label-${index}`} className={styles.monthSlot} style={{ left: `${(XS[index] / VW) * 100}%` }}>
                <span className={inSpan || here ? styles.monthOn : styles.month} data-span={inSpan ? "true" : "false"}>
                  {name.toUpperCase()}
                </span>
                <i className={inSpan ? styles.tickOn : styles.tick} />
              </span>
            );
          })}
        </div>
      </div>

      <p className={styles.feedback} role="status" aria-live="polite" data-verdict={verdict} data-testid="ribbons-feedback">
        {live}
        {cue ? <span className={styles.sr}> {cue}</span> : null}
      </p>

      <div className={styles.controls}>
        <div className={styles.listen}>
          <button
            type="button"
            className={`${styles.frame} ${styles.play} lv-cut c3-play${audio === "playing" ? ` ${styles.frameOn}` : ""}`}
            style={cutStyle(8)}
            aria-pressed={audio === "playing"}
            data-testid="ribbons-play"
            aria-label={audio === "playing" ? "Pause the curve" : "Play the curve"}
            onClick={togglePlay}
          >
            <ChamferMark />
            <span className={styles.frameFace} aria-hidden="true">
              {audio === "playing" ? (
                <svg width="13" height="13" viewBox="0 0 12 12">
                  <path d="M2.2 1.5 H4.4 V10.5 H2.2 Z M7.6 1.5 H9.8 V10.5 H7.6 Z" fill="currentColor" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 12 12">
                  <path d="M3 1.5 L10 6 L3 10.5 Z" fill="currentColor" />
                </svg>
              )}
            </span>
          </button>
          <span ref={eqRef} className={styles.eq} data-audio={audio} data-testid="ribbons-eq" aria-hidden="true">
            {[0.62, 1, 0.78, 0.46].map((bar) => (
              <i key={bar} style={{ ["--bar" as string]: String(bar) }} />
            ))}
          </span>
        </div>

        <div className={styles.answer}>
          <p className={styles.prompt}>Where does it turn?</p>
          <div className={styles.seasons} role="group" aria-label="Season where it turns">
            {SEASONS.map((name) => {
              const on = season === name;
              return (
                <button
                  key={name}
                  type="button"
                  className={`${styles.frame} ${styles.season} lv-cut c3-season${on ? ` ${styles.frameOn}` : ""}`}
                  style={cutStyle(8)}
                  aria-pressed={on}
                  onClick={() => chooseSeason(name)}
                >
                  <ChamferMark />
                  <span className={styles.frameFace}>{name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" className={`${styles.frame} ${styles.check} lv-cut c3-check`} style={cutStyle(8)} onClick={check}>
          <ChamferMark />
          <span className={styles.frameFace}>Check</span>
        </button>
      </div>
    </main>
  );
}
