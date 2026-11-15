"use client";

import { useEffect, useRef } from "react";
import * as Tone from "tone";
import type { InstrumentId, LayerId, PitchMode, SoundStyle, VariationId } from "@/components/listen/v4/model";
import { frequencyForValue, intervalForTempo, layerTimbreFor, noteNameForFrequency } from "@/components/listen/v4/audioMapping";
import { onPlaybackStopped, playbackAllowed } from "@/lib/playbackGate";

export interface HearingParams {
  readonly style: SoundStyle;
  readonly instrument: InstrumentId;
  readonly variation: VariationId;
  readonly pitchMode: PitchMode;
  readonly ambience: boolean;
  readonly layer: LayerId;
  readonly pan: number;
  readonly volume: number;
  readonly tempo: number;
  readonly value: number | null;
}

type Voice = {
  readonly volume: { value: number };
  connect: (destination: Tone.Filter) => unknown;
  triggerAttackRelease: (note: number | string, duration: string, time?: number) => unknown;
  dispose: () => unknown;
};

type AudioRig = {
  readonly voice: Voice;
  readonly panner: Tone.Panner;
  readonly ambient: Tone.Oscillator | null;
  dispose: () => void;
};

let rig: AudioRig | null = null;
let clock: Tone.Clock | null = null;
let latest: HearingParams | null = null;
let playing = false;

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

function activeFrequency(params: HearingParams): number | null {
  return frequencyForValue(params.value, params.variation, params.pitchMode);
}

async function buildVoice(params: HearingParams): Promise<AudioRig | null> {
  await Tone.start();
  await Tone.context.resume();
  if (!playbackAllowed()) return null;

  const nodes: Array<{ dispose: () => unknown }> = [];
  const own = <T extends { dispose: () => unknown }>(node: T): T => {
    nodes.push(node);
    return node;
  };

  try {
    const timbre = layerTimbreFor(params.layer);
    const cutoff = Math.min(
      5200,
      timbre.filterHz * (params.variation === "bright" ? 1.55 : params.variation === "deep" ? 0.55 : 1),
    );
    const limiter = own(new Tone.Limiter(-1).toDestination());
    const reverb = own(new Tone.Reverb({
      decay: params.ambience ? 3.2 : 1.4,
      preDelay: 0.025,
      wet: params.ambience ? 0.24 : 0.09,
    }));
    const panner = own(new Tone.Panner(Math.max(-1, Math.min(1, params.pan))));
    const filter = own(new Tone.Filter(cutoff, "lowpass"));
    filter.connect(panner);
    panner.connect(reverb);
    reverb.connect(limiter);

    let voice: Voice;
    if (params.style === "orchestra" || params.instrument === "strings") {
      voice = own(new Tone.Sampler({
        C3: "/audio/orchestra/strings-C3.mp3",
        G3: "/audio/orchestra/strings-G3.mp3",
        C4: "/audio/orchestra/strings-C4.mp3",
        G4: "/audio/orchestra/strings-G4.mp3",
        C5: "/audio/orchestra/strings-C5.mp3",
      }));
    } else if (params.instrument === "marimba") {
      voice = own(new Tone.FMSynth({
        harmonicity: 3.2,
        modulationIndex: 4,
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.25, sustain: 0.02, release: 0.2 },
        modulation: { type: "square" },
        modulationEnvelope: { attack: 0.01, decay: 0.12, sustain: 0, release: 0.1 },
      }));
    } else if (params.instrument === "woodblock") {
      voice = own(new Tone.MembraneSynth({
        pitchDecay: 0.01,
        octaves: 2,
        oscillator: { type: "square" },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
      }));
    } else {
      voice = own(new Tone.Synth({
        oscillator: { type: timbre.oscillator },
        envelope: {
          attack: params.layer === "sea-ice" ? 0.08 : 0.025,
          decay: 0.14,
          sustain: params.layer === "sea-ice" ? 0.16 : 0.2,
          release: params.layer === "sea-ice" ? 0.42 : 0.25,
        },
      }));
    }

    voice.connect(filter);
    voice.volume.value = decibels(params.volume);

    const frequency = activeFrequency(params) ?? 220;
    let ambient: Tone.Oscillator | null = null;
    if (params.ambience) {
      const ambientFilter = own(new Tone.Filter(520, "lowpass"));
      ambientFilter.connect(panner);
      ambient = own(new Tone.Oscillator({
        frequency: frequency / 4,
        type: "sine",
        volume: params.volume <= 0 ? -Infinity : decibels(params.volume) - 24,
      }));
      ambient.connect(ambientFilter);
    }

    await Promise.all([
      reverb.ready,
      params.style === "orchestra" || params.instrument === "strings" ? Tone.loaded() : Promise.resolve(),
    ]);

    let disposed = false;
    return {
      voice,
      panner,
      ambient,
      dispose() {
        if (disposed) return;
        disposed = true;
        try {
          ambient?.stop();
        } catch {
          // The oscillator may not have started yet.
        }
        for (const node of [...nodes].reverse()) {
          try {
            node.dispose();
          } catch {
            // Continue disposing the remaining audio nodes.
          }
        }
      },
    };
  } catch (error) {
    for (const node of [...nodes].reverse()) {
      try {
        node.dispose();
      } catch {
        // Continue disposing the remaining audio nodes.
      }
    }
    throw error;
  }
}

