"use client";

import { useReducer, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { PlayFrame } from "@/components/play/PlayFrame";

interface MatchRound {
  id: string;
  roundNumber: number;
  title: string;
  metric: string;
  year: number;
  description: string;
  targetFreq: number;
  targetQ: number;
  fact: string;
}

const MATCH_ROUNDS: MatchRound[] = [
  {
    id: "round-1",
    roundNumber: 1,
    title: "1958 Keeling Baseline",
    metric: "315.71 ppm CO₂",
    year: 1958,
    description: "The very first high-altitude continuous atmospheric reading taken atop Mauna Loa.",
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
    description: "Earth's seasonal inhale-exhale cycle: northern forests bloom and absorb billions of tons of carbon.",
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
    description: "The highest monthly concentration recorded in human history across 823 consecutive months.",
    targetFreq: 650,
    targetQ: 6.8,
    fact: "At 432.34 ppm, modern atmosphere holds over 116 ppm more CO₂ than when measurements began in 1958.",
  },
];

const METER_HEIGHTS = [20, 35, 55, 75, 90, 75, 55, 35] as const;

function getCoherence(userFreq: number, userQ: number, targetFreq: number, targetQ: number): number {
  const freqDiff = Math.abs(userFreq - targetFreq) / targetFreq;
  const qDiff = Math.abs(userQ - targetQ) / targetQ;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - 0.7 * freqDiff - 0.3 * qDiff))));
}

function getMeterStyle(coherence: number) {
  if (coherence >= 88) {
    return { bar: "bg-[#f2f2f0]", text: "text-[#f2f2f0]", label: "★ LOCKED!" };
  }
  if (coherence >= 60) {
    return { bar: "bg-[#aaaaaa]", text: "text-[#aaaaaa]", label: "" };
  }
  return { bar: "bg-[#f2f2f0]/20", text: "text-[#f2f2f0]/60", label: "" };
}

function playSuccessChime(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
}

function playToneSnippet(ctx: AudioContext, freq: number, q: number) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(freq, ctx.currentTime);
  filter.Q.setValueAtTime(q, ctx.currentTime);

  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 1.8);
}

function GameCompleteView({ totalScore, onRestart }: { totalScore: number; onRestart: () => void }) {
  return (
    <PlayFrame title="Wave Match Complete">
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-6 py-12 text-center">
        <div className="flex size-20 items-center justify-center rounded-full border border-[#f2f2f0]/20 bg-[#f2f2f0]/5 text-3xl text-[#f2f2f0]">
          ✓
        </div>
        <h2 className="font-sans text-3xl font-medium tracking-tight text-[#f2f2f0]">
          All Planetary Signals Aligned
        </h2>
        <p className="font-mono text-sm text-[#f2f2f0]/70">
          Total Atmospheric Resonance Score: <strong className="text-[#f2f2f0]">{totalScore} PTS</strong>
        </p>
        <div className="my-2 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center justify-center bg-[#f2f2f0] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[#141414] transition-transform hover:scale-105 active:scale-95"
            style={{
              clipPath:
                "polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)",
            }}
          >
            Play Again
          </button>
          <Link
            href="/challenge"
            className="inline-flex items-center justify-center border border-[#f2f2f0]/20 bg-[#262626] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[#f2f2f0] transition-transform hover:scale-105 active:scale-95"
            style={{
              clipPath:
                "polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)",
            }}
          >
            Back to Challenges
          </Link>
        </div>
      </div>
    </PlayFrame>
  );
}

