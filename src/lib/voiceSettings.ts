export type VoiceId = "pitch" | "pulse" | "click";
export type InstrumentId = "soft-synth" | "marimba" | "woodblock" | "strings";
export type SoundStyle = "synth" | "orchestra";

export interface VoiceSetting {
  readonly instrument: InstrumentId;
  readonly volume: number;
  readonly tempo: number;
}

export interface VoiceSettings {
  readonly style: SoundStyle;
  readonly voices: Record<VoiceId, VoiceSetting>;
}

export const INSTRUMENTS: readonly { id: InstrumentId; label: string }[] = [
  { id: "soft-synth", label: "Soft synth" },
  { id: "marimba", label: "Marimba" },
  { id: "woodblock", label: "Woodblock" },
  { id: "strings", label: "Strings" },
];

export const VOICE_ROWS: readonly { id: VoiceId; title: string; detail: string }[] = [
  { id: "pitch", title: "Cellos & basses", detail: "the CO₂ note" },
  { id: "pulse", title: "Timpani", detail: "the yearly plant breathing beat" },
  { id: "click", title: "Harp", detail: "record-high plucks" },
];

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  style: "synth",
  voices: {
    pitch: { instrument: "soft-synth", volume: 8, tempo: 6 },
    pulse: { instrument: "marimba", volume: 6, tempo: 6 },
    click: { instrument: "woodblock", volume: 4, tempo: 6 },
  },
};

const STORAGE_KEY = "sonifysphere-voice-settings";

function clampStep(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(10, Math.max(1, Math.round(number)));
}

function isInstrument(value: unknown): value is InstrumentId {
  return INSTRUMENTS.some((item) => item.id === value);
}

export function tempoMultiplier(step: number): number {
  return 0.4 + clampStep(step, 6) * 0.1;
}

export function tempoLabel(step: number): string {
  const value = tempoMultiplier(step);
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${text}×`;
}

export function volumeDb(step: number): number {
  const gain = Math.max(0.05, clampStep(step, 8) / 10);
  return 20 * Math.log10(gain) - 8;
}

export function voiceIntervalMs(step: number, base = 650): number {
  return base / tempoMultiplier(step);
}

let current = DEFAULT_VOICE_SETTINGS;
const listeners = new Set<() => void>();

function readStorage(): VoiceSettings {
  if (typeof window === "undefined") return DEFAULT_VOICE_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VOICE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    const style = parsed.style === "orchestra" ? "orchestra" : "synth";
    const voices = { ...DEFAULT_VOICE_SETTINGS.voices };
    (Object.keys(voices) as VoiceId[]).forEach((id) => {
      const stored = parsed.voices?.[id];
      if (!stored) return;
      voices[id] = {
        instrument: isInstrument(stored.instrument) ? stored.instrument : voices[id].instrument,
        volume: clampStep(stored.volume, voices[id].volume),
        tempo: clampStep(stored.tempo, voices[id].tempo),
      };
    });
    return { style, voices };
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

export function getVoiceSettings(): VoiceSettings {
  return current;
}

export function loadVoiceSettings(): VoiceSettings {
  current = readStorage();
  return current;
}

export function saveVoiceSettings(next: VoiceSettings): void {
  current = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((listener) => listener());
}

export function subscribeVoiceSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
