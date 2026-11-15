"use client";

import { useState, useCallback, useRef, useId } from "react";
import Link from "next/link";
import { PlayFrame } from "@/components/play/PlayFrame";
import { CutButton } from "@/components/play/CutControls";
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
            className="flex size-20 items-center justify-center rounded-full border border-[#f2f2f0]/20 bg-[#f2f2f0]/5 text-3xl text-[#f2f2f0]"
            aria-hidden="true"
          >
            ✓
          </div>

          <h2 className="font-sans text-3xl font-medium tracking-tight text-[#f2f2f0]">
            {sharedResult ? "Waveform Ribbons Shared Score" : "Seasonal Harmonics Aligned"}
          </h2>

          <p className="font-mono text-sm text-[#f2f2f0]/70">
            Total Score:{" "}
            <strong className="text-[#f2f2f0]">{displayScore} PTS</strong>
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
              <CutButton
                solid
                onClick={handleRestart}
                className="font-mono text-xs font-bold uppercase tracking-wider"
              >
                Play Again
              </CutButton>
            ) : (
              <Link href="/challenge/ribbons">
                <CutButton solid className="font-mono text-xs font-bold uppercase tracking-wider">
                  Play Waveform Ribbons
                </CutButton>
              </Link>
            )}
            <Link href="/challenge">
              <CutButton className="font-mono text-xs font-semibold uppercase tracking-wider">
                Back to Challenges
              </CutButton>
            </Link>
          </div>
        </div>
      </PlayFrame>
    );
  }

  return (
    <PlayFrame
      title="Challenge 03 · Waveform Ribbons"
      toolbar={
        <div className="flex items-center gap-3 font-mono text-xs text-[#f2f2f0]/70">
          <span>
            Score: <strong className="text-[#f2f2f0]">{score}</strong>
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
        <div className="grid items-end gap-6 border-b border-[#f2f2f0]/10 pb-6 md:grid-cols-[1.4fr_0.6fr]">
          <div>
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.17em] text-[#aaaaaa]">
              03 / Seasonal Pattern / Planetary Respiration
            </div>
            <h2 className="my-2 font-sans text-2xl font-semibold tracking-tight text-[#f2f2f0] sm:text-3xl">
              {pattern.title}
            </h2>
            <p className="max-w-2xl font-sans text-sm leading-relaxed text-[#f2f2f0]/70">
              {pattern.subtitle}. Tap the curve or move the slider to find where the annual acoustic
              profile turns.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <span className="sonify-chamfer-panel border border-[#f2f2f0]/10 bg-[#141414] px-3 py-2 font-mono text-xs text-[#f2f2f0]/70">
              <strong className="text-[#f2f2f0]">Input:</strong> Season + Point
            </span>
            <span className="sonify-chamfer-panel border border-[#f2f2f0]/10 bg-[#141414] px-3 py-2 font-mono text-xs text-[#f2f2f0]/70">
              <strong className="text-[#f2f2f0]">Audio:</strong> Cycle Sweep
            </span>
          </div>
        </div>

        {/* Main Stage Grid */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Main Play Card */}
          <div className="flex flex-col gap-5 sonify-chamfer-panel border border-[#f2f2f0]/10 bg-[#262626] p-5 sm:p-6">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaaaaa]">
                Explore the cycle
              </span>
              <h3 className="my-1 font-sans text-xl font-medium tracking-tight text-[#f2f2f0] sm:text-2xl">
                Where does the line turn?
              </h3>
              <p className="font-sans text-xs text-[#f2f2f0]/70 sm:text-sm">
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
                    className={`min-h-[38px] sonify-chamfer-panel px-3.5 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider transition-all ${
                      isActive
                        ? "bg-[#f2f2f0] text-[#141414]"
                        : "border border-[#f2f2f0]/15 bg-[#141414] text-[#aaaaaa] hover:border-[#f2f2f0]/30 hover:text-[#f2f2f0]"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            {/* Interactive SVG Plot */}
            <div
              className="relative h-[240px] w-full overflow-hidden sonify-chamfer-panel border border-[#f2f2f0]/10 sm:h-[270px]"
              style={{
                background: `
                  linear-gradient(180deg, transparent 24%, rgba(242,242,240,0.04) 25%, transparent 26%, transparent 49%, rgba(242,242,240,0.04) 50%, transparent 51%, transparent 74%, rgba(242,242,240,0.04) 75%, transparent 76%),
                  linear-gradient(90deg, #1b1b1b, #141414)
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
                  stroke="rgba(242,242,240,0.18)"
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
                    stroke={idx === pointIdx ? "rgba(242,242,240,0.4)" : "rgba(242,242,240,0.08)"}
                    strokeWidth={idx === pointIdx ? "2" : "1"}
                    strokeDasharray={idx === pointIdx ? "4 4" : undefined}
                  />
                ))}

                {/* Seasonal Polyline Ribbon */}
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="#f2f2f0"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Interactive marker dot */}
                <circle
                  cx={currentCoord[0]}
                  cy={currentCoord[1]}
                  r="9"
                  fill="#f2f2f0"
                  stroke="#141414"
                  strokeWidth="2.5"
                />
              </svg>
            </div>

            {/* Accessible slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between font-mono text-xs text-[#f2f2f0]/70">
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
                className="h-2 w-full cursor-pointer accent-[#f2f2f0]"
                aria-valuetext={`Point ${pointIdx + 1} of 7, ${directionText}, frequency ${currentFreq} hertz`}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <CutButton
                onClick={() => playToneSnippet(currentFreq)}
                className="font-mono text-xs font-semibold uppercase tracking-wider"
              >
                ▶ Hear selected point
              </CutButton>

              {!checked || !isCorrect ? (
                <CutButton
                  onClick={handleCheckAnswer}
                  className="font-mono text-xs font-semibold uppercase tracking-wider"
                >
                  Check my answer
                </CutButton>
              ) : (
                <CutButton
                  solid
                  onClick={handleNextPattern}
                  className="font-mono text-xs font-bold uppercase tracking-wider"
                >
                  {patternIdx < PATTERNS.length - 1 ? "Next Pattern →" : "See Result ↗"}
                </CutButton>
              )}
            </div>
          </div>

          {/* Side Context & Feedback Card */}
          <aside className="flex flex-col gap-4 sonify-chamfer-panel border border-[#f2f2f0]/10 bg-[#262626] p-5 text-[#f2f2f0]">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaaaaa]">
                Read the signal
              </span>
              <h3 className="my-1 font-sans text-xl font-medium tracking-tight text-[#f2f2f0]">
                {season} Context
              </h3>
              <p className="font-sans text-xs leading-relaxed text-[#f2f2f0]/70">
                {pattern.seasonClues[season] ?? pattern.subtitle}
              </p>
            </div>

            <div className="flex flex-col border-t border-[#f2f2f0]/10 pt-3 text-xs">
              <div className="flex items-center justify-between border-b border-[#f2f2f0]/10 py-2">
                <span className="text-[#aaaaaa]">Point</span>
                <b className="font-mono text-[#f2f2f0]">
                  {pointIdx + 1} of {pattern.points.length}
                </b>
              </div>
              <div className="flex items-center justify-between border-b border-[#f2f2f0]/10 py-2">
                <span className="text-[#aaaaaa]">Direction</span>
                <b className="font-mono text-[#f2f2f0]">{directionText}</b>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[#aaaaaa]">Acoustic Pitch</span>
                <b className="font-mono text-[#f2f2f0]">{currentFreq} Hz</b>
              </div>
            </div>

            {/* Dynamic Status / Feedback Block */}
            <div
              role="status"
              aria-live="polite"
              className={`sonify-chamfer-panel p-3.5 text-xs leading-relaxed transition-all ${
                checked
                  ? isCorrect
                    ? "border border-[#f2f2f0]/30 bg-[#141414] text-[#f2f2f0]"
                    : "border border-[#f2f2f0]/20 bg-[#1a1a1a] text-[#f2f2f0]/80"
                  : "border border-[#f2f2f0]/10 bg-[#141414] text-[#aaaaaa]"
              }`}
            >
              {checked
                ? isCorrect
                  ? pattern.turnReason
                  : pattern.missHint
                : "Find the point where the pattern changes direction, then test your answer."}
            </div>

            <p className="mt-auto font-sans text-[11px] leading-relaxed text-[#f2f2f0]/50">
              {pattern.scientificFact}
            </p>
          </aside>
        </div>
      </div>
    </PlayFrame>
  );
}
