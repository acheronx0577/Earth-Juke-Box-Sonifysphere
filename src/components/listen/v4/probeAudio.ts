"use client";

import { useEffect } from "react";
import * as Tone from "tone";
import type { InstrumentId, LayerId, PitchMode, SoundStyle, VariationId } from "@/components/listen/v4/model";
import { frequencyForValue, layerTimbreFor } from "@/components/listen/v4/audioMapping";
import { onPlaybackStopped, playbackAllowed } from "@/lib/playbackGate";
import type { ProximityMix } from "@/components/listen/v4/proximityAudio";
import { continuousTexture } from "@/components/listen/v4/continuousTexture";

export interface HearingParams {
  readonly style: SoundStyle;
  readonly instrument: InstrumentId;
  readonly variation: VariationId;
  readonly pitchMode: PitchMode;
  readonly ambience: boolean;
  readonly layer: LayerId;
  readonly pan: number;
  readonly proximity?: ProximityMix;
  readonly volume: number;
  readonly tempo: number;
  readonly value: number | null;
}

type AudioRig = {
  readonly voices: Tone.Oscillator[];
  readonly gain: Tone.Gain;
  readonly panner: Tone.Panner;
  readonly filter: Tone.Filter;
  readonly reverb: Tone.Reverb;
  readonly motion: Tone.Tremolo;
  dispose: () => void;
};

let rig: AudioRig | null = null;
let latest: HearingParams | null = null;
let playing = false;
let generation = 0;
let voiceRevision = 0;
const retiring = new Set<AudioRig>();

function activeFrequency(params: HearingParams): number | null {
  return frequencyForValue(params.value, params.variation, params.pitchMode);
}

function texture(params: HearingParams) {
  return continuousTexture({
    frequency: activeFrequency(params) ?? 220,
    detail: params.proximity?.detail ?? 0,
    ambience: params.ambience,
    tempo: params.tempo,
    layerCutoff: layerTimbreFor(params.layer).filterHz,
    variation: params.variation,
  });
}

function outputGain(params: HearingParams): number {
  if (activeFrequency(params) === null || params.volume <= 0) return 0;
  // A shared gain also silences the full reverberant tail when data disappears.
  const intensity = 0.7 + 0.3 * Math.max(0, Math.min(1, params.value ?? 0));
  return Tone.dbToGain(-32 + params.volume * 0.26) * (params.proximity?.gain ?? 1) * intensity;
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
    const sound = texture(params);
    const limiter = own(new Tone.Limiter(-2).toDestination());
    const gain = own(new Tone.Gain(0));
    const reverb = own(new Tone.Reverb({ decay: 2.8, preDelay: 0.025, wet: sound.reverb }));
    const panner = own(new Tone.Panner(Math.max(-1, Math.min(1, params.pan))));
    const filter = own(new Tone.Filter(sound.cutoff, "lowpass", -24));
    const motion = own(new Tone.Tremolo({ frequency: sound.motionHz, depth: 0.12, wet: 1 }));
    filter.connect(motion);
    motion.connect(panner);
    panner.connect(reverb);
    reverb.connect(gain);
    gain.connect(limiter);

    const strings = params.style === "orchestra" || params.instrument === "strings";
    const partials = strings ? [1, 0.6, 0.35, 0.2, 0.12]
      : params.instrument === "marimba" ? [1, 0.12, 0.38, 0.08, 0.18]
      : params.instrument === "woodblock" ? [1, 0.5, 0.08, 0.22]
      : null;
    const voices = sound.frequencies.map((frequency, index) => {
      const voice = own(new Tone.Oscillator({
        frequency,
        type: partials ? "custom" : index === 0 ? layerTimbreFor(params.layer).oscillator : "triangle",
        ...(partials ? { partials } : {}),
        phase: index * 71,
        detune: strings ? [0, -4, 4, 0][index] : 0,
        volume: -60,
      }));
      voice.connect(filter);
      return voice;
    });
    await reverb.ready;
    motion.start();
    voices.forEach((voice) => voice.start());
    let disposed = false;
    return {
      voices, gain, panner, filter, reverb, motion,
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const node of [...nodes].reverse()) {
          try { node.dispose(); } catch { /* Continue disposing the graph. */ }
        }
      },
    };
  } catch (error) {
    for (const node of [...nodes].reverse()) {
      try { node.dispose(); } catch { /* Continue disposing the graph. */ }
    }
    throw error;
  }
}

