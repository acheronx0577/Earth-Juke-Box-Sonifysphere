"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { regionById, type LayerId } from "@/data/exploreMap";
import { explainGuess, recordDisplayName } from "@/lib/guessWhy";
import { isResumableGuessRun, readGuessRun, writeGuessRun, type GuessHistoryEntry, type StoredGuessRun } from "@/lib/guessSession";
import { PHRASE_MS, playRegionPhrase } from "@/lib/signalPlayback";
import { setSignalLive } from "@/lib/signalLive";
import {
  GUESS_ROUND_COUNT,
  buildGuessRounds,
  mulberry32,
  scoreGain,
  signalFrequency,
  type GuessRound,
} from "@/lib/signalTheory";
import { useSonifyPlayer } from "@/context/SonifyPlayerContext";
import { encodeGuessResult, type SharedGuessResult } from "@/lib/challengeResults";
import styles from "./guess.module.css";

type Phase = "ready" | "listening" | "answered" | "result";

const VW = 1440;
const VH = 520;
const BASE = 430;
const XS = [220, 540, 860, 1180];
const AXIS = ["1968", "1987", "2005", "2024"];
const PLAY_YEARS = [1968, 1988, 2006, 2024];
const HOW =
  "Five rounds alternate a region and a record. Hear the four-note signal, then pick 1–4. R replays, Enter continues. A correct answer scores 100, plus 25 for each step of the streak.";

function choiceLabel(round: GuessRound, id: string): string {
  return round.choices.find((choice) => choice.id === id)?.label ?? id;
}

function displayChoice(round: GuessRound, id: string, label: string): string {
  return round.kind === "layer" ? recordDisplayName(id) : label;
}

function dataParam(layer: LayerId): "co2" | "ch4" | "temp" {
  if (layer === "methane") return "ch4";
  if (layer === "temperature") return "temp";
  return "co2";
}

function freshSeed(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] || 1;
}

function clueValue(round: GuessRound): string {
  if (round.kind === "layer") return round.prompt;
  return `${recordDisplayName(round.layer)} · ${round.season} · ${round.weather}`;
}

function oneLineWhy(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 118) return flat;
  const cut = flat.slice(0, 117);
  const space = cut.lastIndexOf(" ");
  return `${(space > 70 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function clip(cut: number) {
  return `polygon(${cut}px 0, calc(100% - ${cut}px) 0, 100% ${cut}px, 100% calc(100% - ${cut}px), calc(100% - ${cut}px) 100%, ${cut}px 100%, 0 calc(100% - ${cut}px), 0 ${cut}px)`;
}

function monotone(points: readonly [number, number][]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0][0]} ${points[0][1]}`;
  const dx: number[] = [];
  const slope: number[] = [];
  const m = new Array<number>(n).fill(0);
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = points[i + 1][0] - points[i][0] || 1;
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

function phraseFreqs(regionId: string, season: GuessRound["season"], weather: GuessRound["weather"]): number[] {
  const note = regionById(regionId).note;
  return PLAY_YEARS.map((year) => signalFrequency(note, year, season, weather));
}

function plotY(freq: number, min: number, max: number, high: number, low: number): number {
  const span = Math.max(1, max - min);
  const t = Math.min(1, Math.max(0, (freq - min) / span));
  const eased = 1 - (1 - t) ** 1.9;
  return low - eased * (low - high);
}

function extendLevel(points: readonly [number, number][], left: number, right: number, floor: number): [number, number][] {
  const clampY = (y: number) => Math.min(y, floor);
  const leftSlope = (points[1][1] - points[0][1]) / (points[1][0] - points[0][0]);
  const last = points.length - 1;
  const rightSlope = (points[last][1] - points[last - 1][1]) / (points[last][0] - points[last - 1][0]);
  return [
    [left, clampY(points[0][1] - leftSlope * (points[0][0] - left))],
    ...points.map(([x, y]) => [x, clampY(y)] as [number, number]),
    [right, clampY(points[last][1] + rightSlope * (right - points[last][0]))],
  ];
}

