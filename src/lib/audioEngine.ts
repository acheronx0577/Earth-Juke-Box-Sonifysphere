import * as Tone from "tone";
import type { ThemeId } from "@/data/landingData";

export interface SonifyAudioStatus {
  ready: boolean;
  sampleRate: number;
  activeTheme: ThemeId;
}

export function getAudioEngineStatus(activeTheme: ThemeId = "co2"): SonifyAudioStatus {
  const ctx = Tone.getContext();
  return {
    ready: ctx.state === "running",
    sampleRate: ctx.sampleRate,
    activeTheme,
  };
}
