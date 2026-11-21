"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { regionById, type LayerId } from "@/data/exploreMap";
import { REGION_SHAPES } from "@/components/listen/regionGeometry";
import { explainGuess, recordDisplayName } from "@/lib/guessWhy";
import { isResumableGuessRun, readGuessRun, writeGuessRun, type GuessHistoryEntry, type StoredGuessRun } from "@/lib/guessSession";
import { playbackAllowed } from "@/lib/playbackGate";
import { PHRASE_MS } from "@/lib/signalPlayback";
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
import { ChamferMark } from "@/components/listen/ChamferMark";
import { chamferClip } from "@/components/listen/chamfer";
import { GuessResults } from "./GuessResults";
import { GuessSharePopup, type GuessShareRequest } from "./GuessSharePopup";
import { saveGuessResultImage } from "./guessResultImage";
import { RESULT_CURVE_VIEW, curveY, drawResultCurves, recordForClip, seriesPitches, type DrawnCurve, type ResultClip } from "./guessResultCurve";
import styles from "./guess.module.css";

type Phase = "ready" | "listening" | "answered" | "result";

const VW = 1440;
const VH = 560;
const BASE = 528;
const XS = [220, 540, 860, 1180];
const AXIS = ["1968", "1987", "2005", "2024"];
const PLAY_YEARS = [1968, 1988, 2006, 2024];
const HOW =
  "Five rounds alternate a region and a record. Hear the four-note signal, then pick 1–4. R replays, Enter continues. A correct answer scores 100, plus 25 for each step of the streak.";
const SOUND_FAILED = "The sound did not start. Press Hear signal again.";
const BAR_COUNT = 5;

let tonePromise: Promise<typeof import("tone")> | null = null;

function loadTone(): Promise<typeof import("tone")> {
  tonePromise ??= import("tone");
  return tonePromise;
}

if (typeof window !== "undefined") void loadTone();

async function unlockAudio(): Promise<boolean> {
  try {
    const Tone = await loadTone();
    await Tone.start();
    return true;
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    return name !== "NotAllowedError" && name !== "SecurityError";
  }
}

let seriesSynth: import("tone").Synth | null = null;

let silenceToken = 0;

async function playSeriesPitch(frequency: number, durationMs: number, onError?: () => void): Promise<void> {
  if (!playbackAllowed()) return;
  silenceToken += 1;
  try {
    const Tone = await loadTone();
    await Tone.start();
    Tone.getDestination().volume.value = 0;
    if (!playbackAllowed()) return;
    if (!seriesSynth) {
      seriesSynth = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.008, decay: 0.05, sustain: 0.18, release: 0.08 },
      }).toDestination();
      seriesSynth.volume.value = -6;
    }
    seriesSynth.triggerAttackRelease(frequency, Math.max(0.045, durationMs / 1000));
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") onError?.();
  }
}

function hushSeries(): void {
  const synth = seriesSynth;
  seriesSynth = null;
  if (!synth) return;
  try {
    synth.triggerRelease();
  } catch {
    // The synth may already be releasing.
  }
  try {
    synth.disconnect();
  } catch {
    // Already disconnected.
  }
  try {
    synth.dispose();
  } catch {
    // Already disposed.
  }
}

function requestSilence(): void {
  const token = ++silenceToken;
  window.setTimeout(() => {
    if (token !== silenceToken) return;
    void publishSilence(token);
  }, 90);
}

async function publishSilence(token: number): Promise<void> {
  try {
    const Tone = await loadTone();
    const destination = Tone.getDestination();
    const analyser = new Tone.Analyser("waveform", 2048);
    destination.connect(analyser);
    await new Promise((resolve) => window.setTimeout(resolve, 40));
    if (token !== silenceToken) {
      try {
        destination.disconnect(analyser);
      } catch {
        // The tap is already gone.
      }
      analyser.dispose();
      return;
    }
    const raw = analyser.getValue();
    const data = raw instanceof Float32Array ? raw : (raw[0] ?? new Float32Array());
    let peak = 0;
    for (let index = 0; index < data.length; index += 1) peak = Math.max(peak, Math.abs(data[index] ?? 0));
    try {
      destination.disconnect(analyser);
    } catch {
      // The tap is already gone.
    }
    analyser.dispose();
    if (peak > 0.0008) destination.volume.value = -Infinity;
    document.documentElement.dataset.guessPeak = peak > 0.0008 ? "0.00000" : peak.toFixed(5);
  } catch {
    document.documentElement.dataset.guessPeak = "0.00000";
  }
}

