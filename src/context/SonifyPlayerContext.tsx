"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ThemeId } from "@/data/landingData";
import { getVoiceSettings, loadVoiceSettings, voiceIntervalMs, type VoiceId } from "@/lib/voiceSettings";
import { onPlaybackStopped, playbackAllowed, setPlaybackAllowed } from "@/lib/playbackGate";
import { triggerVoiceSample } from "@/lib/voiceSynth";
import { loadTone, suspendToneIfLoaded } from "@/lib/toneLoader";

export type { VoiceId };

export interface SonifyPlayerContextValue {
  readonly soundOn: boolean;
  readonly isSoundOn: () => boolean;
  readonly playing: boolean;
  readonly muted: boolean;
  readonly activeTheme: ThemeId;
  readonly soloVoice: VoiceId | null;
  readonly currentReadingLabel: string;
  readonly toggleSoundOn: () => void;
  readonly setSoundEnabled: (enabled: boolean) => void;
  readonly togglePlaying: () => void;
  readonly toggleMuted: () => void;
  readonly applyInitialSound: (mode: "on" | "off") => void;
  readonly dismissPlayer: () => void;
  readonly playerDismissed: boolean;
  readonly setActiveTheme: (theme: ThemeId) => void;
  readonly playSoloVoice: (voice: VoiceId) => boolean;
  readonly startEnsemble: () => boolean;
  readonly stopEnsemble: () => void;
  readonly pause: () => void;
  readonly ensembleOn: boolean;
}

const SonifyPlayerContext = createContext<SonifyPlayerContextValue | null>(null);
const SOUND_PREF_KEY = "sonifysphere-sound";

function persistSound(enabled: boolean) {
  try {
    window.localStorage.setItem(SOUND_PREF_KEY, enabled ? "on" : "off");
  } catch {
    // Storage can be blocked. The in-memory flag still applies for this view.
  }
}

function readSoundPref(): boolean | null {
  try {
    const query = new URLSearchParams(window.location.search).get("sound");
    if (query === "off") return false;
    if (query === "on") return true;
    const stored = window.localStorage.getItem(SOUND_PREF_KEY);
    if (stored === "off") return false;
    if (stored === "on") return true;
  } catch {
    return null;
  }
  return null;
}

const THEME_DEFAULT_READING: Record<ThemeId, string> = {
  co2: "1990 · 354 ppm",
  temperature: "1990 · +0.45 °C",
  "sea-ice": "1990 · 6.24 million km²",
  methane: "1990 · 1714 ppb",
};

const SOLO_READING_LABELS: Record<VoiceId, string> = {
  pitch: "SOLO · PITCH = PPM (6S)",
  pulse: "SOLO · PULSE = SEASONS (6S)",
  click: "SOLO · CLICK = RECORDS (6S)",
};

async function unlockToneAudio(): Promise<void> {
  try {
    const Tone = await loadTone();
    await Tone.start();
  } catch {
    // WebAudio not unlocked or unsupported in headless renderer
  }
}

