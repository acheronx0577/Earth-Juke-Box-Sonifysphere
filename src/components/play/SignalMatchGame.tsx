"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type Ref } from "react";
import Link from "next/link";
import { ChamferMark } from "@/components/listen/ChamferMark";
import { ChallengeShareActions } from "@/components/play/ChallengeShareActions";
import { encodeMatchResult, type SharedMatchResult } from "@/lib/challengeResults";
import {
  CLOSE_AT,
  CLICK_GUARD_MS,
  DEFAULT_HINT,
  FREQ,
  FREQ_TICKS,
  HOLD_MS,
  LOCK_AT,
  MATCH_ROUNDS,
  Q_TICKS,
  RESONANCE,
  START_FREQ,
  START_Q,
  STUCK_HINT,
  STUCK_LISTENS,
  STUCK_MS,
  TARGET_MS,
  ZONE_HINT,
  bandOf,
  coherence,
  fluidCuts,
  lockZone,
  wavePath,
  zoneBox,
} from "@/components/play/matchSignal";
import styles from "@/components/play/match.module.css";

interface Voice {
  osc: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

function useTone() {
  const ctxRef = useRef<AudioContext | null>(null);
  const youRef = useRef<Voice | null>(null);
  const targetRef = useRef<Voice | null>(null);
  const genRef = useRef(0);

  const context = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new Ctx();
    }
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const silence = useCallback((voice: Voice | null) => {
    const ctx = ctxRef.current;
    if (!voice || !ctx) return;
    const time = ctx.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(time);
      voice.gain.gain.setTargetAtTime(0.0001, time, 0.03);
      voice.osc.stop(time + 0.16);
    } catch {
      /* already stopped */
    }
  }, []);

  const stopYou = useCallback(() => {
    silence(youRef.current);
    youRef.current = null;
  }, [silence]);

  const stopTarget = useCallback(() => {
    silence(targetRef.current);
    targetRef.current = null;
  }, [silence]);

  const stopAll = useCallback(() => {
    genRef.current += 1;
    stopYou();
    stopTarget();
  }, [stopTarget, stopYou]);

  const playTarget = useCallback((freq: number, q: number) => {
    stopYou();
    stopTarget();
    const ctx = context();
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const time = ctx.currentTime;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq, time);
    filter.Q.setValueAtTime(q, time);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.3, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, time + TARGET_MS / 1000);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(time + TARGET_MS / 1000);
    targetRef.current = { osc, filter, gain };
  }, [context, stopTarget, stopYou]);

  const startYou = useCallback((freq: number, q: number) => {
    stopYou();
    const ctx = context();
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const time = ctx.currentTime;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq, time);
    filter.Q.setValueAtTime(q, time);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.25, time + 0.05);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    youRef.current = { osc, filter, gain };
  }, [context, stopYou]);

  const glide = useCallback((freq: number, q: number) => {
    const voice = youRef.current;
    const ctx = ctxRef.current;
    if (!voice || !ctx) return;
    const time = ctx.currentTime;
    voice.osc.frequency.setTargetAtTime(freq, time, 0.03);
    voice.filter.frequency.setTargetAtTime(freq, time, 0.03);
    voice.filter.Q.setTargetAtTime(q, time, 0.03);
  }, []);

  const chime = useCallback(() => {
    const ctx = context();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const time = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, time);
    osc.frequency.exponentialRampToValueAtTime(1320, time + 0.3);
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(time + 0.5);
  }, [context]);

  const arm = useCallback(() => {
    genRef.current += 1;
    return genRef.current;
  }, []);

  const isGen = useCallback((gen: number) => genRef.current === gen, []);

  useEffect(() => {
    return () => {
      genRef.current += 1;
      silence(youRef.current);
      silence(targetRef.current);
      ctxRef.current?.close().catch(() => {});
    };
  }, [silence]);

  return { playTarget, startYou, glide, stopAll, chime, arm, isGen };
}