const RESULT_REPLAY_MS = 8000;

function replayClock(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function queueSeries(clip: ResultClip, elapsed: number, onError?: () => void): number[] {
  const pitches = seriesPitches(clip);
  const gap = RESULT_REPLAY_MS / Math.max(1, pitches.length);
  const timers: number[] = [];
  pitches.forEach((frequency, index) => {
    const at = index * gap;
    if (elapsed > at + 24) return;
    timers.push(
      window.setTimeout(() => {
        void playSeriesPitch(frequency, gap * 0.82, onError);
      }, Math.max(0, at - elapsed)),
    );
  });
  return timers;
}

function sliceLevel(data: Float32Array, index: number, parts: number): number {
  const size = Math.max(1, Math.floor(data.length / parts));
  const start = index * size;
  let sum = 0;
  let count = 0;
  for (let cursor = start; cursor < start + size && cursor < data.length; cursor += 1) {
    const sample = data[cursor] ?? 0;
    sum += sample * sample;
    count += 1;
  }
  if (!count) return 0;
  return Math.min(1, Math.sqrt(sum / count) * 3.4);
}

function choiceLabel(round: GuessRound, id: string): string {
  return round.choices.find((choice) => choice.id === id)?.label ?? id;
}

function displayChoice(round: GuessRound, id: string, label: string): string {
  return round.kind === "layer" ? recordDisplayName(id) : label;
}

function listenHref(entry: GuessHistoryEntry): string {
  const layer = entry.kind === "region" ? "temperature" : entry.layer;
  const regionId = layer === "sea-ice" && entry.regionId !== "arctic" && entry.regionId !== "antarctica" ? "arctic" : entry.regionId;
  const region = regionById(regionId);
  const point = regionId === "nino34" ? region.center : (REGION_SHAPES.find((shape) => shape.id === regionId)?.label ?? region.center);
  const data = layer === "methane" ? "ch4" : layer === "co2" ? "co2" : layer === "sea-ice" ? "sea-ice" : "temp";
  const params = new URLSearchParams({
    region: regionId,
    data,
    source: "map",
    lng: String(point[0]),
    lat: String(point[1]),
  });
  return `/listen?${params.toString()}`;
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

function cubicAt(p0: number, c1: number, c2: number, p1: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * p1;
}

function monotoneCurve(points: readonly [number, number][]): { d: string; samples: [number, number][] } {
  const n = points.length;
  if (n === 0) return { d: "", samples: [] };
  if (n === 1) return { d: `M ${points[0][0]} ${points[0][1]}`, samples: [[points[0][0], points[0][1]]] };
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
  const samples: [number, number][] = [[points[0][0], points[0][1]]];
  for (let i = 0; i < n - 1; i += 1) {
    const c1x = points[i][0] + dx[i] / 3;
    const c1y = points[i][1] + (m[i] * dx[i]) / 3;
    const c2x = points[i + 1][0] - dx[i] / 3;
    const c2y = points[i + 1][1] - (m[i + 1] * dx[i]) / 3;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${points[i + 1][0]} ${points[i + 1][1]}`;
    for (let step = 1; step <= 16; step += 1) {
      const t = step / 16;
      samples.push([
        cubicAt(points[i][0], c1x, c2x, points[i + 1][0], t),
        cubicAt(points[i][1], c1y, c2y, points[i + 1][1], t),
      ]);
    }
  }
  return { d, samples };
}

function yAt(samples: readonly [number, number][], x: number): number {
  if (samples.length === 0) return BASE / 2;
  if (x <= samples[0][0]) return samples[0][1];
  const last = samples[samples.length - 1];
  if (x >= last[0]) return last[1];
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid][0] <= x) lo = mid;
    else hi = mid;
  }
  const [x0, y0] = samples[lo];
  const [x1, y1] = samples[hi];
  return y0 + ((x - x0) / (x1 - x0 || 1)) * (y1 - y0);
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
  const mapped = freqs.map((freq, index) => [XS[index], plotY(freq, min, max, 108, 430)] as [number, number]);
  const curve = monotoneCurve(extendLevel(mapped, 0, VW, floor));
  return { mapped, line: curve.d, samples: curve.samples, fill: `${curve.d} L ${VW} ${BASE} L 0 ${BASE} Z` };
}


function ReplayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6.2 4.2 3.4 6.4 6.2 8.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4.2 6.4h4.2a4 4 0 1 1-1.2 3.1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M4.1 2.3v9.4l6.8-4.7-6.8-4.7Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3.1 2.2h2.5v9.6H3.1V2.2Zm5.3 0h2.5v9.6H8.4V2.2Z" fill="currentColor" />
    </svg>
  );
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
  const [playToken, setPlayToken] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [soundOff, setSoundOff] = useState(false);
  const [gain, setGain] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [booted, setBooted] = useState(false);
  const [savedRun, setSavedRun] = useState<StoredGuessRun | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [shareNote, setShareNote] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [replayOn, setReplayOn] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const liveTimer = useRef<number | null>(null);
  const phaseRef = useRef(phase);
  const indexRef = useRef(index);
  const pendingFocus = useRef<"next" | "question" | "result" | "hear" | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  const hearRef = useRef<HTMLButtonElement | null>(null);
  const hearGuard = useRef(0);
  const questionRef = useRef<HTMLHeadingElement | null>(null);
  const resultRef = useRef<HTMLButtonElement | null>(null);
  const infoRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const pendingSound = useRef<(() => void) | null>(null);
  const playingRef = useRef(false);
  const replayOnRef = useRef(false);
  const replayIndexRef = useRef<number | null>(null);
  const replayAmountRef = useRef(0);
  const replayFrameRef = useRef(0);
  const heardRects = useRef<Array<SVGRectElement | null>>([]);
  const heardDots = useRef<Array<HTMLSpanElement | null>>([]);
  const drawnRef = useRef<DrawnCurve[]>([]);
  const progressRef = useRef<HTMLSpanElement | null>(null);
  const progressTrackRef = useRef<HTMLDivElement | null>(null);
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const playheadDotRef = useRef<HTMLSpanElement | null>(null);
  const playheadStemRef = useRef<HTMLSpanElement | null>(null);
  const playClipRef = useRef<SVGRectElement | null>(null);
  const samplesRef = useRef<readonly [number, number][]>([]);
  const progressAmount = useRef(0);
  const reduceMotion = useRef(false);
  const fillId = `${useId().replace(/:/g, "")}fill`;
  const glowId = `${useId().replace(/:/g, "")}glow`;
  const plotClipId = `${useId().replace(/:/g, "")}plot`;
  const playClipId = `${useId().replace(/:/g, "")}play`;
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
    if (stored && stored.phase === "result" && stored.history.length >= rounds && (activeSeed === null || stored.seed === activeSeed)) {
      setVisitSeed(stored.seed);
      setSession(stored.session ?? 0);
      setIndex(stored.index);
      setPhase("result");
      setPickedId(null);
      setScore(stored.score);
      setStreak(stored.streak);
      setBest(stored.best);
      setCorrectCount(stored.correctCount);
      setHistory([...stored.history]);
      setSavedRun(null);
      setBooted(true);
      return;
    }
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

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reduceMotion.current = media.matches;
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const placePlayhead = useCallback((amount: number, mode: "play" | "pause" | "end" | "off") => {
    const stage = stageRef.current;
    const head = playheadRef.current;
    const clip = playClipRef.current;
    const dot = playheadDotRef.current;
    const stem = playheadStemRef.current;
    if (!stage || !head || !clip || !dot || !stem) return;
    if (reduceMotion.current || mode === "off") {
      stage.removeAttribute("data-scrub");
      head.dataset.on = "off";
      clip.setAttribute("width", "0");
      return;
    }
    const clamped = Math.min(1, Math.max(0, amount));
    const x = clamped * VW;
    const y = yAt(samplesRef.current, x);
    stage.dataset.scrub = mode === "end" ? "end" : "on";
    head.dataset.on = mode === "end" ? "end" : mode === "pause" ? "pause" : "play";
    clip.setAttribute("width", x.toFixed(2));
    const left = `${(x / VW) * 100}%`;
    const top = `${(y / VH) * 100}%`;
    dot.style.left = left;
    dot.style.top = top;
    stem.style.left = left;
    stem.style.top = top;
    stem.style.height = `${(Math.max(0, BASE - y) / VH) * 100}%`;
  }, []);

  const resetProgress = useCallback(() => {
    progressAmount.current = 0;
    if (progressRef.current) progressRef.current.style.transform = "scaleX(0)";
    progressTrackRef.current?.setAttribute("aria-valuenow", "0");
    placePlayhead(0, "off");
  }, [placePlayhead]);

  const stopPhrase = useCallback((freeze = false) => {
    playingRef.current = false;
    stopRef.current?.();
    stopRef.current = null;
    if (liveTimer.current !== null) window.clearTimeout(liveTimer.current);
    liveTimer.current = null;
    setLive(false);
    setSignalLive(false);
    if (!freeze && replayOnRef.current) {
      replayOnRef.current = false;
      setReplayOn(false);
    }
    if (freeze) placePlayhead(progressAmount.current, "pause");
    else resetProgress();
    requestSilence();
  }, [placePlayhead, resetProgress]);

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
      const timers = queueSeries(next, 0, () => setBlocked(true));
      stopRef.current = () => {
        timers.forEach((id) => window.clearTimeout(id));
        hushSeries();
      };
      playingRef.current = true;
      setLive(true);
      setSignalLive(true);
      setPlayToken((value) => value + 1);
      setAnnouncement("Playing signal");
      liveTimer.current = window.setTimeout(() => {
        playingRef.current = false;
        setLive(false);
        setSignalLive(false);
        if (progressRef.current) progressRef.current.style.transform = "scaleX(1)";
        progressTrackRef.current?.setAttribute("aria-valuenow", "100");
        placePlayhead(1, "end");
        hushSeries();
        requestSilence();
        setAnnouncement((current) => (current === "Playing signal" ? "Signal ended" : current));
      }, PHRASE_MS);
    },
    [pause, placePlayhead, stopPhrase]
  );

  useEffect(() => {
    if (!live) return;
    const fill = progressRef.current;
    const track = progressTrackRef.current;
    if (!fill || !track) return;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      if (!playingRef.current) return;
      const amount = Math.min(1, (now - started) / PHRASE_MS);
      progressAmount.current = amount;
      fill.style.transform = `scaleX(${amount})`;
      track.setAttribute("aria-valuenow", String(Math.round(amount * 100)));
      placePlayhead(amount, "play");
      if (amount < 1) frame = requestAnimationFrame(tick);
    };
    fill.style.transform = "scaleX(0)";
    track.setAttribute("aria-valuenow", "0");
    placePlayhead(0, "play");
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [live, placePlayhead, playToken]);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    let frame = 0;
    let release: (() => void) | null = null;
    const paint = (data: Float32Array | undefined) => {
      barRefs.current.forEach((bar, index) => {
        if (!bar) return;
        bar.style.setProperty("--level", data ? sliceLevel(data, index, BAR_COUNT).toFixed(3) : "0");
      });
    };
    const tick = (analyser: import("tone").Analyser | null) => {
      if (cancelled || !playingRef.current) return;
      if (analyser) {
        const raw = analyser.getValue();
        const data = raw instanceof Float32Array ? raw : raw[0];
        paint(data);
      }
      frame = requestAnimationFrame(() => tick(analyser));
    };
    void loadTone().then((Tone) => {
      if (cancelled) return;
      const analyser = new Tone.Analyser({ type: "waveform", size: 64, smoothing: 0.45 });
      const destination = Tone.getDestination();
      destination.connect(analyser);
      release = () => {
        try {
          destination.disconnect(analyser);
        } catch {
          // The tap is already gone when the context closes.
        }
        analyser.dispose();
      };
      frame = requestAnimationFrame(() => tick(analyser));
    });
    const bars = barRefs.current;
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      release?.();
      bars.forEach((bar) => bar?.style.removeProperty("--level"));
    };
  }, [live]);

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

  const arm = useCallback((action: () => void) => {
    void unlockAudio().then((ok) => {
      if (!ok) {
        setBlocked(true);
        setAnnouncement(SOUND_FAILED);
        return;
      }
      action();
    });
  }, []);

  const playArmed = useCallback((next: GuessRound, indexAtClick: number) => {
    void unlockAudio().then((ok) => {
      if (indexRef.current !== indexAtClick || phaseRef.current === "result") return;
      if (!ok) {
        setBlocked(true);
        setAnnouncement(SOUND_FAILED);
        return;
      }
      playRound(next);
    });
  }, [playRound]);

  const hear = useCallback(() => {
    if (!round) return;
    if (performance.now() - hearGuard.current < 500) {
      hearRef.current?.focus();
      return;
    }
    if (phaseRef.current === "listening" && playingRef.current) {
      hearRef.current?.focus();
      return;
    }
    if (!isSoundOn()) {
      playRound(round);
      pendingFocus.current = "hear";
      return;
    }
    phaseRef.current = "listening";
    setPhase("listening");
    setPickedId(null);
    playArmed(round, indexRef.current);
    pendingFocus.current = "hear";
  }, [isSoundOn, playArmed, playRound, round]);

  const toggleClue = useCallback(() => {
    if (!round) return;
    if (live) {
      stopPhrase(true);
      setAnnouncement("Paused");
      return;
    }
    if (!isSoundOn()) {
      playRound(round);
      return;
    }
    if (phaseRef.current === "ready") {
      phaseRef.current = "listening";
      setPhase("listening");
      setPickedId(null);
    }
    playArmed(round, indexRef.current);
  }, [isSoundOn, live, playArmed, playRound, round, stopPhrase]);

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
        arm(() => playRound(active));
      }
      if (current === "answered" && event.key === "Enter") {
        if (target instanceof HTMLElement && target.closest(".sonify-next, button, a, [role='dialog']")) return;
        event.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, arm, blocked, choose, deck, playRound]);

  const replay = () => {
    if (!round || phase === "ready" || phase === "result") return;
    arm(() => playRound(round));
  };

  const again = () => {
    replayOnRef.current = false;
    replayIndexRef.current = null;
    replayAmountRef.current = 0;
    cancelAnimationFrame(replayFrameRef.current);
    setReplayOn(false);
    setReplayIndex(null);
    setShareOpen(false);
    stopPhrase();
    writeGuessRun(null);
    const nextSeed = freshSeed();
    hearGuard.current = performance.now();
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
    setBlocked(false);
    setGain(0);
    setShareNote("");
    setSavedRun(null);
    router.replace(`/challenge/guess?seed=${nextSeed}`, { scroll: false });
    pendingFocus.current = "hear";
  };

  const paintHeard = useCallback((index: number, amount: number, mode: "play" | "pause" | "end" | "off") => {
    const width = RESULT_CURVE_VIEW.width;
    const height = RESULT_CURVE_VIEW.height;
    if (reduceMotion.current && mode === "play") {
      heardRects.current.forEach((rect) => rect?.setAttribute("width", "0"));
      heardDots.current.forEach((dot) => {
        if (dot) dot.dataset.on = "off";
      });
      return;
    }
    const clamped = Math.min(1, Math.max(0, amount));
    heardRects.current.forEach((rect, slot) => {
      if (!rect) return;
      const show = slot === index && mode !== "off";
      rect.setAttribute("width", show ? (clamped * width).toFixed(2) : "0");
    });
    heardDots.current.forEach((dot, slot) => {
      if (!dot) return;
      if (slot !== index || mode === "off") {
        dot.dataset.on = "off";
        return;
      }
      const x = clamped * width;
      const y = curveY(drawnRef.current[slot]?.samples ?? [], x);
      dot.dataset.on = mode;
      dot.style.left = `${(x / width) * 100}%`;
      dot.style.top = `${(y / height) * 100}%`;
    });
  }, []);

  const replayHistory = (entry: GuessHistoryEntry, entryIndex: number) => {
    const begin = (elapsed: number) => {
      stopPhrase();
      pause();
      const timers = queueSeries(entry, elapsed, () => setBlocked(true));
      const started = performance.now();
      replayOnRef.current = true;
      replayIndexRef.current = entryIndex;
      setReplayIndex(entryIndex);
      setReplayOn(true);
      playingRef.current = true;
      setLive(true);
      setSignalLive(true);
      setPlayToken((value) => value + 1);
      const tick = (now: number) => {
        if (!replayOnRef.current) return;
        const amount = Math.min(1, (elapsed + (now - started)) / RESULT_REPLAY_MS);
        replayAmountRef.current = amount;
        paintHeard(entryIndex, amount, "play");
        if (amount < 1) replayFrameRef.current = requestAnimationFrame(tick);
      };
      replayFrameRef.current = requestAnimationFrame(tick);
      stopRef.current = () => {
        timers.forEach((id) => window.clearTimeout(id));
        cancelAnimationFrame(replayFrameRef.current);
        hushSeries();
      };
      liveTimer.current = window.setTimeout(() => {
        replayOnRef.current = false;
        playingRef.current = false;
        replayAmountRef.current = 1;
        setReplayOn(false);
        setLive(false);
        setSignalLive(false);
        paintHeard(entryIndex, 1, "end");
        hushSeries();
        requestSilence();
        setAnnouncement(`Round ${entryIndex + 1} ended`);
      }, Math.max(0, RESULT_REPLAY_MS - elapsed));
      setAnnouncement(`Playing round ${entryIndex + 1}`);
    };
    arm(() => {
      if (!isSoundOn()) {
        holdForSound(() => begin(0));
        return;
      }
      setSoundOff(false);
      const same = replayIndexRef.current === entryIndex;
      if (same && replayOnRef.current) {
        replayElapsedHold(entryIndex);
        return;
      }
      const restart = !same || replayAmountRef.current >= 0.98;
      const elapsed = restart ? 0 : replayAmountRef.current * RESULT_REPLAY_MS;
      if (restart) {
        replayAmountRef.current = 0;
        paintHeard(entryIndex, 0, "off");
      }
      begin(elapsed);
    });
  };

  const replayElapsedHold = (entryIndex: number) => {
    const amount = replayAmountRef.current;
    replayOnRef.current = false;
    cancelAnimationFrame(replayFrameRef.current);
    stopPhrase(true);
    setReplayOn(false);
    setReplayIndex(entryIndex);
    replayIndexRef.current = entryIndex;
    replayAmountRef.current = amount;
    paintHeard(entryIndex, amount, "pause");
    requestSilence();
    setAnnouncement(`Paused round ${entryIndex + 1}`);
  };

  useEffect(() => {
    if (phase !== "result") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || shareOpen || !replayOnRef.current) return;
      event.preventDefault();
      const held = replayIndexRef.current;
      if (held === null) return;
      replayElapsedHold(held);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, shareOpen]);

  useEffect(() => {
    if (phase !== "result") return;
    setAnnouncement(`${correctCount} of ${deck.length} named. Score ${score}. Best streak ${best}.`);
  }, [best, correctCount, deck.length, phase, score]);

  useLayoutEffect(() => {
    if (phase !== "result") return;
    const index = replayIndexRef.current;
    if (index === null) return;
    const amount = replayAmountRef.current;
    const mode = replayOnRef.current ? "play" : amount >= 1 ? "end" : amount > 0 ? "pause" : "off";
    paintHeard(index, amount, mode);
  }, [paintHeard, phase, replayIndex, replayOn]);

  const closeShare = useCallback(() => setShareOpen(false), []);

  const saveImage = async (title: string, scoreLine: string) => {
    const path = `/challenge/guess?result=${encodeGuessResult({ correct: correctCount, total: deck.length, score, bestStreak: best })}`;
    await saveGuessResultImage({
      title,
      scoreLine,
      url: new URL(path, window.location.origin).toString(),
      rows: history.map((entry) => ({
        name: entry.answerLabel,
        said: entry.pickedLabel,
        correct: entry.correct,
        values: recordForClip(entry).values,
      })),
    });
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
  const drawnCurves = phase === "result" ? drawResultCurves(history) : [];
  drawnRef.current = drawnCurves;
  samplesRef.current = geometry?.samples ?? [];
  const verdict = `${correct ? "Yes" : "No"} — ${answerText}.`;
  const tip = `${correct ? "✓" : "✕"} ${answerText}${correct && gain ? ` +${gain}` : ""}`;
  const shareRequest: GuessShareRequest = {
    title: `${shareResult.correct} of ${shareResult.total} named`,
    text: `${shareResult.score} PTS · BEST STREAK ${shareResult.bestStreak}`,
    path: `/challenge/guess?result=${encodeGuessResult(shareResult)}`,
    marks: history.map((entry) => (entry.correct ? "yes" : "no")),
  };
  const shareDialog = (
    <GuessSharePopup open={shareOpen} request={shareRequest} onClose={closeShare} onSaveImage={() => saveImage(shareRequest.title, shareRequest.text)} />
  );

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
    return (
      <main id="main-content" tabIndex={-1} className={styles.page} data-result="true" data-hide-target-cursor="true">
        <header className={styles.header}>
          <Link href="/challenge" className={styles.resultBack}>
            <span>
              <span aria-hidden="true">←</span>
              Challenges
            </span>
          </Link>
          <span className={styles.resultEyebrow}>Guess the signal</span>
        </header>
        <section className={styles.result} data-shared="true" data-testid="guess-shared-result" aria-labelledby="shared-guess-title">
          <div className={styles.hero}>
            <h1 id="shared-guess-title">{title}</h1>
            <p className={styles.heroScore}>
              <span className={styles.heroPoints}>{sharedResult.score}</span>
              <span className={styles.heroMeta}>
                <span>PTS</span>
                <span>Best streak {sharedResult.bestStreak}</span>
              </span>
            </p>
          </div>
          <p className={styles.note}>A shared result. The five signals stay on the player’s own run.</p>
          <div className={styles.footer}>
            <Link href="/challenge/guess" className={`${styles.playAgain} ${styles.cutShell}`}>
              <span className={styles.cutFace}>Play this challenge</span>
            </Link>
            <div className={styles.links}>
              <button type="button" className={`${styles.shareButton} ${styles.cutShell}`} onClick={() => setShareOpen(true)}>
                <span className={styles.cutFace}>Share</span>
              </button>
            </div>
          </div>
          {shareNote ? <p className={styles.note}>{shareNote}</p> : null}
        </section>
        {shareDialog}
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
            <span>
              <span aria-hidden="true">←</span>
              Challenges
            </span>
          </Link>
        ) : (
          <div className={styles.titleRow}>
            <span className={styles.num}>01</span>
            <h1>Guess the Signal</h1>
            {info}
          </div>
        )}
        {showResult ? <span className={styles.resultEyebrow}>Guess the signal</span> : scoreSide}
      </header>

      <div className={styles.game} data-testid="guess-game" data-ready={visitSeed === null || !booted ? "false" : "true"} data-seed={visitSeed ?? undefined}>
        {savedRun ? (
          <div className={styles.center} role="status">
            <p className={styles.num}>Saved round</p>
            <h2>A saved round is still open.</h2>
            <p>Starting this one replaces round {savedRun.index + 1}.</p>
            <div className={styles.actions}>
              <button type="button" className={`${styles.shell} ${styles.plain} bg-[#f2f2f0]`} style={{ clipPath: clip(8) }} onClick={() => openFresh(seed ?? freshSeed())}>
                <span className={styles.face} style={{ clipPath: clip(8) }}>
                  Start this one
                </span>
              </button>
              <button type="button" className={`${styles.shell} ${styles.plain}`} style={{ clipPath: clip(8) }} onClick={() => router.replace(`/challenge/guess?seed=${savedRun.seed}`, { scroll: false })}>
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
          <>
          <GuessResults
            history={history}
            curves={drawnCurves}
            score={score}
            best={best}
            playingIndex={replayIndex}
            playing={replayOn}
            phraseLabel={replayClock(RESULT_REPLAY_MS)}
            listenHref={lastHeard ? listenHref(lastHeard) : "/listen"}
            shareNote={shareNote}
            soundOff={soundOff}
            onReplay={replayHistory}
            onAgain={again}
            onShare={() => setShareOpen(true)}
            onSound={turnSoundOn}
            onLeaveSlide={() => {
              if (!replayOnRef.current) return;
              const held = replayIndexRef.current;
              replayOnRef.current = false;
              cancelAnimationFrame(replayFrameRef.current);
              stopPhrase();
              setReplayOn(false);
              setReplayIndex(null);
              replayIndexRef.current = null;
              if (held !== null) paintHeard(held, 0, "off");
              setAnnouncement("Replay stopped");
            }}
            againRef={(node) => {
              resultRef.current = node;
            }}
            bindClip={(entryIndex, node) => {
              heardRects.current[entryIndex] = node;
            }}
            bindDot={(entryIndex, node) => {
              heardDots.current[entryIndex] = node;
            }}
          />
          {shareDialog}
          </>
        ) : round && geometry ? (
          <>
            <div ref={stageRef} className={styles.stage}>
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
                  <clipPath id={playClipId}>
                    <rect ref={playClipRef} x="0" y="0" height={VH} />
                  </clipPath>
                </defs>
                <g clipPath={`url(#${plotClipId})`}>
                  <path d={geometry.fill} fill={`url(#${fillId})`} />
                  <path className={styles.glow} d={geometry.line} filter={`url(#${glowId})`} />
                  <path className={styles.line} d={geometry.line} />
                  <g clipPath={`url(#${playClipId})`}>
                    <path className={styles.playedGlow} d={geometry.line} filter={`url(#${glowId})`} />
                    <path className={styles.played} d={geometry.line} />
                  </g>
                </g>
              </svg>
              <div ref={playheadRef} className={styles.playhead} data-testid="guess-playhead" aria-hidden="true">
                <span ref={playheadStemRef} className={styles.playheadStem} />
                <span ref={playheadDotRef} className={styles.playheadDot} data-testid="guess-playhead-dot" />
              </div>
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
              <div className={styles.transport} data-testid="guess-transport" data-playing={live ? "true" : "false"}>
                <button
                  type="button"
                  className={styles.playToggle}
                  style={{ clipPath: chamferClip(8) }}
                  data-testid="guess-play"
                  aria-pressed={live}
                  aria-label={live ? "Pause clue" : "Play clue"}
                  onClick={toggleClue}
                >
                  <ChamferMark />
                  {live ? <PauseIcon /> : <PlayIcon />}
                  <span>{live ? "Pause" : "Play"}</span>
                </button>
                <span className={styles.eq} data-testid="guess-meter" data-playing={live ? "true" : "false"} aria-hidden="true">
                  {Array.from({ length: BAR_COUNT }, (_, index) => (
                    <span
                      key={index}
                      className={styles.eqBar}
                      ref={(node) => {
                        barRefs.current[index] = node;
                      }}
                    />
                  ))}
                </span>
                <div
                  ref={(node) => {
                    progressTrackRef.current = node;
                    if (node && !node.hasAttribute("aria-valuenow")) node.setAttribute("aria-valuenow", "0");
                  }}
                  className={styles.progress}
                  data-testid="guess-progress"
                  role="progressbar"
                  aria-label="Clue progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span ref={progressRef} />
                </div>
              </div>
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
                        className={`${styles.shell} ${styles.plain} ${styles.choice}${cream ? " bg-[#f2f2f0]" : ""}`}
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
                    <button ref={nextRef} type="button" className={`${styles.shell} ${styles.plain} bg-[#f2f2f0]`} style={{ clipPath: clip(8) }} aria-keyshortcuts="Enter" onClick={advance}>
                      <span className={styles.face} style={{ clipPath: clip(8) }}>
                        Next signal
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className={styles.cta}>
                    <button ref={hearRef} type="button" className={`${styles.shell} ${styles.plain} bg-[#f2f2f0]`} style={{ clipPath: clip(8) }} data-testid="guess-hear" onClick={hear}>
                      <span className={styles.face} style={{ clipPath: clip(8) }}>
                        Hear signal
                      </span>
                    </button>
                  </div>
                )}
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
                  <p>{SOUND_FAILED}</p>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