function heroGeometry(freqs: readonly number[]) {
  const min = Math.min(...freqs);
  const max = Math.max(...freqs);
  const floor = BASE - 12;
  const mapped = freqs.map((freq, index) => [XS[index], plotY(freq, min, max, 150, 348)] as [number, number]);
  const line = monotone(extendLevel(mapped, 0, VW, floor));
  return { mapped, line, fill: `${line} L ${VW} ${BASE} L 0 ${BASE} Z` };
}

function miniPath(freqs: readonly number[]): string {
  const min = Math.min(...freqs);
  const max = Math.max(...freqs);
  const points = freqs.map((freq, index) => [16 + index * 68, plotY(freq, min, max, 14, 50)] as [number, number]);
  return monotone(extendLevel(points, 0, 240, 58));
}

function carrierWave(): string {
  let d = "";
  for (let x = 0; x <= VW; x += 8) {
    const y = 300 + Math.sin(x / 92) * 22 + Math.sin(x / 31) * 7;
    d += d ? ` L ${x.toFixed(1)} ${y.toFixed(1)}` : `M ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

const WAVE = carrierWave();

function ReplayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6.2 4.2 3.4 6.4 6.2 8.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4.2 6.4h4.2a4 4 0 1 1-1.2 3.1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function resultUrl(result: SharedGuessResult): string {
  const url = new URL("/challenge/guess", window.location.origin);
  url.searchParams.set("result", encodeGuessResult(result));
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

async function saveResultImage(title: string, scoreLine: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#141414";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#b4b2ae";
  context.font = "600 22px ui-monospace, monospace";
  context.fillText("SONIFYSPHERE · GUESS THE SIGNAL", 72, 120);
  context.fillStyle = "#f2f2f0";
  context.font = "560 72px sans-serif";
  context.fillText(title, 72, 280);
  context.font = "500 28px ui-monospace, monospace";
  context.fillText(scoreLine, 72, 360);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = "sonifysphere-guess-result.png";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function GuessGame({
  seed,
  rounds = GUESS_ROUND_COUNT,
  sharedResult = null,
}: {
  readonly seed?: number;
  readonly rounds?: number;
  readonly sharedResult?: SharedGuessResult | null;
}) {
  const { pause, soundOn, setSoundEnabled, isSoundOn } = useSonifyPlayer();
  const router = useRouter();
  const [session, setSession] = useState(0);
  const [visitSeed, setVisitSeed] = useState<number | null>(seed ?? null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [history, setHistory] = useState<GuessHistoryEntry[]>([]);
  const [live, setLive] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [soundOff, setSoundOff] = useState(false);
  const [gain, setGain] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [booted, setBooted] = useState(false);
  const [savedRun, setSavedRun] = useState<StoredGuessRun | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [shareNote, setShareNote] = useState("");
  const stopRef = useRef<(() => void) | null>(null);
  const liveTimer = useRef<number | null>(null);
  const phaseRef = useRef(phase);
  const indexRef = useRef(index);
  const pendingFocus = useRef<"next" | "question" | "result" | "hear" | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  const hearRef = useRef<HTMLButtonElement | null>(null);
  const questionRef = useRef<HTMLHeadingElement | null>(null);
  const resultRef = useRef<HTMLButtonElement | null>(null);
  const infoRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const pendingSound = useRef<(() => void) | null>(null);
  const fillId = `${useId().replace(/:/g, "")}fill`;
  const glowId = `${useId().replace(/:/g, "")}glow`;
  const plotClipId = `${useId().replace(/:/g, "")}plot`;
  phaseRef.current = phase;

  useEffect(() => {
    if (soundOn) setSoundOff(false);
  }, [soundOn]);
  indexRef.current = index;

  const openFresh = useCallback((nextSeed: number) => {
    setVisitSeed(nextSeed);
    setSession(0);
    setIndex(0);
    setPhase("ready");
    setPickedId(null);
    setScore(0);
    setStreak(0);
    setBest(0);
    setCorrectCount(0);
    setHistory([]);
    setGain(0);
    setSavedRun(null);
    setBooted(true);
  }, []);

  useEffect(() => {
    if (sharedResult) return;
    const stored = readGuessRun();
    const activeSeed = seed ?? null;
    const resumable = isResumableGuessRun(stored, rounds) ? stored : null;
    const adopt = resumable && (activeSeed === null || resumable.seed === activeSeed) ? resumable : null;
    if (adopt) {
      setVisitSeed(adopt.seed);
      setSession(adopt.session ?? 0);
      setIndex(adopt.index);
      setPhase(adopt.phase === "listening" ? "ready" : adopt.phase);
      setPickedId(adopt.phase === "answered" ? adopt.pickedId : null);
      setScore(adopt.score);
      setStreak(adopt.streak);
      setBest(adopt.best);
      setCorrectCount(adopt.correctCount);
      setHistory([...adopt.history]);
      const last = adopt.history[adopt.history.length - 1];
      setGain(last?.correct ? scoreGain(adopt.streak) : 0);
      setSavedRun(null);
      setBooted(true);
      return;
    }
    if (resumable && activeSeed !== null) {
      setSavedRun(resumable);
      setBooted(false);
      return;
    }
    openFresh(activeSeed ?? freshSeed());
  }, [openFresh, rounds, seed, sharedResult]);

  const deck = useMemo(() => {
    if (visitSeed === null) return [] as GuessRound[];
    return buildGuessRounds(rounds, mulberry32((visitSeed + session * 997) >>> 0));
  }, [visitSeed, rounds, session]);

  const round = deck[index] ?? deck[0];

  useEffect(() => {
    if (sharedResult) return;
    if (!booted || visitSeed === null) return;
    if (phase === "result") {
      writeGuessRun(null);
      return;
    }
    writeGuessRun({
      seed: visitSeed,
      session,
      index,
      phase,
      score,
      streak,
      best,
      correctCount,
      pickedId,
      history,
    });
  }, [booted, visitSeed, session, index, phase, score, streak, best, correctCount, pickedId, history, sharedResult]);

  useEffect(() => {
    if (sharedResult) return;
    if (!booted || visitSeed === null) return;
    const current = new URLSearchParams(window.location.search).get("seed");
    if (current === String(visitSeed)) return;
    router.replace(`/challenge/guess?seed=${visitSeed}`, { scroll: false });
  }, [booted, router, visitSeed, sharedResult]);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target === "next") nextRef.current?.focus();
    if (target === "question") questionRef.current?.focus();
    if (target === "result") resultRef.current?.focus();
    if (target === "hear") hearRef.current?.focus();
  });

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

  const stopPhrase = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    if (liveTimer.current !== null) window.clearTimeout(liveTimer.current);
    setLive(false);
    setSignalLive(false);
  }, []);

  useEffect(() => {
    if (soundOn) return;
    stopPhrase();
  }, [soundOn, stopPhrase]);

  const holdForSound = useCallback((play: () => void) => {
    pendingSound.current = play;
    setSoundOff(true);
  }, []);

  const turnSoundOn = useCallback(() => {
    const play = pendingSound.current;
    setSoundEnabled(true);
    setSoundOff(false);
    pendingSound.current = null;
    play?.();
  }, [setSoundEnabled]);

  const startPhrase = useCallback(
    (next: GuessRound) => {
      stopPhrase();
      pause();
      setBlocked(false);
      const region = regionById(next.regionId);
      stopRef.current = playRegionPhrase(
        {
          layer: next.layer,
          season: next.season,
          weather: next.weather,
          wind: 36,
          year: 1988,
          note: region.note,
        },
        { onError: () => setBlocked(true) }
      );
      setLive(true);
      setSignalLive(true);
      setAnnouncement("Playing signal");
      liveTimer.current = window.setTimeout(() => {
        setLive(false);
        setSignalLive(false);
      }, PHRASE_MS);
    },
    [pause, stopPhrase]
  );

  const playRound = useCallback(
    (next: GuessRound) => {
      if (!isSoundOn()) {
        holdForSound(() => startPhrase(next));
        return false;
      }
      setSoundOff(false);
      startPhrase(next);
      return true;
    },
    [holdForSound, isSoundOn, startPhrase]
  );

  useEffect(() => () => stopPhrase(), [stopPhrase]);

  const hear = useCallback(() => {
    if (!round) return;
    if (!playRound(round)) return;
    phaseRef.current = "listening";
    setPhase("listening");
    setPickedId(null);
  }, [playRound, round]);

  const choose = useCallback(
    (id: string, viaKeyboard = false) => {
      if (phaseRef.current !== "listening" || !round || blocked) return;
      phaseRef.current = "answered";
      const correct = id === round.answerId;
      const nextStreak = correct ? streak + 1 : 0;
      const added = correct ? scoreGain(nextStreak) : 0;
      const answerText = displayChoice(round, round.answerId, choiceLabel(round, round.answerId));
      const pickedText = displayChoice(round, id, choiceLabel(round, id));
      const entry: GuessHistoryEntry = {
        kind: round.kind,
        answerId: round.answerId,
        pickedId: id,
        regionId: round.regionId,
        layer: round.layer,
        season: round.season,
        weather: round.weather,
        answerLabel: answerText,
        pickedLabel: pickedText,
        correct,
      };
      setPickedId(id);
      setPhase("answered");
      setStreak(nextStreak);
      setGain(added);
      setHistory((current) => [...current, entry]);
      if (correct) {
        setScore((value) => value + added);
        setCorrectCount((value) => value + 1);
        setBest((value) => Math.max(value, nextStreak));
      }
      const why = explainGuess(round, id);
      setAnnouncement(`${correct ? "Yes." : "No."} ${answerText}. ${why}`);
      if (viaKeyboard) pendingFocus.current = "next";
    },
    [blocked, round, streak]
  );

  const advance = useCallback(() => {
    if (phaseRef.current !== "answered") return;
    const nextIndex = indexRef.current + 1;
    if (nextIndex >= deck.length) {
      phaseRef.current = "result";
      stopPhrase();
      setPhase("result");
      pendingFocus.current = "result";
      return;
    }
    const next = deck[nextIndex];
    phaseRef.current = "listening";
    indexRef.current = nextIndex;
    setIndex(nextIndex);
    setPickedId(null);
    setBlocked(false);
    setPhase("listening");
    pendingFocus.current = "question";
    if (next) playRound(next);
  }, [deck, playRound, stopPhrase]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea")) return;
      const current = phaseRef.current;
      const active = deck[indexRef.current];
      if (!active || blocked) return;
      if (current === "listening" && ["1", "2", "3", "4"].includes(event.key)) {
        const choice = active.choices[Number(event.key) - 1];
        if (!choice) return;
        event.preventDefault();
        choose(choice.id, true);
      }
      if ((current === "listening" || current === "answered") && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        playRound(active);
      }
      if (current === "answered" && event.key === "Enter") {
        if (target instanceof HTMLElement && target.closest(".sonify-next, button, a, [role='dialog']")) return;
        event.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, blocked, choose, deck, playRound]);

  const replay = () => {
    if (!round || phase === "ready" || phase === "result") return;
    playRound(round);
  };

  const again = () => {
    stopPhrase();
    setSession((value) => value + 1);
    setIndex(0);
    setPhase("ready");
    setPickedId(null);
    setScore(0);
    setStreak(0);
    setCorrectCount(0);
    setHistory([]);
    setBlocked(false);
    setGain(0);
    setShareNote("");
    pendingFocus.current = "hear";
  };

  const replayHistory = (entry: GuessHistoryEntry) => {
    const play = () => {
      pause();
      stopPhrase();
      const region = regionById(entry.regionId);
      stopRef.current = playRegionPhrase({
        layer: entry.layer,
        season: entry.season,
        weather: entry.weather,
        wind: 36,
        year: 1988,
        note: region.note,
      });
      setLive(true);
      setSignalLive(true);
      liveTimer.current = window.setTimeout(() => {
        setLive(false);
        setSignalLive(false);
      }, PHRASE_MS);
    };
    if (!isSoundOn()) {
      holdForSound(play);
      return;
    }
    setSoundOff(false);
    play();
  };

  useEffect(() => {
    if (phase !== "result") return;
    setAnnouncement(`${correctCount} of ${deck.length} named. Score ${score}. Best streak ${best}.`);
  }, [best, correctCount, deck.length, phase, score]);

  const copyLink = async (result: SharedGuessResult) => {
    try {
      await copyText(resultUrl(result));
      setShareNote("Result link copied.");
      setAnnouncement("Result link copied.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The result link could not be copied.";
      setShareNote(message);
      setAnnouncement(message);
    }
  };

  const saveImage = async (title: string, scoreLine: string) => {
    await saveResultImage(title, scoreLine);
    setShareNote("Result image downloaded.");
    setAnnouncement("Result image downloaded.");
  };

  const question = round?.kind === "region" ? "Which region is this?" : "Which record is this?";
  const answerText = round ? displayChoice(round, round.answerId, choiceLabel(round, round.answerId)) : "";
  const correct = Boolean(round && pickedId && pickedId === round.answerId);
  const why = round && pickedId && phase === "answered" ? explainGuess(round, pickedId) : "";
  const playingNow = phase === "listening" && live;
  const heard = phase === "listening" || phase === "answered";
  const waiting = phase === "ready" || blocked;
  const total = deck.length || rounds;
  const roundLabel = phase === "result" ? `${total} of ${total} complete` : `Round ${Math.min(index + 1, total)} of ${total}`;
  const filled = phase === "result" ? total : history.length;
  const shareResult: SharedGuessResult = {
    correct: correctCount,
    total: deck.length,
    score,
    bestStreak: best,
  };
  const geometry = round ? heroGeometry(phraseFreqs(round.regionId, round.season, round.weather)) : null;
  const verdict = `${correct ? "Yes" : "No"} — ${answerText}.`;
  const tip = `${correct ? "✓" : "✕"} ${answerText}${correct && gain ? ` +${gain}` : ""}`;

  const squares = (
    <span className={styles.squares} role="group" aria-label={roundLabel}>
      {Array.from({ length: total }, (_, square) => (
        <span key={square} className={styles.square} data-on={square < filled ? "true" : "false"} />
      ))}
    </span>
  );

  const scoreSide = (
    <div className={styles.scoreSide}>
      <span className="sonify-score">
        <b>{sharedResult ? sharedResult.score : score}</b>
        <span> PTS</span>
      </span>
      {phase === "result" || sharedResult ? null : <span className={styles.streak}>STREAK {streak}</span>}
      {squares}
    </div>
  );

  const info = (
    <span className={styles.infoWrap}>
      <button
        ref={infoRef}
        type="button"
        className={`${styles.shell} ${styles.info}`}
        style={{ clipPath: clip(7) }}
        aria-expanded={infoOpen}
        aria-controls="guess-info"
        aria-label="How this challenge works"
        onClick={() => setInfoOpen((open) => !open)}
      >
        <span className={styles.face} style={{ clipPath: clip(7) }}>
          i
        </span>
      </button>
      {infoOpen ? (
        <div ref={dialogRef} id="guess-info" className={styles.popover} style={{ clipPath: clip(12) }} role="dialog" aria-label="How it works" tabIndex={-1}>
          <div className={styles.popoverFace} style={{ clipPath: clip(12) }}>
            <span className={styles.num}>How it works</span>
            <p>{HOW}</p>
          </div>
        </div>
      ) : null}
    </span>
  );

  if (sharedResult) {
    const title = `${sharedResult.correct} of ${sharedResult.total} named`;
    const scoreLine = `${sharedResult.score} PTS · BEST STREAK ${sharedResult.bestStreak}`;
    return (
      <main id="main-content" tabIndex={-1} className={styles.page} data-result="true" data-hide-target-cursor="true">
        <header className={styles.header}>
          <Link href="/challenge" className={styles.resultBack}>
            ← Challenges
          </Link>
          {scoreSide}
        </header>
        <section className={styles.result} data-testid="guess-shared-result" aria-labelledby="shared-guess-title">
          <h1 id="shared-guess-title">{title}</h1>
          <p className={styles.stats}>
            <span>{sharedResult.score} PTS</span>
            <span>BEST STREAK {sharedResult.bestStreak}</span>
          </p>
          <p className={styles.note}>A shared result. The five signals stay on the player’s own run.</p>
          <Link href="/challenge/guess" className={`${styles.shell} bg-[#f2f2f0]`} style={{ clipPath: clip(10), textDecoration: "none" }}>
            <span className={styles.face} style={{ clipPath: clip(10), minWidth: "8.5rem" }}>
              Play again
            </span>
          </Link>
          <div className={styles.links}>
            <button type="button" onClick={() => void copyLink(sharedResult)}>
              Copy link
            </button>
            <button type="button" onClick={() => void saveImage(title, scoreLine)}>
              Save image
            </button>
          </div>
          {shareNote ? <p className={styles.note}>{shareNote}</p> : null}
        </section>
        <p className={styles.sr} aria-live="polite">
          {announcement}
        </p>
      </main>
    );
  }

  const showResult = phase === "result";
  const lastHeard = history[history.length - 1];

  return (
    <main id="main-content" tabIndex={-1} className={styles.page} data-result={showResult ? "true" : undefined} data-hide-target-cursor="true">
      <p className={styles.sr} aria-live="polite">
        {announcement}
      </p>
      <header className={styles.header}>
        {showResult ? (
          <Link href="/challenge" className={styles.resultBack}>
            ← Challenges
          </Link>
        ) : (
          <div className={styles.titleRow}>
            <span className={styles.num}>01</span>
            <h1>Guess the Signal</h1>
            {info}
          </div>
        )}
        {scoreSide}
      </header>

      <div className={styles.game} data-testid="guess-game" data-ready={visitSeed === null || !booted ? "false" : "true"} data-seed={visitSeed ?? undefined}>
        {savedRun ? (
          <div className={styles.center} role="status">
            <p className={styles.num}>Saved round</p>
            <h2>A saved round is still open.</h2>
            <p>Starting this one replaces round {savedRun.index + 1}.</p>
            <div className={styles.actions}>
              <button type="button" className={`${styles.shell} bg-[#f2f2f0]`} style={{ clipPath: clip(8) }} onClick={() => openFresh(seed ?? freshSeed())}>
                <span className={styles.face} style={{ clipPath: clip(8) }}>
                  Start this one
                </span>
              </button>
              <button type="button" className={styles.shell} style={{ clipPath: clip(8) }} onClick={() => router.replace(`/challenge/guess?seed=${savedRun.seed}`, { scroll: false })}>
                <span className={styles.face} style={{ clipPath: clip(8) }}>
                  Resume saved round
                </span>
              </button>
            </div>
          </div>
        ) : visitSeed === null || !booted ? (
          <div className={styles.skel} data-testid="guess-skeleton" aria-busy="true">
            <div className={styles.bar} />
            <div className={styles.bar} />
          </div>
        ) : showResult ? (
          <section className={styles.result} data-testid="guess-result">
            <h1>{correctCount} of {deck.length} named</h1>
            <p className={styles.stats}>
              <span>{score} PTS</span>
              <span>BEST STREAK {best}</span>
            </p>
            <ol className={styles.rounds}>
              {history.map((entry, entryIndex) => (
                <li key={`${entry.answerId}-${entryIndex}`} className={styles.mini}>
                  <svg viewBox="0 0 240 64" preserveAspectRatio="none" aria-hidden="true">
                    <path d={miniPath(phraseFreqs(entry.regionId, entry.season, entry.weather))} fill="none" stroke="#f2f2f0" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <div className={styles.miniHead}>
                    <span>
                      <span className={styles.miniName}>
                        {entry.correct ? "✓" : "✕"} {String(entryIndex + 1).padStart(2, "0")} {entry.answerLabel}
                      </span>
                      <span className={styles.miniSub}>{entry.correct ? (entry.kind === "region" ? "Region" : "Record") : `You said ${entry.pickedLabel}`}</span>
                    </span>
                    <button type="button" className={`${styles.shell} ${styles.miniReplay}`} style={{ clipPath: clip(7) }} aria-label={`Replay round ${entryIndex + 1}`} onClick={() => replayHistory(entry)}>
                      <span className={styles.face} style={{ clipPath: clip(7) }}>
                        <ReplayIcon />
                      </span>
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <button ref={resultRef} type="button" className={`${styles.shell} bg-[#f2f2f0]`} style={{ clipPath: clip(10) }} onClick={again}>
              <span className={styles.face} style={{ clipPath: clip(10), minWidth: "8.5rem" }}>
                Play again
              </span>
            </button>
            <div className={styles.links}>
              <Link href={lastHeard ? `/listen?region=${lastHeard.regionId}&data=${dataParam(lastHeard.layer)}` : "/listen"}>Hear the real data</Link>
              <Link href="/challenge/compose">Next · Compose</Link>
              <button type="button" onClick={() => void copyLink(shareResult)}>
                Copy link
              </button>
              <button type="button" onClick={() => void saveImage(`${correctCount} of ${deck.length} named`, `${score} PTS · BEST STREAK ${best}`)}>
                Save image
              </button>
            </div>
            {shareNote ? <p className={styles.note}>{shareNote}</p> : null}
            {soundOff ? (
              <div className={styles.banner} role="status">
                <p>Sound is off.</p>
                <button type="button" onClick={turnSoundOn}>
                  Turn sound on
                </button>
              </div>
            ) : null}
          </section>
        ) : round && geometry ? (
          <>
            <div className={styles.stage}>
              <span className={`${styles.shell} ${styles.clue}`} style={{ clipPath: clip(7) }}>
                <span className={styles.face} style={{ clipPath: clip(7) }}>
                  {`CLUE ${clueValue(round).toUpperCase()}`}
                </span>
              </span>
              <svg className={styles.curve} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" role="img" aria-label={playingNow ? "Playing the signal" : phase === "answered" ? `${verdict} ${oneLineWhy(why)}` : `Signal across ${AXIS.join(", ")}. ${question}`}>
                <defs>
                  <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f2f2f0" stopOpacity="0.22" />
                    <stop offset="72%" stopColor="#f2f2f0" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="#f2f2f0" stopOpacity="0" />
                  </linearGradient>
                  <filter id={glowId} x="-8%" y="-50%" width="116%" height="200%">
                    <feGaussianBlur stdDeviation="8" />
                  </filter>
                  <clipPath id={plotClipId}>
                    <rect x="0" y="0" width={VW} height={BASE} />
                  </clipPath>
                </defs>
                <path className={styles.wave} d={WAVE} />
                <g clipPath={`url(#${plotClipId})`}>
                  <path d={geometry.fill} fill={`url(#${fillId})`} />
                  <path className={styles.glow} d={geometry.line} filter={`url(#${glowId})`} />
                  <path className={styles.line} d={geometry.line} />
                </g>
              </svg>
              <div className={styles.years} aria-hidden="true">
                {AXIS.map((year, yearIndex) => (
                  <span key={year} className={styles.year} style={{ left: `${(XS[yearIndex] / VW) * 100}%` }}>
                    {year}
                  </span>
                ))}
              </div>
              {geometry.mapped.map((point, pointIndex) => {
                const last = pointIndex === geometry.mapped.length - 1;
                const top = `${(point[1] / VH) * 100}%`;
                return (
                  <div key={AXIS[pointIndex]} className={styles.marker} style={{ left: `${(point[0] / VW) * 100}%` }} aria-hidden="true">
                    <span className={styles.stem} style={{ top, height: `${((BASE - point[1]) / VH) * 100}%` }} />
                    {last && phase === "answered" ? <span className={styles.ring} style={{ top }} /> : <span className={styles.dot} style={{ top }} />}
                    {last && phase === "answered" ? (
                      <span className={styles.tip} style={{ top, clipPath: clip(6) }}>
                        <span className={styles.face} style={{ clipPath: clip(6) }}>
                          {tip}
                        </span>
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {phase === "answered" ? (
              <div className={styles.verdictBlock} data-testid="guess-reveal" role="status">
                <p className={styles.verdict}>{verdict}</p>
                <p className={styles.why}>{oneLineWhy(why)}</p>
              </div>
            ) : null}

            <div className={styles.dock}>
              {phase === "answered" ? null : (
                <h2 ref={questionRef} className={styles.prompt} tabIndex={-1}>
                  {question}
                </h2>
              )}
              <div className={styles.row}>
                {heard && !blocked ? (
                  <button type="button" className={`${styles.shell} ${styles.replay}`} style={{ clipPath: clip(8) }} aria-label="Replay" aria-keyshortcuts="R" onClick={replay}>
                    <span className={styles.face} style={{ clipPath: clip(8) }}>
                      <ReplayIcon />
                    </span>
                  </button>
                ) : null}
                <div className={styles.answers} role="group" aria-label="Answers">
                  {round.choices.map((choice, choiceIndex) => {
                    const name = displayChoice(round, choice.id, choice.label);
                    const picked = pickedId === choice.id;
                    const isAnswer = phase === "answered" && choice.id === round.answerId;
                    const cream = Boolean(isAnswer && picked);
                    let mark = "";
                    if (phase === "answered" && choice.id === round.answerId) mark = "✓";
                    else if (phase === "answered" && picked) mark = "✕";
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        className={`${styles.shell} ${styles.choice}${cream ? " bg-[#f2f2f0]" : ""}`}
                        style={{ clipPath: clip(8) }}
                        data-testid="guess-choice"
                        data-result={phase === "answered" ? (choice.id === round.answerId ? "correct" : picked ? "wrong" : undefined) : undefined}
                        data-locked={waiting ? "true" : undefined}
                        disabled={waiting}
                        aria-disabled={phase !== "listening"}
                        aria-pressed={picked}
                        aria-keyshortcuts={String(choiceIndex + 1)}
                        aria-label={waiting ? `${choiceIndex + 1}, ${name}, locked` : undefined}
                        onClick={() => {
                          if (waiting || phase !== "listening") return;
                          choose(choice.id);
                        }}
                      >
                        <span className={styles.face} style={{ clipPath: clip(8) }}>
                          <span className={styles.key}>{choiceIndex + 1}</span>
                          <span className={styles.choiceLabel}>{name}</span>
                          {mark ? <span className={styles.mark}>{mark}</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {phase === "answered" ? (
                  <div className={`sonify-next ${styles.cta}`}>
                    <button ref={nextRef} type="button" className={`${styles.shell} bg-[#f2f2f0]`} style={{ clipPath: clip(8) }} aria-keyshortcuts="Enter" onClick={advance}>
                      <span className={styles.face} style={{ clipPath: clip(8) }}>
                        Next signal
                      </span>
                    </button>
                  </div>
                ) : phase === "ready" || blocked ? (
                  <div className={styles.cta}>
                    <button ref={hearRef} type="button" className={`${styles.shell} bg-[#f2f2f0]`} style={{ clipPath: clip(8) }} data-testid="guess-hear" onClick={hear}>
                      <span className={styles.face} style={{ clipPath: clip(8) }}>
                        Hear signal
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
              {soundOff ? (
                <div className={styles.banner} role="status">
                  <p>Sound is off.</p>
                  <button type="button" onClick={turnSoundOn}>
                    Turn sound on
                  </button>
                </div>
              ) : null}
              {blocked ? (
                <div className={styles.alert} role="alert">
                  <p>The sound did not start. Press Hear signal again.</p>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