interface GameState {
  roundIdx: number;
  freq: number;
  q: number;
  playing: boolean;
  phase: 0 | 1 | 2;
  compares: number;
  zone: boolean;
  locked: boolean;
  skipped: boolean;
  engaged: boolean;
  shown: number;
  score: number;
  roundScores: number[];
  finished: boolean;
  stuck: boolean;
  message: string;
  pinned: boolean;
}

type GameAction =
  | { type: "tune"; freq: number; q: number; clearStuck: boolean }
  | { type: "play"; playing: boolean; phase: 0 | 1 | 2 }
  | { type: "compared"; markStuck: boolean }
  | { type: "lock"; gain: number; skipped: boolean; freq: number; q: number; shown: number; message: string }
  | { type: "zone"; on: boolean; message: string; pinned: boolean }
  | { type: "stuck" }
  | { type: "next" }
  | { type: "finish" }
  | { type: "restart" };

function fresh(roundIdx: number, score: number, roundScores: number[]): GameState {
  return {
    roundIdx,
    freq: START_FREQ,
    q: START_Q,
    playing: false,
    phase: 0,
    compares: 0,
    zone: false,
    locked: false,
    skipped: false,
    engaged: false,
    shown: 0,
    score,
    roundScores,
    finished: false,
    stuck: false,
    message: DEFAULT_HINT,
    pinned: false,
  };
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "tune": {
      if (state.locked) return state;
      const clear = action.clearStuck && state.message === STUCK_HINT;
      return {
        ...state,
        freq: action.freq,
        q: action.q,
        engaged: true,
        stuck: action.clearStuck ? false : state.stuck,
        message: clear ? DEFAULT_HINT : state.message,
        pinned: clear ? false : state.pinned,
      };
    }
    case "play":
      return { ...state, playing: action.playing, phase: action.phase };
    case "compared": {
      const stuck = state.stuck || action.markStuck;
      const announce = action.markStuck && !state.zone;
      return {
        ...state,
        compares: state.compares + 1,
        playing: true,
        phase: 1,
        stuck,
        message: announce ? STUCK_HINT : state.message,
        pinned: announce ? true : state.pinned,
      };
    }
    case "lock":
      return {
        ...state,
        locked: true,
        skipped: action.skipped,
        playing: false,
        phase: 0,
        engaged: true,
        freq: action.freq,
        q: action.q,
        shown: action.shown,
        score: state.score + action.gain,
        roundScores: [...state.roundScores, action.gain],
        stuck: false,
        message: action.message,
        pinned: true,
      };
    case "zone":
      return { ...state, zone: action.on, message: action.message, pinned: action.pinned };
    case "stuck":
      if (state.locked) return state;
      if (state.zone) return { ...state, stuck: true };
      return { ...state, stuck: true, message: STUCK_HINT, pinned: true };
    case "next":
      if (state.roundIdx >= MATCH_ROUNDS.length - 1) return { ...state, finished: true, playing: false };
      return fresh(state.roundIdx + 1, state.score, state.roundScores);
    case "finish":
      return { ...state, finished: true, playing: false };
    case "restart":
      return fresh(0, 0, []);
    default:
      return state;
  }
}