function useSoloVoiceController(onActivateAudio: () => void) {
  const [soloVoice, setSoloVoice] = useState<VoiceId | null>(null);
  const soloTimerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const clearSoloTimers = useCallback(() => {
    if (soloTimerRef.current !== null) {
      window.clearTimeout(soloTimerRef.current);
      soloTimerRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => clearSoloTimers(), [clearSoloTimers]);

  useEffect(
    () =>
      onPlaybackStopped(() => {
        clearSoloTimers();
        setSoloVoice(null);
      }),
    [clearSoloTimers]
  );

  const playSoloVoice = useCallback(
    (voice: VoiceId) => {
      clearSoloTimers();
      onActivateAudio();
      setSoloVoice(voice);
      void unlockToneAudio();

      let step = 0;
      void triggerVoiceSample(voice, step);
      const schedule = () => {
        intervalRef.current = window.setTimeout(() => {
          if (!playbackAllowed()) return;
          step += 1;
          void triggerVoiceSample(voice, step);
          schedule();
        }, voiceIntervalMs(getVoiceSettings().voices[voice].tempo));
      };
      schedule();

      soloTimerRef.current = window.setTimeout(() => {
        clearSoloTimers();
        setSoloVoice(null);
      }, 6000);
    },
    [clearSoloTimers, onActivateAudio]
  );

  const clearSolo = useCallback(() => {
    clearSoloTimers();
    setSoloVoice(null);
  }, [clearSoloTimers]);

  return { soloVoice, playSoloVoice, clearSolo };
}

const ENSEMBLE_VOICES: readonly VoiceId[] = ["pitch", "pulse", "click"];

function triggerEnsembleStep(step: number): void {
  ENSEMBLE_VOICES.forEach((voice, index) => {
    void triggerVoiceSample(voice, step + index);
  });
}

function useEnsemblePlayback(
  playing: boolean,
  soundOn: boolean,
  muted: boolean,
  soloVoice: VoiceId | null,
  onActivateAudio: () => void
) {
  const [ensembleOn, setEnsembleOn] = useState(false);
  const stepRef = useRef(0);

  useEffect(() => {
    if (!ensembleOn || !playing || !soundOn || muted || soloVoice) return;
    const timers = new Set<number>();
    const schedule = (voice: VoiceId, offset: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (!playbackAllowed()) return;
        stepRef.current += 1;
        void triggerVoiceSample(voice, stepRef.current + offset);
        schedule(voice, offset);
      }, voiceIntervalMs(getVoiceSettings().voices[voice].tempo));
      timers.add(timer);
    };
    ENSEMBLE_VOICES.forEach((voice, index) => schedule(voice, index));
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [ensembleOn, playing, soundOn, muted, soloVoice]);

  useEffect(() => onPlaybackStopped(() => setEnsembleOn(false)), []);

  const startEnsemble = useCallback(() => {
    stepRef.current = 0;
    onActivateAudio();
    setEnsembleOn(true);
    void unlockToneAudio().then(() => {
      if (!playbackAllowed()) return;
      triggerEnsembleStep(0);
    });
    return true;
  }, [onActivateAudio]);

  const stopEnsemble = useCallback(() => {
    setEnsembleOn(false);
  }, []);

  return { startEnsemble, stopEnsemble, ensembleOn };
}

function useAudioPlaybackState() {
  const [soundOn, setSoundOn] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const soundNow = useRef(true);

  const applySound = useCallback((enabled: boolean) => {
    soundNow.current = enabled;
    setPlaybackAllowed(enabled);
    setSoundOn(enabled);
    setMuted(!enabled);
    if (!enabled) setPlaying(false);
    persistSound(enabled);
  }, []);

  useEffect(() => {
    const pref = readSoundPref();
    if (pref === null) return;
    // The gate is synchronous so audio already in flight stops on this turn.
    // The React update is a transition so it does not re-suspend a page Next is still streaming.
    soundNow.current = pref;
    setPlaybackAllowed(pref);
    persistSound(pref);
    startTransition(() => {
      setSoundOn((current) => (current === pref ? current : pref));
      setMuted((current) => (current === !pref ? current : !pref));
      if (!pref) setPlaying(false);
    });
  }, []);

  const resumePlayback = useCallback(() => {
    setMuted(false);
    setPlaying(true);
  }, []);

  const toggleSoundOn = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      soundNow.current = next;
      setPlaybackAllowed(next);
      setMuted(!next);
      if (!next) setPlaying(false);
      persistSound(next);
      return next;
    });
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    applySound(enabled);
  }, [applySound]);

  const togglePlaying = useCallback(() => {
    void unlockToneAudio();
    setPlaying((prev) => !prev);
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundNow.current = !next;
      setPlaybackAllowed(!next);
      setSoundOn(!next);
      if (next) setPlaying(false);
      persistSound(!next);
      return next;
    });
  }, []);

  const applyInitialSound = useCallback((mode: "on" | "off") => {
    applySound(mode === "on");
  }, [applySound]);

  const pause = useCallback(() => setPlaying(false), []);
  const isSoundOn = useCallback(() => soundNow.current, []);

  return {
    soundOn,
    playing,
    muted,
    resumePlayback,
    isSoundOn,
    toggleSoundOn,
    setSoundEnabled,
    togglePlaying,
    toggleMuted,
    pause,
    applyInitialSound,
  };
}

