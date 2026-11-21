"use client";

import { useState, useCallback, useRef, useId } from "react";
import Link from "next/link";
import { CutButton } from "@/components/play/CutControls";
import { ChallengeShareActions } from "@/components/play/ChallengeShareActions";
import { encodeRibbonsResult, type SharedRibbonsResult } from "@/lib/challengeResults";
import styles from "./ribbons.module.css";

const PLOT = { x: -48, y: 0, w: 696, h: 320 };

function clip(cut: number) {
  return `polygon(${cut}px 0, calc(100% - ${cut}px) 0, 100% ${cut}px, 100% calc(100% - ${cut}px), calc(100% - ${cut}px) 100%, ${cut}px 100%, 0 calc(100% - ${cut}px), 0 ${cut}px)`;
}

interface RibbonPattern {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly defaultSeason: string;
  readonly seasonClues: Record<string, string>;
  readonly turnIndex: number;
  readonly points: readonly [number, number][];
  readonly months: readonly string[];
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
    months: ["Nov", "Jan", "Mar", "May", "Jul", "Sep", "Nov"],
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
    months: ["Mar", "May", "Jul", "Sep", "Nov", "Jan", "Mar"],
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
    months: ["Feb", "Apr", "Jun", "Aug", "Oct", "Dec", "Feb"],
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
  const glowId = `${useId().replace(/:/g, "")}glow`;
  const fillId = `${useId().replace(/:/g, "")}fill`;
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
    const scale = Math.min(rect.width / PLOT.w, rect.height / PLOT.h);
    if (!(scale > 0)) return;
    const offsetX = (rect.width - PLOT.w * scale) / 2;
    const relativeX = (event.clientX - rect.left - offsetX) / scale + PLOT.x;

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
  const ribbonArea = `M${pattern.points.map(([x, y]) => `${x},${y}`).join(" L")} L600,220 L0,220 Z`;

  const month = pattern.months[pointIdx] ?? "";
  const shell = (cut: number) => ({ clipPath: clip(cut) });

