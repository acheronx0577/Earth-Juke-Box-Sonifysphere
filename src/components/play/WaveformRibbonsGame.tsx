"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { encodeRibbonsResult, type SharedRibbonsResult } from "@/lib/challengeResults";
import styles from "./ribbons.module.css";

const VW = 1480;
const VH = 620;
const BASE = 548;
const XS = [150, 350, 550, 750, 950, 1150, 1350];

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
  "Each point plays a pitch: higher curve, higher note. Tap the chart or use the arrow keys to move, then Check the point where the line turns.";

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
    missHint: "Look for point 4, where the curve reaches its maximum peak before declining into the summer drawdown.",
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
    missHint: "Check point 4, the deepest trough where the summer melt stops and freeze-up begins.",
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
    missHint: "Point 4 represents the thermal peak where heat accumulation crests before releasing back to the atmosphere.",
    infoFact: "Upper-ocean heat crests in late summer, then releases to the air. Most of Earth's extra heat is stored in the ocean.",
  },
];

const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;

function clip(cut: number) {
  return `polygon(${cut}px 0, calc(100% - ${cut}px) 0, 100% ${cut}px, 100% calc(100% - ${cut}px), calc(100% - ${cut}px) 100%, ${cut}px 100%, 0 calc(100% - ${cut}px), 0 ${cut}px)`;
}

function freqForCoord(y: number): number {
  return Math.round(220 + (220 - y) * 2.8);
}

function directionWord(index: number, turn: number): string {
  if (index < turn) return "RISING";
  if (index === turn) return "TURN";
  return "FALLING";
}