function AnomalyBriefCard({
  round,
  isPlayingTarget,
  onPlayTarget,
}: {
  round: MatchRound;
  isPlayingTarget: boolean;
  onPlayTarget: () => void;
}) {
  return (
    <div
      className="relative flex flex-col justify-between overflow-hidden p-6 text-[#f2f2f0]"
      style={{
        backgroundColor: "#262626",
        border: "1px solid rgba(242,242,240,0.16)",
        clipPath:
          "polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)",
      }}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-[#f2f2f0]/60">
          Target Anomaly {round.roundNumber}
        </span>
        <span className="font-mono text-xs font-semibold text-[#f2f2f0]">
          {round.metric}
        </span>
      </div>

      <h3 className="my-2 font-sans text-2xl font-medium tracking-tight text-[#f2f2f0]">
        {round.title}
      </h3>
      <p className="font-mono text-xs text-[#f2f2f0]/70">
        {round.description}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onPlayTarget}
          disabled={isPlayingTarget}
          className="inline-flex items-center gap-2 border border-[#f2f2f0]/20 bg-[#f2f2f0]/10 px-4 py-2 font-mono text-xs font-medium uppercase tracking-wider text-[#f2f2f0] transition-all hover:bg-[#f2f2f0]/20 active:scale-95 disabled:opacity-50"
        >
          <span>{isPlayingTarget ? "Playing Target..." : "▶ Listen to Target Sound"}</span>
        </button>
        <span className="font-mono text-[11px] text-[#f2f2f0]/50">
          Tune your carrier dials below to match this waveform.
        </span>
      </div>
    </div>
  );
}

