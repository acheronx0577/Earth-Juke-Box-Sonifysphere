"use client";

import { useState, useCallback, useRef, useId } from "react";
import Link from "next/link";
import { PlayFrame } from "@/components/play/PlayFrame";
import { ChallengeShareActions } from "@/components/play/ChallengeShareActions";
import { encodeRibbonsResult, type SharedRibbonsResult } from "@/lib/challengeResults";

interface RibbonPattern {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly defaultSeason: string;
  readonly seasonClues: Record<string, string>;
  readonly turnIndex: number;
  readonly points: readonly [number, number][];
  readonly turnReason: string;
  readonly missHint: string;
  readonly scientificFact: string;
}

const PATTERNS: readonly RibbonPattern[] = [
  {
    id: "co2-keeling",
    title: "Atmospheric CO₂ Cycle",
    subtitle: "Northern Hemisphere forest bloom and decay (~6 ppm annual swing)",
    defaultSeason: "Spring",
    seasonClues: {
      Spring: "In late spring (May), atmospheric CO₂ reaches its annual peak before expansive northern forests awaken.",
      Summer: "During summer, intense photosynthesis draws billions of tons of carbon into plant biomass, pulling concentrations down.",
      Autumn: "In early autumn (September/October), CO₂ reaches its seasonal minimum before leaves drop.",
      Winter: "Throughout winter, plant respiration and microbial decay release carbon back into the air, driving levels up.",
    },
    turnIndex: 3, // Point 4 (0-indexed 3)
    points: [
      [0, 185],
      [100, 160],
      [200, 105],
      [300, 70],
      [400, 90],
      [500, 145],
      [600, 190],
    ],
    turnReason: "Yes! At point 4 (late spring / May), atmospheric CO₂ crests before Northern Hemisphere photosynthesis accelerates.",
    missHint: "Look for point 4, where the curve reaches its maximum peak before declining into the summer drawdown.",
    scientificFact: "Charles Keeling first observed this planetary 'inhale' in 1958 atop Mauna Loa. The curve turns when forest uptake overtakes respiration.",
  },
  {
    id: "sea-ice-minimum",
    title: "Arctic Sea Ice Extent Cycle",
    subtitle: "Annual freeze-thaw rhythm of polar pack ice",
    defaultSeason: "Autumn",
    seasonClues: {
      Spring: "As the sun rises above the horizon, the ice pack begins warming from its winter maximum.",
      Summer: "Continuous sunlight accelerates surface melt and peripheral floe breakup.",
      Autumn: "In late September, solar radiation drops below critical thresholds, halting melt at the annual minimum.",
      Winter: "Sub-zero polar night triggers rapid freeze-up across the Arctic basin.",
    },
    turnIndex: 3, // Point 4 (trough turning point)
    points: [
      [0, 80],
      [100, 115],
      [200, 160],
      [300, 205],
      [400, 175],
      [500, 125],
      [600, 85],
    ],
    turnReason: "Correct! Point 4 marks the annual September minimum extent, after which freezing resumes.",
    missHint: "Check point 4, the deepest trough where the summer melt stops and freeze-up begins.",
    scientificFact: "NASA passive microwave satellites have tracked this September turning point continuously since 1979.",
  },
  {
    id: "ocean-heat-content",
    title: "Global Upper Ocean Heat Cycle",
    subtitle: "Hemispheric solar heating and oceanic thermal lag",
    defaultSeason: "Summer",
    seasonClues: {
      Spring: "Increasing solar insolation warms upper mixed layers slowly due to water's high heat capacity.",
      Summer: "Peak thermal absorption occurs across temperate and subtropical gyres.",
      Autumn: "Stored heat slowly dissipates into the cooler atmosphere via latent heat flux.",
      Winter: "Strong winds and cooling drive deep convective overturning.",
    },
    turnIndex: 3, // Point 4 (peak heat turn)
    points: [
      [0, 180],
      [100, 150],
      [200, 100],
      [300, 65],
      [400, 85],
      [500, 140],
      [600, 185],
    ],
    turnReason: "Spot on! Point 4 represents the late-summer crest in upper ocean heat content before autumn cooling.",
    missHint: "Point 4 represents the thermal peak where heat accumulation crests before releasing back to the atmosphere.",
    scientificFact: "Over 90% of Earth's trapped excess energy resides in oceans, tracked by the Argo profiling array and ECCO-2 models.",
  },
];

const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;

function freqForCoord(y: number): number {
  return Math.round(220 + (220 - y) * 2.8);
}

function playToneSnippet(freq: number, duration = 0.35) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // AudioContext blocked or not supported
  }
}

function playSuccessChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  } catch {}
}

const CHAMFER_CLIP =
  "polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)";