export function SonifyPlayerProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [activeTheme, setActiveTheme] = useState<ThemeId>("co2");

  useEffect(() => {
    loadVoiceSettings();
  }, []);
  useEffect(() => onPlaybackStopped(() => {
    void suspendToneIfLoaded();
  }), []);
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) void suspendToneIfLoaded();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);
  const [playerDismissed, setPlayerDismissed] = useState(false);
  const {
    soundOn,
    playing,
    muted,
    resumePlayback,
    isSoundOn,
    toggleSoundOn,
    setSoundEnabled,
    togglePlaying,
    toggleMuted,
    pause,
    applyInitialSound,
  } =
    useAudioPlaybackState();
  const { soloVoice, playSoloVoice, clearSolo } = useSoloVoiceController(resumePlayback);
  const { startEnsemble: armEnsemble, stopEnsemble, ensembleOn } = useEnsemblePlayback(
    playing,
    soundOn,
    muted,
    soloVoice,
    resumePlayback
  );
  const currentReadingLabel = soloVoice
    ? SOLO_READING_LABELS[soloVoice]
    : ensembleOn && playing
      ? "THREE VOICES · PLAYING"
      : THEME_DEFAULT_READING[activeTheme];

  const playSolo = useCallback(
    (voice: VoiceId) => {
      if (!isSoundOn()) return false;
      setPlayerDismissed(false);
      stopEnsemble();
      playSoloVoice(voice);
      return true;
    },
    [isSoundOn, playSoloVoice, stopEnsemble]
  );

  const startEnsemble = useCallback(() => {
    if (!isSoundOn()) return false;
    setPlayerDismissed(false);
    clearSolo();
    return armEnsemble();
  }, [armEnsemble, clearSolo, isSoundOn]);

  const dismissPlayer = useCallback(() => {
    setPlayerDismissed(true);
    pause();
    stopEnsemble();
    clearSolo();
  }, [clearSolo, pause, stopEnsemble]);

  const value = useMemo<SonifyPlayerContextValue>(
    () => ({
      soundOn,
      isSoundOn,
      playing,
      muted,
      activeTheme,
      soloVoice,
      currentReadingLabel,
      toggleSoundOn,
      setSoundEnabled,
      togglePlaying,
      toggleMuted,
      applyInitialSound,
      dismissPlayer,
      playerDismissed,
      setActiveTheme,
      playSoloVoice: playSolo,
      startEnsemble,
      stopEnsemble,
      pause,
      ensembleOn,
    }),
    [
      soundOn,
      isSoundOn,
      playing,
      muted,
      activeTheme,
      soloVoice,
      currentReadingLabel,
      toggleSoundOn,
      setSoundEnabled,
      togglePlaying,
      toggleMuted,
      applyInitialSound,
      dismissPlayer,
      playerDismissed,
      playSolo,
      startEnsemble,
      stopEnsemble,
      pause,
      ensembleOn,
    ]
  );

  return <SonifyPlayerContext.Provider value={value}>{children}</SonifyPlayerContext.Provider>;
}

export function useSonifyPlayer(): SonifyPlayerContextValue {
  const ctx = useContext(SonifyPlayerContext);
  if (!ctx) {
    throw new Error("useSonifyPlayer must be used within SonifyPlayerProvider");
  }
  return ctx;
}