function monotone(points: readonly [number, number][]): string {
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
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const c1x = points[i][0] + dx[i] / 3;
    const c1y = points[i][1] + (m[i] * dx[i]) / 3;
    const c2x = points[i + 1][0] - dx[i] / 3;
    const c2y = points[i + 1][1] - (m[i + 1] * dx[i]) / 3;
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

export function WaveformRibbonsGame({
  sharedResult = null,
}: {
  readonly sharedResult?: SharedRibbonsResult | null;
}) {
  const [patternIdx, setPatternIdx] = useState(0);
  const [pointIdx, setPointIdx] = useState(1);
  const [season, setSeason] = useState<string>("Spring");
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(Boolean(sharedResult));
  const [infoOpen, setInfoOpen] = useState(false);
  const [live, setLive] = useState("");
  const [shareNote, setShareNote] = useState("");
  const chartRef = useRef<SVGSVGElement | null>(null);
  const infoRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const eqRef = useRef<HTMLSpanElement | null>(null);
  const previewRef = useRef<(freq: number) => void>(() => {});
  const toneRef = useRef<typeof import("tone") | null>(null);
  const synthRef = useRef<import("tone").Synth | null>(null);
  const chimeRef = useRef<import("tone").Synth | null>(null);
  const meterRef = useRef<import("tone").Meter | null>(null);
  const tokenRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const [audio, setAudio] = useState<"idle" | "playing">("idle");
  const [toneState, setToneState] = useState("suspended");
  const [cue, setCue] = useState("");
  const fillId = `${useId().replace(/:/g, "")}fill`;
  const glowId = `${useId().replace(/:/g, "")}glow`;
  const plotClipId = `${useId().replace(/:/g, "")}plot`;

  const pattern = PATTERNS[patternIdx] ?? PATTERNS[0];
  const geometry = chartGeometry(pattern.points);
  const point = geometry.mapped[pointIdx] ?? geometry.mapped[0];
  const freq = freqForCoord(pattern.points[pointIdx]?.[1] ?? 160);
  const month = pattern.months[pointIdx] ?? "";
  const direction = directionWord(pointIdx, pattern.turnIndex);
  const valueText = `${month}, ${direction.toLowerCase()}, ${freq} hertz`;

  const moveTo = useCallback(
    (next: number, announce = true) => {
      const clamped = Math.max(0, Math.min(pattern.points.length - 1, next));
      setPointIdx(clamped);
      const y = pattern.points[clamped]?.[1];
      if (y !== undefined) previewRef.current(freqForCoord(y));
      if (announce) setLive("");
    },
    [pattern.points],
  );

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

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  const arm = async () => {
    const Tone = toneRef.current ?? (await import("tone"));
    toneRef.current = Tone;
    await Tone.start();
    const state = Tone.getContext().state;
    setToneState(state);
    if (rootRef.current) rootRef.current.dataset.tone = state;
    if (!synthRef.current) {
      const synth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.4, release: 0.16 },
      }).toDestination();
      synth.volume.value = -6;
      const meter = new Tone.Meter({ normalRange: true, smoothing: 0.4 });
      synth.connect(meter);
      synthRef.current = synth;
      meterRef.current = meter;
    }
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

  const stopPreview = () => {
    tokenRef.current += 1;
    clearTimers();
    synthRef.current?.triggerRelease(toneRef.current?.now());
    setAudio("idle");
    setCue("Stopped.");
  };

  const preview = async (freq: number) => {
    const token = (tokenRef.current += 1);
    try {
      const Tone = await arm();
      if (tokenRef.current !== token) return;
      clearTimers();
      synthRef.current?.triggerAttack(freq, Tone.now());
      setAudio("playing");
      setCue(`Playing ${freq} hertz.`);
      timersRef.current.push(
        window.setTimeout(() => {
          if (tokenRef.current !== token) return;
          synthRef.current?.triggerRelease(Tone.now());
          timersRef.current.push(
            window.setTimeout(() => {
              if (tokenRef.current !== token) return;
              setAudio("idle");
              setCue("Stopped.");
            }, 200),
          );
        }, 900),
      );
    } catch {
      if (tokenRef.current !== token) return;
      setAudio("idle");
      setCue("The preview did not play.");
    }
  };

  previewRef.current = (nextFreq: number) => {
    void preview(nextFreq);
  };

  const chime = async () => {
    try {
      const Tone = await arm();
      chimeRef.current?.triggerAttackRelease(587.33, 0.14, Tone.now());
      chimeRef.current?.triggerAttackRelease(880, 0.28, Tone.now() + 0.15);
    } catch {
      setCue("The preview did not play.");
    }
  };

  useEffect(() => {
    return () => {
      clearTimers();
      synthRef.current?.dispose();
      chimeRef.current?.dispose();
      meterRef.current?.dispose();
      synthRef.current = null;
      chimeRef.current = null;
      meterRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audio !== "playing") {
      eqRef.current?.style.setProperty("--level", "0");
      if (rootRef.current) rootRef.current.dataset.meter = "0";
      return;
    }
    let frame = 0;
    const tick = () => {
      const value = meterRef.current?.getValue();
      const level = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
      eqRef.current?.style.setProperty("--level", level.toFixed(3));
      if (rootRef.current) {
        rootRef.current.dataset.meter = level.toFixed(3);
        const state = toneRef.current?.getContext().state;
        if (state) rootRef.current.dataset.tone = state;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [audio]);

  const onChartKey = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveTo(pointIdx + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveTo(pointIdx - 1);
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

  const check = () => {
    const correct = pointIdx === pattern.turnIndex;
    setLive(correct ? pattern.turnReason : pattern.missHint);
    if (!correct) return;
    void chime();
    setScore((value) => value + 100);
    if (patternIdx < PATTERNS.length - 1) {
      const next = patternIdx + 1;
      setPatternIdx(next);
      setPointIdx(1);
      setSeason(PATTERNS[next].defaultSeason);
      setInfoOpen(false);
    } else {
      stopPreview();
      setIsComplete(true);
    }
  };

  const restart = () => {
    setPatternIdx(0);
    setPointIdx(1);
    setSeason(PATTERNS[0].defaultSeason);
    setScore(0);
    setLive("");
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
          <span className={styles.shell} style={{ clipPath: clip(8) }} aria-hidden="true">
            <span className={styles.face} style={{ clipPath: clip(8), width: 44, height: 44 }}>
              ✓
            </span>
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
            <Link href="/challenge/ribbons" className={styles.shell} style={{ clipPath: clip(10), background: "#f2f2f0", textDecoration: "none" }}>
              <span className={styles.face} style={{ clipPath: clip(10), background: "#f2f2f0", color: "#141414", minWidth: "8rem" }}>
                Play again
              </span>
            </Link>
          ) : (
            <button type="button" className={styles.shell} style={{ clipPath: clip(10), background: "#f2f2f0" }} onClick={restart}>
              <span className={styles.face} style={{ clipPath: clip(10), background: "#f2f2f0", color: "#141414", minWidth: "8rem" }}>
                Play again
              </span>
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
    >
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.num}>03</span>
          <h1>{pattern.shortTitle}</h1>
          <span className={styles.infoWrap}>
          <button
            ref={infoRef}
            type="button"
            className={`${styles.shell} ${styles.info} c3-info`}
            style={{ clipPath: clip(7) }}
            aria-expanded={infoOpen}
            aria-controls="ribbon-info"
            aria-label="How this challenge works"
            onClick={() => setInfoOpen((open) => !open)}
          >
            <span className={styles.face} style={{ clipPath: clip(7) }}>
              i
            </span>
          </button>
          {infoOpen ? (
            <div
              ref={dialogRef}
              id="ribbon-info"
              className={styles.popover}
              style={{ clipPath: clip(12) }}
              role="dialog"
              aria-label="How it works"
              tabIndex={-1}
            >
              <div className={styles.popoverFace} style={{ clipPath: clip(12) }}>
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
        <svg
          ref={chartRef}
          className={styles.curve}
          viewBox={`0 0 ${VW} ${VH}`}
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
          {XS.map((x, index) => (
            <line key={`tick-${index}`} x1={x} y1={BASE} x2={x} y2={BASE + 8} stroke="rgba(242,242,240,0.35)" strokeWidth="1" />
          ))}
        </svg>
        <div className={styles.months} aria-hidden="true">
          {pattern.months.map((name, index) => (
            <span key={`label-${index}`} className={index === pointIdx ? styles.monthOn : styles.month} style={{ left: `${(XS[index] / VW) * 100}%` }}>
              {name.toUpperCase()}
            </span>
          ))}
        </div>
        <div className={styles.markerCol} style={{ left: `${(point[0] / VW) * 100}%` }} aria-hidden="true">
          <div className={`${styles.tip} c3-tip`} style={{ clipPath: clip(6), top: `${(point[1] / VH) * 100}%` }}>
            <span className={styles.tipFace} style={{ clipPath: clip(6) }}>
              {month.toUpperCase()} · {direction} · {freq} HZ
            </span>
          </div>
          <span className={styles.stem} style={{ top: `${(point[1] / VH) * 100}%`, height: `${((BASE - point[1]) / VH) * 100}%` }} />
          <span className={styles.ring} style={{ top: `${(point[1] / VH) * 100}%` }} />
        </div>
      </div>

      <div className={styles.controls}>
        <p className={styles.prompt}>Where does it turn?</p>
        <div className={styles.seasons} role="group" aria-label="Select season context">
          {SEASONS.map((name) => {
            const on = season === name;
            return (
              <button
                key={name}
                type="button"
                className={`${styles.shell} c3-season${on ? " bg-[#f2f2f0]" : ""}`}
                style={{ clipPath: clip(8) }}
                aria-pressed={on}
                onClick={() => setSeason(name)}
              >
                <span className={styles.face} style={{ clipPath: clip(8) }}>
                  {name}
                </span>
              </button>
            );
          })}
        </div>
        <div className={styles.actions}>
          <div className={styles.playGroup}>
            <button
              type="button"
              className={`${styles.shell} ${styles.play} c3-play`}
              style={{ clipPath: clip(8) }}
              aria-pressed={audio === "playing"}
              data-testid="ribbons-play"
              aria-label={audio === "playing" ? "Pause selected point" : "Hear selected point"}
              onClick={() => {
                if (audio === "playing") stopPreview();
                else void preview(freq);
              }}
            >
              <span className={styles.face} style={{ clipPath: clip(8) }} aria-hidden="true">
                {audio === "playing" ? (
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <path d="M2.2 1.5 H4.4 V10.5 H2.2 Z M7.6 1.5 H9.8 V10.5 H7.6 Z" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12">
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
          <button type="button" className={`${styles.shell} ${styles.check} c3-check`} style={{ clipPath: clip(8) }} onClick={check}>
            <span className={styles.face} style={{ clipPath: clip(8) }}>
              Check
            </span>
          </button>
        </div>
      </div>
      <p className={styles.sr} role="status" aria-live="polite">
        {live}
        {cue ? ` ${cue}` : ""}
      </p>
    </main>
  );
}