export function WaveformRibbonsGame({
  sharedResult = null,
}: {
  readonly sharedResult?: SharedRibbonsResult | null;
}) {
  const [patternIdx, setPatternIdx] = useState(0);
  const [pointIdx, setPointIdx] = useState(1);
  const [season, setSeason] = useState<string>("Spring");
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(Boolean(sharedResult));
  const sliderId = useId();
  const plotRef = useRef<SVGSVGElement | null>(null);

  const pattern = PATTERNS[patternIdx] ?? PATTERNS[0];
  const currentCoord = pattern.points[pointIdx] ?? pattern.points[0];
  const currentFreq = freqForCoord(currentCoord[1]);

  const directionText =
    pointIdx < pattern.turnIndex
      ? "Rising toward peak"
      : pointIdx === pattern.turnIndex
        ? "Turning Point"
        : "Falling from peak";

  const handleSelectPoint = useCallback(
    (newIdx: number) => {
      const clamped = Math.max(0, Math.min(pattern.points.length - 1, newIdx));
      setPointIdx(clamped);
      setChecked(false);
      const targetCoord = pattern.points[clamped];
      if (targetCoord) {
        playToneSnippet(freqForCoord(targetCoord[1]));
      }
    },
    [pattern.points]
  );

  const handlePlotClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = plotRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * 600;

    let closestIdx = 0;
    let minDistance = Number.POSITIVE_INFINITY;
    pattern.points.forEach(([x], idx) => {
      const distance = Math.abs(x - relativeX);
      if (distance < minDistance) {
        minDistance = distance;
        closestIdx = idx;
      }
    });
    handleSelectPoint(closestIdx);
  };

  const handleCheckAnswer = () => {
    const correct = pointIdx === pattern.turnIndex;
    setIsCorrect(correct);
    setChecked(true);
    if (correct) {
      playSuccessChime();
      setScore((s) => s + 100);
    }
  };

  const handleNextPattern = () => {
    if (patternIdx < PATTERNS.length - 1) {
      const nextIdx = patternIdx + 1;
      setPatternIdx(nextIdx);
      setPointIdx(1);
      setSeason(PATTERNS[nextIdx].defaultSeason);
      setChecked(false);
      setIsCorrect(false);
    } else {
      setIsComplete(true);
    }
  };

  const handleRestart = () => {
    setPatternIdx(0);
    setPointIdx(1);
    setSeason(PATTERNS[0].defaultSeason);
    setChecked(false);
    setIsCorrect(false);
    setScore(0);
    setIsComplete(false);
  };

  const polylinePoints = pattern.points.map(([x, y]) => `${x},${y}`).join(" ");

  if (isComplete) {
    const displayScore = sharedResult ? sharedResult.totalScore : score;
    const displaySolved = sharedResult ? sharedResult.patternsSolved : PATTERNS.length;

    return (
      <PlayFrame title="Challenge 03 · Waveform Ribbons Complete">
        <div
          className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-6 py-12 text-center"
          data-testid="ribbons-result"
        >
          <div
            className="flex size-20 items-center justify-center rounded-full border border-[#f2f2f0]/20 bg-[#f2f2f0]/5 text-3xl text-[#c8fa8b]"
            aria-hidden="true"
          >
            ✓
          </div>

          <h2 className="font-sans text-3xl font-medium tracking-tight text-[#f2f2f0]">
            {sharedResult ? "Waveform Ribbons Shared Score" : "Seasonal Harmonics Aligned"}
          </h2>

          <p className="font-mono text-sm text-[#f2f2f0]/70">
            Total Score:{" "}
            <strong className="text-[#c8fa8b]">{displayScore} PTS</strong>
          </p>

          <p className="max-w-md font-sans text-sm text-[#f2f2f0]/80">
            You tracked Earth&apos;s atmospheric respiration and ocean cycles by ear. Each seasonal curve
            reflects planetary-scale biome energy exchanges.
          </p>

          <ChallengeShareActions
            path="/challenge/ribbons"
            params={{
              result: encodeRibbonsResult({
                patternsSolved: displaySolved,
                totalScore: displayScore,
              }),
            }}
            title="Waveform Ribbons"
            score={`${displayScore} PTS`}
            detail={`${displaySolved} of ${PATTERNS.length} seasonal cycles resolved`}
            fileName="sonifysphere-waveform-ribbons-result.png"
          />

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            {!sharedResult ? (
              <button
                type="button"
                onClick={handleRestart}
                className="inline-flex min-h-[44px] items-center justify-center bg-[#c8fa8b] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[#132013] transition-all hover:bg-[#b2ee70] active:scale-95"
                style={{ clipPath: CHAMFER_CLIP }}
              >
                Play Again
              </button>
            ) : (
              <Link
                href="/challenge/ribbons"
                className="inline-flex min-h-[44px] items-center justify-center bg-[#c8fa8b] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[#132013]"
                style={{ clipPath: CHAMFER_CLIP }}
              >
                Play Waveform Ribbons
              </Link>
            )}
            <Link
              href="/challenge"
              className="inline-flex min-h-[44px] items-center justify-center border border-[#f2f2f0]/20 bg-[#202a22] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[#f2f2f0] transition-colors hover:border-[#f2f2f0]/40"
              style={{ clipPath: CHAMFER_CLIP }}
            >
              Back to Challenges
            </Link>
          </div>
        </div>
      </PlayFrame>
    );
  }

  return (
    <PlayFrame
      title={`Challenge 03 · Waveform Ribbons`}
      toolbar={
        <div className="flex items-center gap-3 font-mono text-xs text-[#f2f2f0]/70">
          <span>
            Score: <strong className="text-[#c8fa8b]">{score}</strong>
          </span>
          <span>·</span>
          <span>
            Pattern {patternIdx + 1} of {PATTERNS.length}
          </span>
        </div>
      }
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-6 py-4">
        {/* Intro Banner */}
        <div className="grid items-end gap-6 border-b border-[rgba(242,242,240,0.14)] pb-6 md:grid-cols-[1.4fr_0.6fr]">
          <div>
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.17em] text-[#c8fa8b]">
              03 / Seasonal Pattern / Planetary Respiration
            </div>
            <h2 className="my-2 font-sans text-2xl font-semibold tracking-tight text-[#f2f2f0] sm:text-3xl">
              {pattern.title}
            </h2>
            <p className="max-w-2xl font-sans text-sm leading-relaxed text-[#acbaac]">
              {pattern.subtitle}. Tap the curve or move the slider to find where the annual acoustic
              profile turns.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <span className="rounded-lg border border-[rgba(242,242,240,0.14)] bg-[#172018] px-3 py-2 font-mono text-xs text-[#acbaac]">
              <strong className="text-[#f2f2f0]">Input:</strong> Season + Point
            </span>
            <span className="rounded-lg border border-[rgba(242,242,240,0.14)] bg-[#172018] px-3 py-2 font-mono text-xs text-[#acbaac]">
              <strong className="text-[#f2f2f0]">Audio:</strong> Cycle Sweep
            </span>
          </div>
        </div>

        {/* Main Stage Grid */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Main Play Card */}
          <div
            className="flex flex-col gap-5 bg-[#171d19] p-5 sm:p-6"
            style={{
              border: "1px solid rgba(242,242,240,0.14)",
              clipPath: CHAMFER_CLIP,
            }}
          >
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#c8fa8b]">
                Explore the cycle
              </span>
              <h3 className="my-1 font-sans text-xl font-medium tracking-tight text-[#f2f2f0] sm:text-2xl">
                Where does the line turn?
              </h3>
              <p className="font-sans text-xs text-[#acbaac] sm:text-sm">
                Choose a season context, then tap the chart to place the marker. The audio follows
                the selected point.
              </p>
            </div>

            {/* Season Selectors */}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Select season context">
              {SEASONS.map((s) => {
                const isActive = season === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeason(s)}
                    className={`min-h-[38px] rounded-md px-3.5 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider transition-all ${
                      isActive
                        ? "bg-[#c8fa8b] text-[#132013]"
                        : "border border-[rgba(242,242,240,0.14)] bg-[#202a22] text-[#acbaac] hover:text-[#f2f2f0]"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            {/* Interactive SVG Plot */}
            <div
              className="relative h-[240px] w-full overflow-hidden rounded-lg sm:h-[270px]"
              style={{
                border: "1px solid rgba(242,242,240,0.14)",
                background: `
                  linear-gradient(180deg, transparent 24%, rgba(48,64,53,0.5) 25%, transparent 26%, transparent 49%, rgba(48,64,53,0.5) 50%, transparent 51%, transparent 74%, rgba(48,64,53,0.5) 75%, transparent 76%),
                  linear-gradient(90deg, #18261c, #102017)
                `,
              }}
            >
              <svg
                ref={plotRef}
                viewBox="0 0 600 260"
                preserveAspectRatio="none"
                onClick={handlePlotClick}
                className="size-full cursor-crosshair select-none"
                role="img"
                aria-label={`Interactive seasonal curve for ${pattern.title}. Marker currently at point ${pointIdx + 1} of 7.`}
              >
                {/* Baseline reference */}
                <line
                  x1="0"
                  y1="220"
                  x2="600"
                  y2="220"
                  stroke="rgba(82,102,83,0.6)"
                  strokeWidth="1"
                />

                {/* Subtle vertical marker lines */}
                {pattern.points.map(([x], idx) => (
                  <line
                    key={idx}
                    x1={x}
                    y1="40"
                    x2={x}
                    y2="220"
                    stroke={idx === pointIdx ? "rgba(200,250,139,0.35)" : "rgba(82,102,83,0.2)"}
                    strokeWidth={idx === pointIdx ? "2" : "1"}
                    strokeDasharray={idx === pointIdx ? "4 4" : undefined}
                  />
                ))}

                {/* Seasonal Polyline Ribbon */}
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="#c8fa8b"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Interactive marker dot */}
                <circle
                  cx={currentCoord[0]}
                  cy={currentCoord[1]}
                  r="9"
                  fill="#c8fa8b"
                  stroke="#101813"
                  strokeWidth="2"
                />
              </svg>
            </div>

            {/* Accessible slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between font-mono text-xs text-[#acbaac]">
                <label htmlFor={sliderId}>Point in cycle:</label>
                <span className="font-semibold text-[#f2f2f0]">
                  Point {pointIdx + 1} of {pattern.points.length} ({currentFreq} Hz)
                </span>
              </div>
              <input
                id={sliderId}
                type="range"
                min="0"
                max={pattern.points.length - 1}
                value={pointIdx}
                onChange={(e) => handleSelectPoint(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-[#c8fa8b]"
                aria-valuetext={`Point ${pointIdx + 1} of 7, ${directionText}, frequency ${currentFreq} hertz`}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => playToneSnippet(currentFreq)}
                className="inline-flex min-h-[44px] items-center justify-center bg-[#c8fa8b] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#132013] transition-all hover:bg-[#b2ee70] active:scale-95"
                style={{ clipPath: CHAMFER_CLIP }}
              >
                ▶ Hear selected point
              </button>

              {!checked || !isCorrect ? (
                <button
                  type="button"
                  onClick={handleCheckAnswer}
                  className="inline-flex min-h-[44px] items-center justify-center border border-[rgba(242,242,240,0.16)] bg-[#202a22] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#f2f2f0] transition-colors hover:border-[#f2f2f0]/30 active:scale-95"
                  style={{ clipPath: CHAMFER_CLIP }}
                >
                  Check my answer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNextPattern}
                  className="inline-flex min-h-[44px] items-center justify-center bg-[#f2f2f0] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#132013] transition-transform hover:scale-105 active:scale-95"
                  style={{ clipPath: CHAMFER_CLIP }}
                >
                  {patternIdx < PATTERNS.length - 1 ? "Next Pattern →" : "See Result ↗"}
                </button>
              )}
            </div>
          </div>

          {/* Side Context & Feedback Card */}
          <aside
            className="flex flex-col gap-4 bg-[#171d19] p-5 text-[#f2f2f0]"
            style={{
              border: "1px solid rgba(242,242,240,0.14)",
              clipPath: CHAMFER_CLIP,
            }}
          >
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#c8fa8b]">
                Read the signal
              </span>
              <h3 className="my-1 font-sans text-xl font-medium tracking-tight text-[#f2f2f0]">
                {season} Context
              </h3>
              <p className="font-sans text-xs leading-relaxed text-[#acbaac]">
                {pattern.seasonClues[season] ?? pattern.subtitle}
              </p>
            </div>

            <div className="flex flex-col border-t border-[rgba(242,242,240,0.14)] pt-3 text-xs">
              <div className="flex items-center justify-between border-b border-[rgba(242,242,240,0.14)] py-2">
                <span className="text-[#acbaac]">Point</span>
                <b className="font-mono text-[#f2f2f0]">
                  {pointIdx + 1} of {pattern.points.length}
                </b>
              </div>
              <div className="flex items-center justify-between border-b border-[rgba(242,242,240,0.14)] py-2">
                <span className="text-[#acbaac]">Direction</span>
                <b className="font-mono text-[#c8fa8b]">{directionText}</b>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[#acbaac]">Acoustic Pitch</span>
                <b className="font-mono text-[#f2f2f0]">{currentFreq} Hz</b>
              </div>
            </div>

            {/* Dynamic Status / Feedback Block */}
            <div
              role="status"
              aria-live="polite"
              className={`rounded-lg p-3 text-xs leading-relaxed transition-all ${
                checked
                  ? isCorrect
                    ? "border border-[#789e57] bg-[#223324] text-[#f2f2f0]"
                    : "border border-[#96665f] bg-[#352423] text-[#f2f2f0]"
                  : "border border-[rgba(242,242,240,0.14)] bg-[#111713] text-[#acbaac]"
              }`}
            >
              {checked
                ? isCorrect
                  ? pattern.turnReason
                  : pattern.missHint
                : "Find the point where the pattern changes direction, then test your answer."}
            </div>

            <p className="mt-auto font-sans text-[11px] leading-relaxed text-[#acbaac]/70">
              {pattern.scientificFact}
            </p>
          </aside>
        </div>
      </div>
    </PlayFrame>
  );
}