function useCuts() {
  const [cuts, setCuts] = useState({ lg: 14, md: 8, sm: 6 });
  useEffect(() => {
    const apply = () => {
      const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setCuts(fluidCuts(window.innerWidth, root));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);
  return cuts;
}

function cutProps(cut: number, className?: string): { className: string; style: CSSProperties } {
  return {
    className: `${styles.cut} lv-cut ${className ?? ""}`.trim(),
    style: { ["--cut" as string]: `${cut}px` },
  };
}

function Mark({ cut }: { cut: number }) {
  return <ChamferMark key={cut} />;
}

function Ticks({ marks, width, height = 40 }: { marks: readonly { x: number; major: boolean }[]; width: number; height?: number }) {
  return (
    <svg className={styles.ticks} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {marks.map((mark) => (
        <line
          key={`${mark.x}-${mark.major ? "m" : "n"}`}
          className={mark.major ? styles.major : undefined}
          x1={mark.x}
          x2={mark.x}
          y1={mark.major ? 8 : 15}
          y2={mark.major ? 32 : 25}
        />
      ))}
    </svg>
  );
}

function FrameButton({
  cut,
  tone,
  className,
  children,
  buttonRef,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  cut: number;
  tone: "primary" | "ghost";
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      {...props}
      ref={buttonRef}
      type="button"
      className={`${styles.ring} ${className ?? ""}`.trim()}
      style={{ ["--cut" as string]: `${cut}px` }}
    >
      <span {...cutProps(cut, `${styles.shell} ${tone === "primary" ? styles.primary : styles.ghost}`)}>
        <Mark cut={cut} />
        <span className={styles.btnLabel}>{children}</span>
      </span>
    </button>
  );
}

function PageHead({
  score,
  roundNumber,
  cuts,
}: {
  score: number;
  roundNumber: number;
  cuts: { lg: number; md: number; sm: number };
}) {
  return (
    <header className={styles.head}>
      <Link href="/challenge" className={`${styles.back} ${styles.ring}`} style={{ ["--cut" as string]: `${cuts.sm}px` }}>
        ← Challenges
      </Link>
      <div className={styles.titleBlock}>
        <p className={styles.kicker}>Challenge 02</p>
        <h1 className={styles.title}>Tune the signal</h1>
      </div>
      <p className={styles.score}>
        <span>Score</span>
        <b data-testid="match-score">{score}</b>
      </p>
      <div className={styles.prog} role="img" aria-label={`Round ${roundNumber} of 3`}>
        <span className={styles.progLabel}>Round {roundNumber} / 3</span>
        {MATCH_ROUNDS.map((item) => (
          <span
            key={item.id}
            {...cutProps(cuts.sm, item.roundNumber <= roundNumber ? `${styles.seg} ${styles.segOn}` : styles.seg)}
            aria-hidden="true"
          >
            <Mark cut={cuts.sm} />
          </span>
        ))}
      </div>
    </header>
  );
}

function MatchResults({
  totalScore,
  roundScores,
  shared = false,
  onRestart,
}: {
  totalScore: number;
  roundScores: readonly number[];
  shared?: boolean;
  onRestart?: () => void;
}) {
  const cuts = useCuts();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const average = roundScores.length ? Math.round(totalScore / roundScores.length / 10) : 0;
  const feedback = average >= 97
    ? "Excellent tuning. Your tone matched each record closely."
    : average >= 92
      ? "Strong listening. The round scores show which record was hardest to match."
      : "The score is how closely each tone matched the record. Replay and move one dial at a time.";
  const shareable = roundScores.length === 3 && roundScores.every((score) => score >= 880 && score <= 1000);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <main id="main-content" tabIndex={-1} className={styles.page} data-hide-target-cursor="true" data-testid="match-result">
      <div className={styles.wrap}>
        <PageHead score={Math.round(totalScore)} roundNumber={3} cuts={cuts} />
        <section className={styles.results} aria-labelledby="tune-result-title">
          {shared ? <p className={styles.kicker}>A player shared this result</p> : null}
          <h2 id="tune-result-title" ref={headingRef} tabIndex={-1}>Three rounds scored</h2>
          <p className={styles.resultsLead}>
            Total {Math.round(totalScore)} pts. Average match {average}%. {feedback}
          </p>
          <div className={styles.resultGrid} role="list" aria-label="Round scores">
            {MATCH_ROUNDS.map((round, index) => (
              <article key={round.id} {...cutProps(cuts.md, styles.card)} role="listitem">
                <Mark cut={cuts.md} />
                <div className={styles.cardFace}>
                  <p className={styles.resultKicker}>Signal {round.roundNumber} · {round.year}</p>
                  <h3>{round.title}</h3>
                  <p className={styles.resultPts}>{roundScores[index] === undefined ? "Not shared" : `${Math.round(roundScores[index])} pts`}</p>
                  <p className={styles.resultFact}>{round.metric}. {round.fact}</p>
                </div>
              </article>
            ))}
          </div>
          {shareable ? (
            <ChallengeShareActions
              path="/challenge/match"
              params={{ result: encodeMatchResult({ roundScores }) }}
              title="Tune the signal"
              score={`${Math.round(totalScore)} PTS`}
              detail={`Average match ${average}% · ${roundScores.length} signals tuned`}
              fileName="sonifysphere-tune-the-signal.png"
            />
          ) : null}
          <div className={styles.resultActions}>
            {onRestart ? (
              <FrameButton cut={cuts.md} tone="primary" onClick={onRestart}>Play again</FrameButton>
            ) : (
              <Link href="/challenge/match" className={styles.ring} style={{ ["--cut" as string]: `${cuts.md}px` }}>
                <span {...cutProps(cuts.md, `${styles.shell} ${styles.primary}`)}>
                  <Mark cut={cuts.md} />
                  <span className={styles.btnLabel}>Play this challenge</span>
                </span>
              </Link>
            )}
            <Link href="/challenge" className={styles.ring} style={{ ["--cut" as string]: `${cuts.md}px` }}>
              <span {...cutProps(cuts.md, `${styles.shell} ${styles.ghost}`)}>
                <Mark cut={cuts.md} />
                <span className={styles.btnLabel}>Back to challenges</span>
              </span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Ruler({
  id,
  label,
  valueText,
  display,
  minLabel,
  maxLabel,
  min,
  max,
  step,
  value,
  disabled,
  ticks,
  tickWidth,
  zone,
  showZone,
  cut,
  inputRef,
  onValue,
  valueName,
}: {
  id: string;
  label: string;
  valueText: string;
  display: string;
  minLabel: string;
  maxLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled: boolean;
  ticks: readonly { x: number; major: boolean }[];
  tickWidth: number;
  zone: { left: string; width: string };
  showZone: boolean;
  cut: number;
  inputRef?: Ref<HTMLInputElement>;
  onValue: (value: number) => void;
  valueName: string;
}) {
  return (
    <div className={`${styles.ruler} ${styles.ring}`} style={{ ["--cut" as string]: `${cut}px` }}>
      <label className={styles.rulerTop} htmlFor={id}>
        <span>{label}</span>
        <b>{display}</b>
      </label>
      <div className={styles.track}>
        <Ticks marks={ticks} width={tickWidth} />
        <span className={styles.zone} hidden={!showZone} style={zone} data-testid={`${id}-zone`} />
        <input
          ref={inputRef}
          className={styles.range}
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-valuetext={valueText}
          onInput={(event) => onValue(Number(event.currentTarget.value))}
        />
      </div>
      <p className={styles.ends}>
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </p>
      <span className={styles.sr}>{valueName}</span>
    </div>
  );
}

function MatchPlay() {
  const [state, dispatch] = useReducer(reducer, fresh(0, 0, []));
  const [live, setLive] = useState("");
  const cuts = useCuts();
  const { playTarget, startYou, glide, stopAll, chime, arm, isGen } = useTone();
  const round = MATCH_ROUNDS[state.roundIdx] ?? MATCH_ROUNDS[0];
  const liveScore = coherence(state.freq, state.q, round.targetFreq, round.targetQ);
  const shown = state.locked ? state.shown : liveScore;
  const level = bandOf(shown);
  const word = state.skipped ? "Skipped" : state.locked ? "Locked" : shown >= LOCK_AT && state.engaged ? "Hold…" : level.word;
  const compareRef = useRef<HTMLButtonElement>(null);
  const freqRef = useRef<HTMLInputElement>(null);
  const qRef = useRef<HTMLInputElement>(null);
  const guardRef = useRef(0);
  const handoffRef = useRef<number | null>(null);
  const freqNow = useRef(state.freq);
  const qNow = useRef(state.q);
  const scoreNow = useRef(liveScore);
  const lockedNow = useRef(state.locked);
  freqNow.current = state.freq;
  qNow.current = state.q;
  scoreNow.current = liveScore;
  lockedNow.current = state.locked;

  const targetPath = useMemo(() => wavePath(round.targetFreq, round.targetQ), [round.targetFreq, round.targetQ]);
  const youPath = useMemo(() => wavePath(state.freq, state.q), [state.freq, state.q]);
  const freqZone = useMemo(() => zoneBox(lockZone(round.targetFreq, 0.7), FREQ.min, FREQ.max), [round.targetFreq]);
  const qZone = useMemo(() => zoneBox(lockZone(round.targetQ, 0.3), RESONANCE.min, RESONANCE.max), [round.targetQ]);

  useEffect(() => {
    setLive(`Round ${round.roundNumber} of 3. ${round.title}.`);
  }, [round.roundNumber, round.title]);

  useEffect(() => {
    if (state.playing && state.phase === 2) glide(state.freq, state.q);
  }, [glide, state.freq, state.phase, state.playing, state.q]);

  const holding = state.engaged && !state.locked && !state.finished && liveScore >= LOCK_AT;
  useEffect(() => {
    if (!holding) return;
    const id = window.setTimeout(() => {
      const value = scoreNow.current;
      if (value < LOCK_AT || lockedNow.current) return;
      stopAll();
      chime();
      const hadFocus = document.activeElement === freqRef.current || document.activeElement === qRef.current;
      dispatch({
        type: "lock",
        gain: value * 10,
        skipped: false,
        freq: freqNow.current,
        q: qNow.current,
        shown: value,
        message: `Locked at ${value}% · +${value * 10} pts.`,
      });
      setLive(`Signal locked at ${value} percent. ${value * 10} points.`);
      if (hadFocus) compareRef.current?.focus();
    }, HOLD_MS);
    return () => window.clearTimeout(id);
  }, [chime, holding, state.roundIdx, stopAll]);

  useEffect(() => {
    const started = performance.now();
    const id = window.setInterval(() => {
      if (performance.now() - started < STUCK_MS) return;
      if (lockedNow.current) return;
      if (scoreNow.current >= CLOSE_AT) return;
      dispatch({ type: "stuck" });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.roundIdx]);

  useEffect(() => {
    return () => {
      if (handoffRef.current != null) window.clearTimeout(handoffRef.current);
    };
  }, []);

  const tuneFreq = (freq: number) => {
    const next = coherence(freq, state.q, round.targetFreq, round.targetQ);
    dispatch({ type: "tune", freq, q: state.q, clearStuck: next >= CLOSE_AT });
  };

  const tuneQ = (raw: number) => {
    const q = Math.round(raw * 10) / 10;
    const next = coherence(state.freq, q, round.targetFreq, round.targetQ);
    dispatch({ type: "tune", freq: state.freq, q, clearStuck: next >= CLOSE_AT });
  };

  const onCompare = () => {
    const now = performance.now();
    if (now - guardRef.current < CLICK_GUARD_MS) return;
    guardRef.current = now;
    if (handoffRef.current != null) {
      window.clearTimeout(handoffRef.current);
      handoffRef.current = null;
    }
    if (state.locked) {
      stopAll();
      dispatch({ type: state.roundIdx >= MATCH_ROUNDS.length - 1 ? "finish" : "next" });
      return;
    }
    if (state.playing) {
      stopAll();
      dispatch({ type: "play", playing: false, phase: 0 });
      return;
    }
    const gen = arm();
    const markStuck = state.compares + 1 >= STUCK_LISTENS && liveScore < CLOSE_AT;
    dispatch({ type: "compared", markStuck });
    playTarget(round.targetFreq, round.targetQ);
    handoffRef.current = window.setTimeout(() => {
      handoffRef.current = null;
      if (!isGen(gen)) return;
      startYou(freqNow.current, qNow.current);
      dispatch({ type: "play", playing: true, phase: 2 });
    }, TARGET_MS);
  };

  const onZone = () => {
    if (state.zone) {
      const stillStuck = state.stuck && liveScore < CLOSE_AT;
      dispatch({ type: "zone", on: false, message: stillStuck ? STUCK_HINT : DEFAULT_HINT, pinned: stillStuck });
      setLive("Target zone hidden.");
      return;
    }
    dispatch({ type: "zone", on: true, message: ZONE_HINT, pinned: true });
    setLive("Target zone shown on both dials.");
  };

  const onSkip = () => {
    if (state.locked) return;
    if (handoffRef.current != null) {
      window.clearTimeout(handoffRef.current);
      handoffRef.current = null;
    }
    stopAll();
    const message = `Skipped · answer was ${round.targetFreq} Hz · Q ${round.targetQ.toFixed(1)} · 0 pts.`;
    dispatch({
      type: "lock",
      gain: 0,
      skipped: true,
      freq: round.targetFreq,
      q: round.targetQ,
      shown: 0,
      message,
    });
    setLive(message);
    compareRef.current?.focus();
  };

  if (state.finished) {
    return (
      <MatchResults
        totalScore={state.score}
        roundScores={state.roundScores}
        onRestart={() => dispatch({ type: "restart" })}
      />
    );
  }

  const compareLabel = state.locked
    ? state.roundIdx < MATCH_ROUNDS.length - 1 ? "Next anomaly →" : "View results →"
    : state.playing ? "Stop" : state.compares > 0 ? "Compare again" : "Compare";

  return (
    <main id="main-content" tabIndex={-1} className={styles.page} data-hide-target-cursor="true" data-testid="match-game">
      <div className={styles.wrap}>
        <PageHead score={state.score} roundNumber={round.roundNumber} cuts={cuts} />
        <div className={styles.board}>
          <section {...cutProps(cuts.lg, styles.card)} aria-labelledby="tune-record">
            <Mark cut={cuts.lg} />
            <div className={`${styles.cardFace} ${styles.scopeFace}`}>
              <div className={styles.scopeTop}>
                <div>
                  <h2 id="tune-record">{round.title}</h2>
                  <p className={styles.metric}>
                    {round.metric} <span className={styles.metricNote}>· {round.line}</span>
                  </p>
                </div>
              </div>
              <div {...cutProps(cuts.md, styles.screen)}>
                <Mark cut={cuts.md} />
                <svg className={styles.wave} viewBox="0 0 600 220" preserveAspectRatio="none" role="img" aria-label="Your wave against the target wave">
                  <g className={styles.grid} aria-hidden="true">
                    <line x1="0" y1="110" x2="600" y2="110" />
                    <line x1="150" y1="0" x2="150" y2="220" />
                    <line x1="300" y1="0" x2="300" y2="220" />
                    <line x1="450" y1="0" x2="450" y2="220" />
                  </g>
                  <path className={styles.waveTarget} d={targetPath} />
                  <path className={styles.waveYou} d={youPath} />
                </svg>
              </div>
              <p className={styles.legend} aria-hidden="true">
                <span className={styles.swatchTarget}>Target</span>
                <span className={styles.swatchYou}>You</span>
                <span className={styles.legendNote}>Overlap the two lines</span>
              </p>
            </div>
          </section>

          <section
            {...cutProps(cuts.lg, `${styles.card} ${styles.controls}`)}
            data-locked={state.locked ? "true" : "false"}
            aria-label="Tune and compare"
          >
            <Mark cut={cuts.lg} />
            <div className={`${styles.cardFace} ${styles.controlsFace} ${state.pinned ? styles.pinned : ""}`}>
              <div className={styles.gaugeRow}>
                <div
                  className={styles.gauge}
                  data-level={state.skipped ? "far" : level.key}
                  role="meter"
                  aria-label="Closeness to the target"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={shown}
                  aria-valuetext={`${shown} percent, ${word}`}
                  style={{ ["--cl" as string]: String(shown) }}
                >
                  <svg viewBox="0 0 100 100" aria-hidden="true">
                    <polygon className={styles.gTrack} points="30,4 70,4 96,30 96,70 70,96 30,96 4,70 4,30" pathLength={100} />
                    <polygon className={styles.gFill} points="50,4 70,4 96,30 96,70 70,96 30,96 4,70 4,30 30,4 50,4" pathLength={100} />
                    <line className={styles.gNotch} x1="13" y1="10.8" x2="23.2" y2="21" />
                  </svg>
                  <p className={styles.gaugeIn}>
                    <b>{shown}%</b>
                    <span data-testid="match-word">{word}</span>
                  </p>
                </div>
                <div className={styles.compareBox}>
                  <button
                    ref={compareRef}
                    type="button"
                    className={`${styles.ring} ${styles.play} ${state.playing ? styles.playing : ""} ${state.locked ? styles.locked : ""}`}
                    style={{ ["--cut" as string]: `${cuts.md}px` }}
                    onClick={onCompare}
                  >
                    <span {...cutProps(cuts.md, `${styles.shell} ${styles.primary} ${styles.play}`)}>
                      <Mark cut={cuts.md} />
                      <span className={styles.btnLabel}>
                        <svg className={`${styles.icon} ${styles.playIcon}`} viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M4 2.5v11l9.5-5.5z" fill="currentColor" />
                        </svg>
                        <svg className={`${styles.icon} ${styles.stopIcon}`} viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M3.5 3.5h9v9h-9z" fill="currentColor" />
                        </svg>
                        {compareLabel}
                      </span>
                    </span>
                  </button>
                  {state.locked ? null : (
                    <p className={styles.sequence}>
                      <span className={state.playing && state.phase === 1 ? styles.on : undefined}>1 Target</span>
                      <span aria-hidden="true">→</span>
                      <span className={state.playing && state.phase === 2 ? styles.on : undefined}>2 You</span>
                    </p>
                  )}
                  <p className={styles.say} data-strong={state.locked ? "true" : "false"}>{state.message}</p>
                </div>
              </div>

              <Ruler
                id="tune-freq"
                label="Frequency"
                display={`${state.freq} Hz`}
                valueText={`${state.freq} hertz`}
                minLabel="150"
                maxLabel="800 Hz"
                min={FREQ.min}
                max={FREQ.max}
                step={FREQ.step}
                value={state.freq}
                disabled={state.locked}
                ticks={FREQ_TICKS}
                tickWidth={FREQ.width}
                zone={freqZone}
                showZone={state.zone}
                cut={cuts.md}
                inputRef={freqRef}
                onValue={tuneFreq}
                valueName="Frequency"
              />
              <Ruler
                id="tune-q"
                label="Resonance (Q)"
                display={state.q.toFixed(1)}
                valueText={`Q ${state.q.toFixed(1)}`}
                minLabel="1.0 broad"
                maxLabel="8.0 sharp"
                min={RESONANCE.min}
                max={RESONANCE.max}
                step={RESONANCE.step}
                value={state.q}
                disabled={state.locked}
                ticks={Q_TICKS}
                tickWidth={RESONANCE.width}
                zone={qZone}
                showZone={state.zone}
                cut={cuts.md}
                inputRef={qRef}
                onValue={tuneQ}
                valueName="Resonance"
              />

              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.ring} ${state.stuck && !state.zone ? styles.nudge : ""}`}
                  style={{ ["--cut" as string]: `${cuts.md}px` }}
                  aria-pressed={state.zone}
                  onClick={onZone}
                >
                  <span {...cutProps(cuts.md, `${styles.shell} ${styles.ghost} ${state.zone ? styles.pressed : ""} ${state.stuck && !state.zone ? styles.nudge : ""}`)}>
                    <Mark cut={cuts.md} />
                    <span className={styles.btnLabel}>{state.zone ? "Hide target zone" : "Show target zone"}</span>
                  </span>
                </button>
                <FrameButton cut={cuts.md} tone="ghost" onClick={onSkip}>
                  Skip round
                </FrameButton>
              </div>
            </div>
          </section>
        </div>
      </div>
      <p className={styles.sr} aria-live="polite">{live}</p>
    </main>
  );
}

export function SignalMatchGame({ sharedResult = null }: { readonly sharedResult?: SharedMatchResult | null }) {
  if (sharedResult) {
    const totalScore = sharedResult.roundScores.reduce((sum, score) => sum + score, 0);
    return <MatchResults totalScore={totalScore} roundScores={sharedResult.roundScores} shared />;
  }
  return <MatchPlay />;
}
