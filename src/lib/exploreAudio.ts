import type { LayerId, SeasonId, WeatherId } from "@/data/exploreMap";
import { loadTone as loadSharedTone } from "@/lib/toneLoader";
import { playbackAllowed } from "@/lib/playbackGate";
import { getVoiceSettings, volumeDb } from "@/lib/voiceSettings";

export interface ExploreParams {
  readonly layer: LayerId;
  readonly season: SeasonId;
  readonly weather: WeatherId;
  readonly wind: number;
  readonly year: number;
  readonly note: number;
}

type ToneModule = typeof import("tone");

let toneModule: ToneModule | null = null;
let synth: import("tone").Synth | null = null;
let noise: import("tone").Noise | null = null;
let noiseGain: import("tone").Gain | null = null;
let filter: import("tone").Filter | null = null;

async function loadTone(): Promise<ToneModule> {
  toneModule ??= await loadSharedTone();
  return toneModule;
}

function ensureGraph(Tone: ToneModule): void {
  if (synth && noise && noiseGain && filter) return;
  synth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.16, sustain: 0.04, release: 0.18 },
  }).toDestination();
  synth.volume.value = -14;
  filter = new Tone.Filter({ frequency: 1400, type: "lowpass" }).toDestination();
  noiseGain = new Tone.Gain(0).connect(filter);
  noise = new Tone.Noise("pink");
  noise.connect(noiseGain);
  noise.start();
}

export async function triggerExploreNote(params: ExploreParams): Promise<boolean> {
  if (!playbackAllowed()) return false;
  try {
    const Tone = await loadTone();
    if (!playbackAllowed()) return false;
    await Tone.start();
    if (!playbackAllowed()) return false;
    ensureGraph(Tone);
    if (!synth || !noise || !noiseGain || !filter) return false;

    const seasonShift: Record<SeasonId, number> = { spring: 0, summer: 36, fall: -12, winter: -48 };
    const weatherShift: Record<WeatherId, number> = { clear: 0, rain: -8, storm: -28, heat: 64 };
    const freq = Math.max(90, params.note + (params.year - 1958) * 1.05 + seasonShift[params.season] + weatherShift[params.weather]);
    const layerShift: Record<typeof params.layer, number> = {
      temperature: 0,
      co2: 48,
      methane: -36,
      "sea-ice": -24,
    };
    synth.volume.value = volumeDb(getVoiceSettings().voices.pitch.volume);
    synth.oscillator.type = params.layer === "methane" || params.layer === "sea-ice" ? "triangle" : "sine";
    const duration = params.weather === "storm" ? 0.05 : params.weather === "rain" ? 0.1 : 0.18;
    const heard = Math.max(90, freq + layerShift[params.layer]);
    synth.triggerAttackRelease(heard, duration);

    const windAmount = params.wind / 100;
    const weatherGain: Record<WeatherId, number> = { clear: 0.04, rain: 0.12, storm: 0.2, heat: 0.05 };
    noiseGain.gain.rampTo(windAmount * weatherGain[params.weather], 0.05);
    const cutoff = params.weather === "storm" ? 480 : params.weather === "heat" ? 4200 : 1200 + params.wind * 14;
    filter.frequency.rampTo(cutoff, 0.05);
    const nextType = params.weather === "storm" ? "brown" : params.weather === "clear" ? "white" : "pink";
    if (noise.type !== nextType) noise.type = nextType;
    return true;
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    // A blocked gesture is a real failure. Other throws (headless, missing device) must not freeze the quiz.
    return name !== "NotAllowedError" && name !== "SecurityError";
  }
}

export function hushExplore(): void {
  try {
    synth?.triggerRelease();
  } catch {
    // The graph may already be releasing.
  }
  noiseGain?.gain.cancelScheduledValues(0);
  noiseGain?.gain.rampTo(0, 0.02);
}