function AudioMeter({
  coherence,
  isActive,
}: {
  coherence: number;
  isActive: boolean;
}) {
  const style = getMeterStyle(coherence);

  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-[#f2f2f0]/10 bg-[#141414] p-6 text-center">
      <div className="flex items-end justify-center gap-1.5 h-16 w-full max-w-xs">
        {METER_HEIGHTS.map((heightPct, idx) => {
          const activeHeight = isActive ? heightPct : 15;
          return (
            <div
              key={idx}
              className={`w-3.5 rounded-xs transition-all duration-150 ${style.bar}`}
              style={{
                height: `${(activeHeight * coherence) / 100}%`,
                minHeight: "4px",
              }}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <span className="font-mono text-xs uppercase tracking-widest text-[#f2f2f0]/60">
          Harmonic Coherence:
        </span>
        <span className={`font-mono text-base font-bold ${style.text}`}>
          {coherence}% {style.label}
        </span>
      </div>
    </div>
  );
}

function TuningDials({
  userFreq,
  userQ,
  onFreqChange,
  onQChange,
  isLocked,
}: {
  userFreq: number;
  userQ: number;
  onFreqChange: (v: number) => void;
  onQChange: (v: number) => void;
  isLocked: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2 rounded-lg border border-[#f2f2f0]/10 bg-[#262626] p-4">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-[#f2f2f0]/70">Carrier Frequency</span>
          <span className="font-bold text-[#f2f2f0]">{userFreq} Hz</span>
        </div>
        <input
          type="range"
          min="150"
          max="800"
          step="5"
          value={userFreq}
          onChange={(e) => onFreqChange(Number(e.target.value))}
          disabled={isLocked}
          className="accent-[#f2f2f0] cursor-pointer"
        />
        <span className="font-mono text-[10px] text-[#f2f2f0]/40">
          150 Hz (Baseline) → 800 Hz (High Peak)
        </span>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-[#f2f2f0]/10 bg-[#262626] p-4">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-[#f2f2f0]/70">Atmospheric Resonance (Q)</span>
          <span className="font-bold text-[#f2f2f0]">{userQ.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min="1.0"
          max="8.0"
          step="0.1"
          value={userQ}
          onChange={(e) => onQChange(Number(e.target.value))}
          disabled={isLocked}
          className="accent-[#f2f2f0] cursor-pointer"
        />
        <span className="font-mono text-[10px] text-[#f2f2f0]/40">
          1.0 Q (Broad Biosphere) → 8.0 Q (Sharp Surge)
        </span>
      </div>
    </div>
  );
}

function ToneButton({ isPlaying, onToggle, isLocked }: { isPlaying: boolean; onToggle: () => void; isLocked: boolean }) {
  const btnClass = isPlaying
    ? "border-[#aaaaaa] bg-[#aaaaaa]/20 text-[#f2f2f0]"
    : "border-[#f2f2f0]/20 bg-[#f2f2f0]/10 text-[#f2f2f0] hover:bg-[#f2f2f0]/20";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isLocked}
      className={`inline-flex items-center gap-2 border px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider transition-all active:scale-95 ${btnClass}`}
    >
      <span>{isPlaying ? "■ Stop Tuning Tone" : "▶ Start Tuning Tone"}</span>
    </button>
  );
}

function UncalibratedButton({ isReady, onLock }: { isReady: boolean; onLock: () => void }) {
  const style = isReady
    ? "bg-[#f2f2f0] text-[#141414] shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
    : "bg-[#f2f2f0]/20 text-[#f2f2f0]/40 cursor-not-allowed";

  return (
    <button
      type="button"
      onClick={onLock}
      disabled={!isReady}
      className={`inline-flex items-center justify-center px-8 py-3.5 font-mono text-xs font-bold uppercase tracking-wider transition-all ${style}`}
      style={{
        clipPath:
          "polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)",
      }}
    >
      {isReady ? "Lock Signal & Verify ✓" : "Tune Within 88% to Lock"}
    </button>
  );
}

function CalibratedNextButton({ onNext, hasNext }: { onNext: () => void; hasNext: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs font-bold text-[#f2f2f0]">
        ✓ Signal Calibrated!
      </span>
      <button
        type="button"
        onClick={onNext}
        className="inline-flex items-center justify-center bg-[#f2f2f0] px-8 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-[#141414] shadow-xl transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        style={{
          clipPath:
            "polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)",
        }}
      >
        {hasNext ? "Next Anomaly →" : "View Final Results →"}
      </button>
    </div>
  );
}

function FactBanner({ fact }: { fact: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[#f2f2f0]/30 bg-[#262626] p-4 text-[#f2f2f0]">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#f2f2f0]">
        Planetary Record Unlocked:
      </span>
      <p className="font-sans text-sm text-[#f2f2f0]/90">
        {fact}
      </p>
    </div>
  );
}

interface MatchState {
  roundIdx: number;
  userFreq: number;
  userQ: number;
  isPlayingTarget: boolean;
  isPlayingUser: boolean;
  isLocked: boolean;
  totalScore: number;
  gameFinished: boolean;
}

type MatchAction =
  | { type: "SET_FREQ"; val: number }
  | { type: "SET_Q"; val: number }
  | { type: "SET_PLAYING_TARGET"; val: boolean }
  | { type: "SET_PLAYING_USER"; val: boolean }
  | { type: "LOCK_SIGNAL"; scoreGain: number }
  | { type: "NEXT_ROUND" }
  | { type: "FINISH_GAME" }
  | { type: "RESTART" };

const INITIAL_STATE: MatchState = {
  roundIdx: 0,
  userFreq: 250,
  userQ: 2.0,
  isPlayingTarget: false,
  isPlayingUser: false,
  isLocked: false,
  totalScore: 0,
  gameFinished: false,
};

function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case "SET_FREQ":
      return { ...state, userFreq: action.val };
    case "SET_Q":
      return { ...state, userQ: action.val };
    case "SET_PLAYING_TARGET":
      return { ...state, isPlayingTarget: action.val };
    case "SET_PLAYING_USER":
      return { ...state, isPlayingUser: action.val };
    case "LOCK_SIGNAL":
      return { ...state, isLocked: true, isPlayingUser: false, totalScore: state.totalScore + action.scoreGain };
    case "NEXT_ROUND":
      return { ...state, roundIdx: state.roundIdx + 1, userFreq: 250, userQ: 2.0, isLocked: false };
    case "FINISH_GAME":
      return { ...state, gameFinished: true };
    case "RESTART":
      return INITIAL_STATE;
    default:
      return state;
  }
}

export function SignalMatchGame() {
  const [state, dispatch] = useReducer(matchReducer, INITIAL_STATE);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);

  const round = MATCH_ROUNDS[state.roundIdx];
  const coherence = getCoherence(state.userFreq, state.userQ, round.targetFreq, round.targetQ);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const stopUserSynth = useCallback(() => {
    if (oscRef.current) {
      try {
        oscRef.current.stop();
        oscRef.current.disconnect();
      } catch {
        // stopped
      }
      oscRef.current = null;
    }
    dispatch({ type: "SET_PLAYING_USER", val: false });
  }, []);

  const startUserSynth = useCallback(() => {
    const ctx = getAudioContext();
    stopUserSynth();

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(state.userFreq, ctx.currentTime);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(state.userFreq, ctx.currentTime);
    filter.Q.setValueAtTime(state.userQ, ctx.currentTime);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    oscRef.current = osc;
    filterRef.current = filter;
    dispatch({ type: "SET_PLAYING_USER", val: true });
  }, [getAudioContext, stopUserSynth, state.userFreq, state.userQ]);

  useEffect(() => {
    if (oscRef.current && filterRef.current && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      oscRef.current.frequency.setTargetAtTime(state.userFreq, ctx.currentTime, 0.03);
      filterRef.current.frequency.setTargetAtTime(state.userFreq, ctx.currentTime, 0.03);
      filterRef.current.Q.setTargetAtTime(state.userQ, ctx.currentTime, 0.03);
    }
  }, [state.userFreq, state.userQ]);

  useEffect(() => {
    return () => {
      stopUserSynth();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopUserSynth]);

  const playTargetTone = () => {
    const ctx = getAudioContext();
    stopUserSynth();
    dispatch({ type: "SET_PLAYING_TARGET", val: true });
    playToneSnippet(ctx, round.targetFreq, round.targetQ);
    setTimeout(() => dispatch({ type: "SET_PLAYING_TARGET", val: false }), 1800);
  };

  const handleLockSignal = () => {
    if (coherence >= 88) {
      stopUserSynth();
      playSuccessChime(getAudioContext());
      dispatch({ type: "LOCK_SIGNAL", scoreGain: coherence * 10 });
    }
  };

  const handleNextRound = () => {
    if (state.roundIdx < MATCH_ROUNDS.length - 1) {
      dispatch({ type: "NEXT_ROUND" });
    } else {
      dispatch({ type: "FINISH_GAME" });
    }
  };

  if (state.gameFinished) {
    return <GameCompleteView totalScore={state.totalScore} onRestart={() => dispatch({ type: "RESTART" })} />;
  }

  return (
    <PlayFrame
      title={`Challenge 03 · Wave Match (${round.roundNumber}/3)`}
      toolbar={
        <div className="flex items-center gap-3 font-mono text-xs text-[#f2f2f0]/70">
          <span>Score: <strong className="text-[#f2f2f0]">{state.totalScore}</strong></span>
          <span>·</span>
          <span>Round {round.roundNumber} of 3</span>
        </div>
      }
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-6 py-4">
        <AnomalyBriefCard
          round={round}
          isPlayingTarget={state.isPlayingTarget}
          onPlayTarget={playTargetTone}
        />

        <AudioMeter
          coherence={coherence}
          isActive={state.isPlayingUser || state.isPlayingTarget}
        />

        <TuningDials
          userFreq={state.userFreq}
          userQ={state.userQ}
          onFreqChange={(val) => dispatch({ type: "SET_FREQ", val })}
          onQChange={(val) => dispatch({ type: "SET_Q", val })}
          isLocked={state.isLocked}
        />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <ToneButton
            isPlaying={state.isPlayingUser}
            onToggle={state.isPlayingUser ? stopUserSynth : startUserSynth}
            isLocked={state.isLocked}
          />
          {!state.isLocked ? (
            <UncalibratedButton
              isReady={coherence >= 88}
              onLock={handleLockSignal}
            />
          ) : (
            <CalibratedNextButton
              onNext={handleNextRound}
              hasNext={state.roundIdx < MATCH_ROUNDS.length - 1}
            />
          )}
        </div>

        {state.isLocked ? <FactBanner fact={round.fact} /> : null}
      </div>
    </PlayFrame>
  );
}