function publish(params: HearingParams | null) {
  const frequency = params ? activeFrequency(params) : null;
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
    params.layer,
    params.pitchMode,
    params.ambience ? "ambience" : "dry",
    params.pan.toFixed(2),
  ].join("|");
}

function strike(time = Tone.now()) {
  const params = latest;
  if (!params || !rig || !playbackAllowed()) return;
  const frequency = activeFrequency(params);
  if (frequency === null) {
    rig.voice.volume.value = -Infinity;
    if (rig.ambient) rig.ambient.volume.value = -Infinity;
    publish(params);
    return;
  }

  rig.voice.volume.value = decibels(params.volume);
  const note = params.style === "orchestra" || params.instrument === "strings" ? noteNameForFrequency(frequency) : frequency;
  rig.voice.triggerAttackRelease(note, duration(params), time);
  publish(params);
}

function clearClock() {
  try {
    clock?.stop();
    clock?.dispose();
  } catch {
    // Clock already stopped or disposed.
  }
  clock = null;
}

function armClock(tempo: number) {
  clearClock();
  const interval = intervalForTempo(tempo);
  clock = new Tone.Clock((time) => strike(time), 1000 / interval);
  clock.start(Tone.now() + interval / 1000);
}

function sameVoiceConfig(a: HearingParams, b: HearingParams): boolean {
  return a.instrument === b.instrument &&
    a.style === b.style &&
    a.variation === b.variation &&
    a.layer === b.layer &&
    a.ambience === b.ambience;
}

function applyRigParams(target: AudioRig, params: HearingParams) {
  const frequency = activeFrequency(params);
  target.voice.volume.value = frequency === null ? -Infinity : decibels(params.volume);
  target.panner.pan.rampTo(Math.max(-1, Math.min(1, params.pan)), 0.22);
  if (target.ambient) {
    target.ambient.volume.value = frequency === null || params.volume <= 0 ? -Infinity : decibels(params.volume) - 24;
    if (frequency !== null) target.ambient.frequency.rampTo(frequency / 4, 0.35);
  }
}

export function stopProbeAudio(): void {
  playing = false;
  clearClock();
  try {
    rig?.dispose();
  } catch {
    // Already disposed.
  }
  rig = null;
  publish(null);
}

export async function startProbeAudio(params: HearingParams): Promise<boolean> {
  if (activeFrequency(params) === null) return false;
  latest = params;
  if (!playbackAllowed()) return false;
  stopProbeAudio();
  playing = true;
  latest = params;
  try {
    rig = await buildVoice(params);
    if (!rig || !playing || !playbackAllowed()) {
      rig?.dispose();
      stopProbeAudio();
      return false;
    }
    rig.ambient?.start();
    rig.panner.pan.rampTo(Math.max(-1, Math.min(1, params.pan)), 0.18);
    strike(Tone.now() + 0.03);
    armClock(params.tempo);
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
  if (rig) applyRigParams(rig, params);
  if (previous && (
    previous.instrument !== params.instrument ||
    previous.style !== params.style ||
    previous.variation !== params.variation ||
    previous.layer !== params.layer ||
    previous.ambience !== params.ambience
  )) {
    void rebuild(params);
  }
  if (!previous || previous.tempo !== params.tempo) armClock(params.tempo);
}

async function rebuild(params: HearingParams) {
  try {
    const next = await buildVoice(params);
    const current = latest;
    if (!playing || !current || !next || !sameVoiceConfig(params, current)) {
      next?.dispose();
      return;
    }
    const previous = rig;
    rig = next;
    rig.ambient?.start();
    applyRigParams(rig, current);
    previous?.dispose();
  } catch {
    // Keep the previous voice if a swap fails.
  }
}

export function useProbeAudioBinding(): void {
  const stopped = useRef(stopProbeAudio);
  useEffect(() => onPlaybackStopped(stopped.current), []);
  useEffect(() => stopProbeAudio, []);
}
