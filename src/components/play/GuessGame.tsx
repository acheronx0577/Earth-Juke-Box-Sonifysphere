"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
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
  type GuessRound,
} from "@/lib/signalTheory";
import { IconPlay, SignalMeter } from "@/components/shared/Icons";
import { CutButton } from "@/components/play/CutControls";
import { PlayFrame } from "@/components/play/PlayFrame";
import { RoundRail } from "@/components/play/RoundRail";
import { SignalMap } from "@/components/play/SignalMap";
import { useSonifyPlayer } from "@/context/SonifyPlayerContext";
import { SoundOffNote } from "@/components/shared/SoundOffNote";
import { ChallengeShareActions } from "@/components/play/ChallengeShareActions";
import { encodeGuessResult, type SharedGuessResult } from "@/lib/challengeResults";

type Phase = "ready" | "listening" | "answered" | "result";

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

function clueLabel(round: GuessRound): string {
  return round.kind === "region" ? "Clue · record, season, weather" : "Clue · region";
}

function clueValue(round: GuessRound): string {
  if (round.kind === "layer") return round.prompt;
  return `${recordDisplayName(round.layer)} · ${round.season} · ${round.weather}`;
}

function FeedbackBlock({
  correct,
  verdict,
  why,
  gain,
  streak,
  last,
  onAdvance,
  nextRef,
  regionId,
  onVisible,
}: {
  readonly correct: boolean;
  readonly verdict: string;
  readonly why: string;
  readonly gain: number;
  readonly streak: number;
  readonly last: boolean;
  readonly onAdvance: () => void;
  readonly nextRef: (node: HTMLButtonElement | null) => void;
  readonly regionId: string;
  readonly onVisible: (button: HTMLButtonElement | null) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const show = () => {
      const button = node.querySelector("button");
      node.scrollIntoView({ block: "end", inline: "nearest" });
      if (button) {
        const rect = button.getBoundingClientRect();
        if (rect.bottom > window.innerHeight - 8 || rect.top < 0) {
          button.scrollIntoView({ block: "center", inline: "nearest" });
        }
      }
      onVisibleRef.current(button);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      show();
      return;
    }
    const tween = gsap.from(node, {
      height: 0,
      duration: 0.35,
      ease: "power3.out",
      clearProps: "height",
      onComplete: show,
    });
    return () => {
      tween.kill();
    };
  }, []);

  return (
    <div className={`sonify-feedback ${correct ? "is-right" : "is-wrong"}`} data-testid="guess-reveal" role="status" ref={ref}>
      <div className="sonify-feedback-msg">
        <p className="sonify-verdict">
          <span className="sonify-vmark" aria-hidden="true">
            {correct ? "✓" : "✕"}
          </span>
          {verdict}
        </p>
        <p className="sonify-why">
          <b>Why:</b> {why}
        </p>
        <div className="sonify-next">
          <CutButton solid onClick={onAdvance} ref={nextRef} aria-keyshortcuts="Enter">
            <IconPlay />
            {last ? "See result" : "Play next signal"}
            <span className="sonify-kbd">↵</span>
          </CutButton>
          <span className="about-kicker">
            +{gain} · Streak {streak}
          </span>
        </div>
      </div>
      <div className="sonify-feedback-map">
        <SignalMap regionId={regionId} fill />
      </div>
    </div>
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
  const [blocked, setBlocked] = useState(false);
  const [soundOff, setSoundOff] = useState(false);
  const [gain, setGain] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [booted, setBooted] = useState(false);
  const [savedRun, setSavedRun] = useState<StoredGuessRun | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const liveTimer = useRef<number | null>(null);
  const phaseRef = useRef(phase);
  const indexRef = useRef(index);
  const pendingFocus = useRef<"next" | "question" | "result" | "hear" | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  const hearRef = useRef<HTMLButtonElement | null>(null);
  const questionRef = useRef<HTMLHeadingElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const pendingSound = useRef<(() => void) | null>(null);
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
    (id: string) => {
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
        choose(choice.id);
      }
      if ((current === "listening" || current === "answered") && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        playRound(active);
      }
      if (current === "answered" && event.key === "Enter") {
        if (target instanceof HTMLElement && target.closest(".sonify-next")) return;
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

  const question = round?.kind === "region" ? "Which region is this?" : "Which record is this?";
  const answerText = round ? displayChoice(round, round.answerId, choiceLabel(round, round.answerId)) : "";
  const correct = Boolean(round && pickedId && pickedId === round.answerId);
  const why = round && pickedId && phase === "answered" ? explainGuess(round, pickedId) : "";
  const playingNow = phase === "listening" && live;
  const heard = phase === "listening" || phase === "answered";
  const caption = (() => {
    if (visitSeed === null) return "Drawing a signal…";
    if (phase === "result") return `Done · ${deck.length} of ${deck.length} rounds`;
    if (phase === "answered") return `Round ${index + 1} of ${deck.length} · ${correct ? "Named" : "Missed"}`;
    const kind = round?.kind === "layer" ? "Record round" : "Region round";
    return `Round ${index + 1} of ${deck.length} · ${kind}`;
  })();

  const scoreToolbar = (
    <div className="sonify-score">
      <div>
        <span className="about-kicker">Score</span>
        <b>{score}</b>
      </div>
      <div>
        <span className="about-kicker">Streak</span>
        <b>{streak}</b>
      </div>
    </div>
  );

  const shareResult: SharedGuessResult = {
    correct: correctCount,
    total: deck.length,
    score,
    bestStreak: best,
  };

  if (sharedResult) {
    const accuracy = Math.round((sharedResult.correct / sharedResult.total) * 100);
    return (
      <PlayFrame title="Shared Guess the Signal result">
        <section className="sonify-console" aria-labelledby="shared-guess-title" data-testid="guess-shared-result">
          <div className="sonify-console-in flex flex-col gap-6 p-6 sm:p-10">
            <div>
              <p className="about-kicker">A player shared this result</p>
              <h2 id="shared-guess-title" className="m-0 font-sans text-3xl font-medium text-[#f2f2f0]">Guess the Signal</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 border-y border-[rgba(242,242,240,0.14)] py-5 sm:grid-cols-4">
              <div><span className="about-kicker">Signals named</span><p className="m-0 font-mono text-2xl text-[#f2f2f0]">{sharedResult.correct}/{sharedResult.total}</p></div>
              <div><span className="about-kicker">Accuracy</span><p className="m-0 font-mono text-2xl text-[#f2f2f0]">{accuracy}%</p></div>
              <div><span className="about-kicker">Score</span><p className="m-0 font-mono text-2xl text-[#f2f2f0]">{sharedResult.score}</p></div>
              <div><span className="about-kicker">Best streak</span><p className="m-0 font-mono text-2xl text-[#f2f2f0]">{sharedResult.bestStreak}</p></div>
            </div>
            <p className="sonify-help m-0">Each signal connects sound patterns to a region or data record. Play a round to hear the pattern, then compare the clue with the answer.</p>
            <ChallengeShareActions
              path="/challenge/guess"
              params={{ result: encodeGuessResult(sharedResult) }}
              title="Guess the Signal"
              score={`${sharedResult.correct} / ${sharedResult.total}`}
              detail={`Accuracy ${accuracy}% · Score ${sharedResult.score} · Best streak ${sharedResult.bestStreak}`}
              fileName="sonifysphere-guess-result.png"
            />
            <Link href="/challenge/guess" className="sonify-text-next">Play Guess the Signal →</Link>
          </div>
        </section>
      </PlayFrame>
    );
  }

  return (
    <PlayFrame title="Guess the Signal" toolbar={scoreToolbar} className="sonify-guess">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div data-testid="guess-game" data-ready={visitSeed === null || !booted ? "false" : "true"} data-seed={visitSeed ?? undefined}>
        <RoundRail count={deck.length || rounds} index={index} done={phase === "result"} history={history} />
        <div className="sonify-railcap">
          <span className="about-kicker">{caption}</span>
          {phase === "result" ? null : <span className="about-kicker sonify-keys">Keys: 1–4 answer · R replay · Enter next</span>}
        </div>

        {savedRun ? (
          <div className="sonify-console" role="status">
            <div className="sonify-console-in">
              <p className="about-kicker">Saved round</p>
              <h2>A saved round is still open.</h2>
              <p className="sonify-help">Starting this one replaces round {savedRun.index + 1}.</p>
              <div className="sonify-controls">
                <CutButton solid onClick={() => openFresh(seed ?? freshSeed())}>
                  Start this one
                </CutButton>
                <CutButton onClick={() => router.replace(`/challenge/guess?seed=${savedRun.seed}`, { scroll: false })}>
                  Resume saved round
                </CutButton>
              </div>
            </div>
          </div>
        ) : visitSeed === null || !booted ? (
          <div className="sonify-console" data-testid="guess-skeleton" aria-busy="true">
            <div className="sonify-console-in sonify-guess-grid">
              <div className="sonify-ask">
                <div className="sonify-skel" style={{ width: "40%", height: 14 }} />
                <div className="sonify-skel" style={{ width: "80%", height: 40 }} />
                <div className="sonify-skel" style={{ height: 64 }} />
              </div>
              <div className="sonify-choices">
                {["one", "two", "three", "four"].map((slot) => (
                  <div key={slot} className="sonify-skel" />
                ))}
              </div>
            </div>
          </div>
        ) : phase === "result" ? (
          <section className="sonify-console" data-testid="guess-result">
            <div className="sonify-console-in sonify-result">
              <div className="sonify-result-main">
                <p className="about-kicker">Your result</p>
                <div className="sonify-result-score" tabIndex={-1} ref={resultRef}>
                  {correctCount}
                  <small> / {deck.length}</small>
                </div>
                <p className="sonify-named">named.</p>
                <div className="sonify-result-stats">
                  <div>
                    <span className="about-kicker">Score </span>
                    <b>{score}</b>
                  </div>
                  <div>
                    <span className="about-kicker">Best streak </span>
                    <b>{best}</b>
                  </div>
                </div>
                <div className="sonify-result-actions">
                  <CutButton solid onClick={again}>
                    Play again
                  </CutButton>
                  {round ? (
                    <Link href={`/listen?region=${round.regionId}&data=${dataParam(round.layer)}`} className="sonify-cut-link">
                      <span>Hear the real data →</span>
                    </Link>
                  ) : null}
                </div>
                <Link href="/challenge/compose" className="sonify-text-next">
                  Next: try Compose →
                </Link>
                <p className="sonify-help m-0">{correctCount === deck.length ? "You identified every signal. Replay the rounds to connect each sound with its region or record." : "Review each missed round and replay its sound to connect the pattern with the correct region or record."}</p>
                <ChallengeShareActions
                  path="/challenge/guess"
                  params={{ result: encodeGuessResult(shareResult) }}
                  title="Guess the Signal"
                  score={`${correctCount} / ${deck.length}`}
                  detail={`Score ${score} · Best streak ${best}`}
                  fileName="sonifysphere-guess-result.png"
                />
              </div>
              <div className="sonify-result-list">
                <p className="about-kicker">Round by round</p>
                {soundOff ? <SoundOffNote onTurnOn={turnSoundOn} /> : null}
                <ol>
                  {history.map((entry, entryIndex) => (
                    <li key={`${entry.answerId}-${entryIndex}`}>
                      <span className={`sonify-rk ${entry.correct ? "is-ok" : "is-no"}`} aria-hidden="true">
                        {entry.correct ? "✓" : "✕"}
                      </span>
                      <span>
                        <small>
                          Round {entryIndex + 1} · {entry.kind === "region" ? "Region" : "Record"}
                        </small>
                        {entry.correct ? entry.answerLabel : `${entry.answerLabel} · you said ${entry.pickedLabel}`}
                      </span>
                      <CutButton aria-label={`Replay round ${entryIndex + 1}`} onClick={() => replayHistory(entry)}>
                        <IconPlay />
                      </CutButton>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        ) : round ? (
          <div className="sonify-console">
            <div className="sonify-console-in">
              <div className="sonify-guess-grid">
                <div className="sonify-ask">
                  <p className="about-kicker">
                    Round {index + 1} of {deck.length}
                  </p>
                  <h2 ref={questionRef} tabIndex={-1}>
                    {question}
                  </h2>
                  <div className="sonify-clue">
                    <span className="about-kicker">{clueLabel(round)}</span>
                    <span className="sonify-clue-val">{clueValue(round)}</span>
                  </div>
                  <CutButton
                    ref={hearRef}
                    solid={phase === "ready" || playingNow || blocked}
                    data-testid="guess-hear"
                    aria-disabled={playingNow || undefined}
                    aria-keyshortcuts={heard && !blocked ? "R" : undefined}
                    onClick={() => {
                      if (playingNow) return;
                      if (phase === "ready" || blocked) hear();
                      else replay();
                    }}
                  >
                    <IconPlay />
                    {blocked ? "Hear the signal" : playingNow ? "Playing…" : heard ? "Replay" : "Hear the signal"}
                    {heard && !playingNow && !blocked ? <span className="sonify-kbd">R</span> : null}
                  </CutButton>
                  <div className="sonify-live-row">
                    <SignalMeter live={live && !blocked} />
                    <span className="about-kicker">
                      {blocked
                        ? "Sound blocked"
                        : playingNow
                          ? "Four notes · 1968 → 2024"
                          : phase === "answered"
                            ? "Answered · see why below"
                            : heard
                              ? "Heard · pick an answer"
                              : "Press Hear to start"}
                    </span>
                  </div>
                </div>
                <div className="sonify-choices" role="group" aria-label="Answers">
                  <p className="about-kicker">
                    {phase === "ready" || blocked ? "Answers unlock after you hear the signal" : "Pick one"}
                  </p>
                  {round.choices.map((choice, choiceIndex) => {
                    let result: string | undefined;
                    if (phase === "answered" && choice.id === round.answerId) result = "correct";
                    else if (phase === "answered" && choice.id === pickedId) result = "wrong";
                    const locked = phase === "answered";
                    const waiting = phase === "ready" || blocked;
                    let end = "";
                    if (result === "correct" && choice.id === pickedId) end = "✓ Your pick · correct";
                    else if (result === "correct") end = "✓ Answer";
                    else if (result === "wrong") end = "✕ Your pick";
                    return (
                      <CutButton
                        key={choice.id}
                        variant="choice"
                        data-testid="guess-choice"
                        data-result={result}
                        data-locked={locked ? "true" : undefined}
                        aria-disabled={waiting || undefined}
                        aria-pressed={pickedId === choice.id}
                        aria-keyshortcuts={String(choiceIndex + 1)}
                        onClick={() => {
                          if (waiting) return;
                          choose(choice.id);
                        }}
                      >
                        <span className="sonify-keycap">{choiceIndex + 1}</span>
                        <span className="sonify-choice-label">{displayChoice(round, choice.id, choice.label)}</span>
                        <span className="sonify-choice-end">{end}</span>
                      </CutButton>
                    );
                  })}
                </div>
              </div>
              {soundOff ? <SoundOffNote onTurnOn={turnSoundOn} /> : null}
              {blocked ? (
                <div className="sonify-audio-error" role="alert" ref={(node) => node?.scrollIntoView({ block: "nearest" })}>
                  <span className="sonify-vmark" aria-hidden="true">
                    !
                  </span>
                  <div>
                    <p>The sound did not start.</p>
                    <p>Your browser may be blocking audio for this tab. Press Hear the signal again, or turn sound on in the tab settings.</p>
                  </div>
                </div>
              ) : null}
              {phase === "answered" && pickedId ? (
                <FeedbackBlock
                  correct={correct}
                  verdict={`${correct ? "Yes." : "No."} ${answerText}.`}
                  why={why}
                  gain={gain}
                  streak={streak}
                  last={index + 1 >= deck.length}
                  onAdvance={advance}
                  nextRef={(node) => {
                    nextRef.current = node;
                  }}
                  onVisible={(button) => button?.focus({ preventScroll: true })}
                  regionId={round.regionId}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </PlayFrame>
  );
}