function publish(params: HearingParams | null) {
  const frequency = params ? activeFrequency(params) : null;
  if (!params || !playing || frequency === null) {
    delete document.documentElement.dataset.listenHearing;
    delete document.documentElement.dataset.listenTexture;
    return;
  }
  document.documentElement.dataset.listenHearing = [
    params.style, params.instrument, params.variation, Math.round(frequency),
    Math.round(params.volume), params.tempo, params.layer, params.pitchMode,
    params.ambience ? "ambience" : "dry", params.pan.toFixed(2),
    (params.proximity?.detail ?? 0).toFixed(2), (params.proximity?.gain ?? 1).toFixed(2),
  ].join("|");
  document.documentElement.dataset.listenTexture = "continuous";
}

function applyRigParams(target: AudioRig, params: HearingParams) {
  const sound = texture(params);
  const glide = params.pitchMode === "continuous" ? 0.3 : 0.15;
  target.gain.gain.rampTo(outputGain(params), 0.16);
  target.panner.pan.rampTo(Math.max(-1, Math.min(1, params.pan)), 0.2);
  target.filter.frequency.rampTo(sound.cutoff, 0.35);
  target.reverb.wet.rampTo(sound.reverb, 0.35);
  target.motion.frequency.rampTo(sound.motionHz, 0.5);
  target.voices.forEach((voice, index) => {
    voice.frequency.rampTo(sound.frequencies[index], glide);
    voice.volume.rampTo(sound.levels[index], 0.4);
  });
}

function sameVoiceConfig(a: HearingParams, b: HearingParams): boolean {
  return a.instrument === b.instrument && a.style === b.style && a.layer === b.layer;
}

export function stopProbeAudio(): void {
  generation += 1;
  voiceRevision += 1;
  playing = false;
  rig?.dispose();
  rig = null;
  for (const previous of retiring) previous.dispose();
  retiring.clear();
  publish(null);
}

export async function startProbeAudio(params: HearingParams): Promise<boolean> {
  if (activeFrequency(params) === null || !playbackAllowed()) return false;
  stopProbeAudio();
  const ticket = generation;
  playing = true;
  latest = params;
  try {
    const next = await buildVoice(params);
    if (ticket !== generation || !playing || !playbackAllowed() || !next) {
      next?.dispose();
      return false;
    }
    rig = next;
    applyRigParams(rig, latest ?? params);
    publish(latest);
    if (latest && !sameVoiceConfig(params, latest)) void rebuild(latest);
    return true;
  } catch {
    if (ticket === generation) stopProbeAudio();
    return false;
  }
}

export function updateProbeAudio(params: HearingParams): void {
  const previous = latest;
  latest = params;
  if (!playing) return;
  if (rig) applyRigParams(rig, params);
  publish(params);
  if (previous && !sameVoiceConfig(previous, params)) void rebuild(params);
}

async function rebuild(params: HearingParams) {
  const ticket = generation;
  const revision = ++voiceRevision;
  try {
    const next = await buildVoice(params);
    if (ticket !== generation || revision !== voiceRevision || !playing || !latest || !next || !sameVoiceConfig(params, latest)) {
      next?.dispose();
      return;
    }
    const previous = rig;
    rig = next;
    applyRigParams(rig, latest);
    if (previous) {
      retiring.add(previous);
      previous.gain.gain.rampTo(0, 0.2);
      setTimeout(() => {
        previous.dispose();
        retiring.delete(previous);
      }, 250);
    }
  } catch {
    // Keep the current continuous graph if an instrument swap fails.
  }
}

export function useProbeAudioBinding(): void {
  useEffect(() => onPlaybackStopped(stopProbeAudio), []);
  useEffect(() => stopProbeAudio, []);
}