  if (isComplete) {
    const displayScore = sharedResult ? sharedResult.totalScore : score;
    const displaySolved = sharedResult ? sharedResult.patternsSolved : PATTERNS.length;

    return (
      <main id="main-content" tabIndex={-1} className={styles.page}>
        <div className={styles.result} data-testid="ribbons-result">
          <Link href="/challenge" className={styles.back}>
            ← Challenges
          </Link>
          <div className={`${styles.mark} c3-readout`} style={shell(10)} aria-hidden="true">
            <span className={styles.markFace} style={shell(10)}>
              ✓
            </span>
          </div>
          <h1>{sharedResult ? "Waveform Ribbons Shared Score" : "Seasonal Harmonics Aligned"}</h1>
          <p className={styles.points}>
            Total Score: <strong>{displayScore} PTS</strong>
          </p>
          <p>
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
          <div className={styles.resultActions}>
            {!sharedResult ? (
              <CutButton solid onClick={handleRestart}>
                Play Again
              </CutButton>
            ) : (
              <Link href="/challenge/ribbons">
                <CutButton solid>Play Waveform Ribbons</CutButton>
              </Link>
            )}
            <Link href="/challenge">
              <CutButton>Back to Challenges</CutButton>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <header className={styles.top}>
        <div className={styles.identity}>
          <Link href="/challenge" className={styles.back}>
            ← Challenges
          </Link>
          <p className={styles.kicker}>03 / Seasonal pattern / Planetary respiration</p>
          <h1>Challenge 03 · Waveform Ribbons</h1>
        </div>
        <div className={styles.tools}>
          <span className={styles.tag} style={shell(8)}>
            <span className={styles.tagFace} style={shell(8)}>
              Score <strong>{score}</strong>
            </span>
          </span>
          <span className={styles.tag} style={shell(8)}>
            <span className={styles.tagFace} style={shell(8)}>
              Pattern {patternIdx + 1} of {PATTERNS.length}
            </span>
          </span>
          <span className={styles.tag} style={shell(8)}>
            <span className={styles.tagFace} style={shell(8)}>
              <strong>Input</strong> Season + Point
            </span>
          </span>
          <span className={styles.tag} style={shell(8)}>
            <span className={styles.tagFace} style={shell(8)}>
              <strong>Audio</strong> Cycle Sweep
            </span>
          </span>
        </div>
      </header>

      <div className={styles.lede}>
        <h2>{pattern.title}</h2>
        <p>
          {pattern.subtitle}. Tap the curve or move the slider to find where the annual acoustic profile turns.
        </p>
      </div>

      <div className={`${styles.stage} c3-plot`}>
        <svg
          ref={plotRef}
          viewBox={`${PLOT.x} ${PLOT.y} ${PLOT.w} ${PLOT.h}`}
          preserveAspectRatio="xMidYMid meet"
          onClick={handlePlotClick}
          role="img"
          aria-label={`Interactive seasonal curve for ${pattern.title}. Marker at ${month}, point ${pointIdx + 1} of 7.`}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f2f2f0" stopOpacity="0.42" />
              <stop offset="72%" stopColor="#f2f2f0" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#f2f2f0" stopOpacity="0" />
            </linearGradient>
            <filter id={glowId} x="-20%" y="-60%" width="140%" height="220%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>
          <line className={styles.baseline} x1="0" y1="220" x2="600" y2="220" />
          {pattern.points.map(([x], idx) => (
            <line
              key={idx}
              className={idx === pointIdx ? styles.guideOn : styles.guide}
              x1={x}
              y1="36"
              x2={x}
              y2="220"
            />
          ))}
          <path className={styles.fill} d={ribbonArea} fill={`url(#${fillId})`} />
          <polyline className={styles.glow} points={polylinePoints} filter={`url(#${glowId})`} />
          <polyline className={styles.ribbon} points={polylinePoints} />
          <g className={styles.marker}>
            <line x1={currentCoord[0]} y1={currentCoord[1]} x2={currentCoord[0]} y2="220" />
            <circle cx={currentCoord[0]} cy={currentCoord[1]} r="18" />
            <circle cx={currentCoord[0]} cy={currentCoord[1]} r="6" />
          </g>
          {pattern.points.map(([x], idx) => (
            <text
              key={`m-${idx}`}
              className={idx === pointIdx ? styles.monthOn : styles.month}
              x={x}
              y="268"
              textAnchor="middle"
            >
              {pattern.months[idx]}
            </text>
          ))}
        </svg>
      </div>

      <section className={`${styles.rail} c3-readout`} style={shell(18)} aria-label="Cycle controls">
        <div className={styles.railFace} style={shell(18)}>
          <div className={styles.railGrid}>
            <div>
              <p className={styles.kicker} id="ribbon-question">
                Where does the line turn?
              </p>
              <div className={styles.seasons} role="group" aria-label="Select season context">
                {SEASONS.map((s) => {
                  const isActive = season === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeason(s)}
                      aria-pressed={isActive}
                      className={`${styles.shell} ${styles.season} c3-season${isActive ? ` ${styles.on} bg-[#f2f2f0]` : ""}`}
                      style={shell(11)}
                    >
                      <span className={styles.face} style={shell(11)}>
                        {s}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.play}>
              <div className={styles.sliderMeta}>
                <label htmlFor={sliderId}>Point in cycle</label>
                <b>
                  Point {pointIdx + 1} of {pattern.points.length} · {month} · {currentFreq} Hz
                </b>
              </div>
              <input
                id={sliderId}
                type="range"
                min="0"
                max={pattern.points.length - 1}
                value={pointIdx}
                onChange={(e) => handleSelectPoint(Number(e.target.value))}
                className={styles.range}
                aria-valuetext={`Point ${pointIdx + 1} of 7, ${month}, ${directionText}, frequency ${currentFreq} hertz`}
              />
              <div className={styles.actions}>
                <CutButton onClick={() => playToneSnippet(currentFreq)}>Hear selected point</CutButton>
                {!checked || !isCorrect ? (
                  <CutButton onClick={handleCheckAnswer}>Check my answer</CutButton>
                ) : (
                  <CutButton solid onClick={handleNextPattern}>
                    {patternIdx < PATTERNS.length - 1 ? "Next Pattern →" : "See Result ↗"}
                  </CutButton>
                )}
              </div>
            </div>

            <aside className={styles.read} aria-label="Signal readout">
              <h3>{season} Context</h3>
              <p>{pattern.seasonClues[season] ?? pattern.subtitle}</p>
              <dl className={styles.stats}>
                <div>
                  <dt>Point</dt>
                  <dd>
                    {pointIdx + 1} of {pattern.points.length}
                  </dd>
                </div>
                <div>
                  <dt>Direction</dt>
                  <dd>{directionText}</dd>
                </div>
                <div>
                  <dt>Acoustic pitch</dt>
                  <dd>{currentFreq} Hz</dd>
                </div>
              </dl>
              <p className={styles.fact}>{pattern.scientificFact}</p>
            </aside>
          </div>
          <div className={styles.status} role="status" aria-live="polite" data-tone={checked && isCorrect ? "yes" : "idle"}>
            {checked
              ? isCorrect
                ? pattern.turnReason
                : pattern.missHint
              : "Find the point where the pattern changes direction, then test your answer."}
          </div>
        </div>
      </section>
    </main>
  );
}
