import samples from "@/data/orchestraSamples.json";
import { loadTone } from "@/lib/toneLoader";
import { onPlaybackStopped, playbackAllowed } from "@/lib/playbackGate";
import { getVoiceSettings, volumeDb, type InstrumentId, type VoiceId } from "@/lib/voiceSettings";

type SampleGroup = "pitch" | "pulse" | "click" | "strings";

const SAMPLE_GROUPS = samples as Record<SampleGroup, Record<string, string>>;

let orchestraReady = false;
let orchestraLoading: Promise<void> | null = null;
let voiceEpoch = 0;

type LiveSynth = {
  volume: { value: number };
  triggerAttackRelease: (note: number, duration: number) => void;
  triggerRelease: () => void;
  dispose: () => void;
};

type LiveSampler = {
  volume: { value: number };
  triggerAttackRelease: (note: string, duration: number) => void;
  releaseAll: () => void;
};

const orchestraSamplers: Partial<Record<SampleGroup, LiveSampler>> = {};
const liveSynths = new Set<LiveSynth>();

/** Cut every voice sample that has already been triggered, the way a mix transport is cancelled. */
export function hushVoices(): void {
  voiceEpoch += 1;
  liveSynths.forEach((synth) => {
    try {
      synth.volume.value = -Infinity;
      synth.triggerRelease();
      synth.dispose();
    } catch {
      // The node may already have been disposed by its own timer.
    }
  });
  liveSynths.clear();
  Object.values(orchestraSamplers).forEach((sampler) => {
    if (!sampler) return;
    try {
      sampler.volume.value = -Infinity;
      sampler.releaseAll();
    } catch {
      // A sampler that failed to load has nothing to release.
    }
  });
}

onPlaybackStopped(hushVoices);

export function isOrchestraReady(): boolean {
  return orchestraReady;
}

export function ensureOrchestra(onProgress?: (ratio: number) => void): Promise<void> {
  if (orchestraReady) {
    onProgress?.(1);
    return Promise.resolve();
  }
  if (orchestraLoading) return orchestraLoading;
  orchestraLoading = (async () => {
    const Tone = await loadTone();
    const files = (Object.keys(SAMPLE_GROUPS) as SampleGroup[]).flatMap((group) => Object.values(SAMPLE_GROUPS[group]));
    let loaded = 0;
    await Promise.all(
      files.map(async (file) => {
        const url = `/audio/orchestra/${file}`;
        await new Promise<void>((resolve, reject) => {
          new Tone.ToneAudioBuffer(
            url,
            () => resolve(),
            () => reject(new Error(`Could not load ${file}`))
          );
        });
        loaded += 1;
        onProgress?.(loaded / files.length);
      })
    );
    await Promise.all(
      (Object.keys(SAMPLE_GROUPS) as SampleGroup[]).map(
        (group) =>
          new Promise<void>((resolve, reject) => {
            orchestraSamplers[group] = new Tone.Sampler({
              urls: SAMPLE_GROUPS[group],
              baseUrl: "/audio/orchestra/",
              onload: () => resolve(),
              onerror: () => reject(new Error(group)),
            }).toDestination();
          })
      )
    );
    orchestraReady = true;
    onProgress?.(1);
  })().catch((error) => {
    orchestraLoading = null;
    throw error;
  });
  return orchestraLoading;
}

const NOTES: Record<VoiceId, readonly number[]> = {
  pitch: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25],
  pulse: [110.0, 130.81, 110.0, 146.83, 110.0, 130.81],
  click: [784.0, 880.0, 988.0, 784.0, 1046.5, 880.0],
};

function markGain(voice: VoiceId, decibels: number, instrument: InstrumentId | "orchestra"): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.sonifyVoice = voice;
  document.documentElement.dataset.sonifyInstrument = instrument;
  document.documentElement.dataset.sonifyGain = decibels.toFixed(2);
}

export async function triggerVoiceSample(voice: VoiceId, step: number): Promise<void> {
  if (!playbackAllowed()) return;
  const epoch = voiceEpoch;
  try {
    const Tone = await loadTone();
    if (epoch !== voiceEpoch || !playbackAllowed()) return;
    await Tone.start();
    if (epoch !== voiceEpoch || !playbackAllowed()) return;
    const settings = getVoiceSettings();
    const setting = settings.voices[voice];
    const freq = NOTES[voice][step % NOTES[voice].length];
    const decibels = volumeDb(setting.volume);
    if (settings.style === "orchestra" && orchestraReady) {
      const note = Tone.Frequency(freq).toNote();
      const sampler = orchestraSamplers[voice];
      if (sampler) {
        sampler.volume.value = decibels;
        sampler.triggerAttackRelease(note, voice === "click" ? 0.4 : 0.7);
      }
      if (voice === "pitch" && orchestraSamplers.strings) {
        orchestraSamplers.strings.volume.value = decibels - 4;
        orchestraSamplers.strings.triggerAttackRelease(note, 0.9);
      }
      markGain(voice, decibels, "orchestra");
      return;
    }
    let synth: LiveSynth;
    let duration = 0.22;

    if (setting.instrument === "marimba") {
      duration = 0.28;
      synth = new Tone.FMSynth({
        harmonicity: 6,
        modulationIndex: 3,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.12 },
        modulation: { type: "square" },
        modulationEnvelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.08 },
      }).toDestination();
    } else if (setting.instrument === "woodblock") {
      duration = 0.05;
      synth = new Tone.Synth({
        oscillator: { type: "square" },
        envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
      }).toDestination();
    } else if (setting.instrument === "strings") {
      duration = 0.45;
      synth = new Tone.Synth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.09, decay: 0.18, sustain: 0.35, release: 0.35 },
      }).toDestination();
    } else {
      synth = new Tone.Synth({
        oscillator: { type: voice === "click" ? "triangle" : "sine" },
        envelope: { attack: 0.015, decay: 0.2, sustain: 0.1, release: 0.25 },
      }).toDestination();
    }

    if (epoch !== voiceEpoch || !playbackAllowed()) {
      synth.dispose();
      return;
    }
    synth.volume.value = decibels;
    liveSynths.add(synth);
    synth.triggerAttackRelease(freq, duration);
    markGain(voice, decibels, setting.instrument);
    window.setTimeout(() => {
      if (!liveSynths.has(synth)) return;
      liveSynths.delete(synth);
      synth.dispose();
    }, 900);
  } catch {
    // WebAudio can stay locked until a gesture, or be missing in headless runs.
  }
}
