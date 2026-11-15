"use client";

import { useEffect, useRef } from "react";
import type { InstrumentId, SoundStyle, VariationId } from "@/components/listen/v4/model";
import { onPlaybackStopped, playbackAllowed } from "@/lib/playbackGate";

export interface HearingParams {
  readonly style: SoundStyle;
  readonly instrument: InstrumentId;
  readonly variation: VariationId;
  readonly volume: number;
  readonly tempo: number;
  readonly value: number | null;
}

type Voice = {
  triggerAttackRelease: (note: number | string, duration: number | string, time?: number) => void;
  dispose: () => void;
  volume: { value: number };
};

let voice: Voice | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let latest: HearingParams | null = null;
let playing = false;

function frequency(params: HearingParams): number {
  const base = params.variation === "deep" ? 98 : params.variation === "bright" ? 294 : 196;
  const span = params.variation === "deep" ? 180 : params.variation === "bright" ? 520 : 320;
  if (params.value === null) return base;
  return base + params.value * span;
}

function duration(params: HearingParams): string {
  if (params.instrument === "woodblock") return "32n";
  if (params.instrument === "marimba") return "16n";
  if (params.variation === "soft") return "8n";
  return "16n";
}

function decibels(volume: number): number {
  if (volume <= 0) return -Infinity;
  return -32 + (volume / 100) * 26;
}

async function buildVoice(params: HearingParams): Promise<Voice | null> {
  const Tone = await import("tone");
  await Tone.start();
  if (!playbackAllowed()) return null;
  if (params.style === "orchestra" || params.instrument === "strings") {
    const sampler = new Tone.Sampler({
      C3: "/audio/orchestra/strings-C3.mp3",
      G3: "/audio/orchestra/strings-G3.mp3",
      C4: "/audio/orchestra/strings-C4.mp3",
      G4: "/audio/orchestra/strings-G4.mp3",
      C5: "/audio/orchestra/strings-C5.mp3",
    }).toDestination();
    await Tone.loaded();
    return sampler;
  }
  if (params.instrument === "marimba") {
    return new Tone.FMSynth({
      harmonicity: 3.2,
      modulationIndex: 4,
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.25, sustain: 0.02, release: 0.2 },
      modulation: { type: "square" },
      modulationEnvelope: { attack: 0.01, decay: 0.12, sustain: 0, release: 0.1 },
    }).toDestination();
  }
  if (params.instrument === "woodblock") {
    return new Tone.MembraneSynth({
      pitchDecay: 0.01,
      octaves: 2,
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
    }).toDestination();
  }
  const synth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.02, decay: 0.12, sustain: 0.2, release: 0.25 },
  }).toDestination();
  const filter = new Tone.Filter(params.variation === "bright" ? 3200 : params.variation === "deep" ? 420 : 1100, "lowpass").toDestination();
  synth.disconnect();
  synth.connect(filter);
  return synth;
}

function publish(params: HearingParams | null) {
  if (!params || !playing) {
    delete document.documentElement.dataset.listenHearing;
    return;
  }
  document.documentElement.dataset.listenHearing = [
    params.style,
    params.instrument,
    params.variation,
    Math.round(frequency(params)),
    Math.round(params.volume),
    params.tempo,
  ].join("|");
}

function strike() {
  const params = latest;
  if (!params || !voice || !playbackAllowed()) return;
  voice.volume.value = decibels(params.volume);
  const note = frequency(params);
  voice.triggerAttackRelease(params.style === "orchestra" || params.instrument === "strings" ? ToneNote(note) : note, duration(params));
  publish(params);
}

function ToneNote(freq: number): string {
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const name = names[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

function clearTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

export function stopProbeAudio(): void {
  playing = false;
  clearTimer();
  try {
    voice?.dispose();
  } catch {
    // Already disposed.
  }
  voice = null;
  publish(null);
}

function armTimer(tempo: number) {
  clearTimer();
  const interval = Math.max(140, Math.round(520 / Math.max(0.5, tempo)));
  timer = setInterval(strike, interval);
}

export async function startProbeAudio(params: HearingParams): Promise<boolean> {
  latest = params;
  if (!playbackAllowed()) return false;
  stopProbeAudio();
  playing = true;
  latest = params;
  try {
    voice = await buildVoice(params);
    if (!voice || !playing || !playbackAllowed()) {
      stopProbeAudio();
      return false;
    }
    strike();
    armTimer(params.tempo);
    return true;
  } catch {
    stopProbeAudio();
    return false;
  }
}

export function updateProbeAudio(params: HearingParams): void {
  const previous = latest;
  latest = params;
  if (!playing) return;
  publish(params);
  if (voice) voice.volume.value = decibels(params.volume);
  if (previous && (previous.instrument !== params.instrument || previous.style !== params.style || previous.variation !== params.variation)) {
    void rebuild(params);
  }
  if (!previous || previous.tempo !== params.tempo) armTimer(params.tempo);
}

async function rebuild(params: HearingParams) {
  const generation = params;
  try {
    const next = await buildVoice(params);
    if (!playing || latest !== generation || !next) {
      next?.dispose();
      return;
    }
    voice?.dispose();
    voice = next;
  } catch {
    // Keep the previous voice if a swap fails.
  }
}

export function useProbeAudioBinding(): void {
  const stopped = useRef(stopProbeAudio);
  useEffect(() => onPlaybackStopped(stopped.current), []);
  useEffect(() => stopProbeAudio, []);
}
