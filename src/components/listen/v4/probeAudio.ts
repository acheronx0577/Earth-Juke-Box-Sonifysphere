"use client";

import { useEffect, useRef } from "react";
import * as Tone from "tone";
import type { InstrumentId, SoundStyle, VariationId } from "@/components/listen/v4/model";
import { frequencyForValue, intervalForTempo, noteNameForFrequency } from "@/components/listen/v4/audioMapping";
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
let toneNow: (() => number) | null = null;
let lastStart = 0;

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
  toneNow = () => Tone.now();
  await Tone.start();
  await Tone.context.resume();
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
  const frequency = params ? frequencyForValue(params.value, params.variation) : null;
  if (!params || !playing || frequency === null) {
    delete document.documentElement.dataset.listenHearing;
    return;
  }
  document.documentElement.dataset.listenHearing = [
    params.style,
    params.instrument,
    params.variation,
    Math.round(frequency),
    Math.round(params.volume),
    params.tempo,
  ].join("|");
}

function strike() {
  const params = latest;
  if (!params || !voice || !playbackAllowed()) return;
  const frequency = frequencyForValue(params.value, params.variation);
  if (frequency === null) {
    voice.volume.value = -Infinity;
    publish(params);
    return;
  }
  voice.volume.value = decibels(params.volume);
  const now = Math.max(toneNow?.() ?? 0, lastStart + 0.05);
  lastStart = now;
  voice.triggerAttackRelease(params.style === "orchestra" || params.instrument === "strings" ? noteNameForFrequency(frequency) : frequency, duration(params), now);
  publish(params);
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
  timer = setInterval(strike, intervalForTempo(tempo));
}

export async function startProbeAudio(params: HearingParams): Promise<boolean> {
  if (frequencyForValue(params.value, params.variation) === null) return false;
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
  if (voice) voice.volume.value = params.value === null ? -Infinity : decibels(params.volume);
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
