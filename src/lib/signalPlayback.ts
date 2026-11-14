import type { ExploreParams } from "@/lib/exploreAudio";
import { hushExplore, triggerExploreNote } from "@/lib/exploreAudio";
import { onPlaybackStopped, playbackAllowed } from "@/lib/playbackGate";
import type { MixNote, MixPlan } from "@/lib/signalTheory";

onPlaybackStopped(() => {
  hushExplore();
  void import("tone").then((Tone) => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
  });
});

const PHRASE_YEARS = [1968, 1988, 2006, 2024] as const;
const PHRASE_GAP_MS = 340;

export function playRegionPhrase(
  params: ExploreParams,
  hooks?: { readonly onError?: () => void; readonly onNote?: (index: number) => void }
): () => void {
  const timers: number[] = [];
  let cancelled = false;
  void triggerExploreNote({ ...params, year: PHRASE_YEARS[0] }).then((ok) => {
    if (cancelled) return;
    if (!ok) hooks?.onError?.();
    else hooks?.onNote?.(0);
  });
  PHRASE_YEARS.slice(1).forEach((year, index) => {
    timers.push(
      window.setTimeout(() => {
        void triggerExploreNote({ ...params, year, wind: params.wind }).then((ok) => {
          if (ok && !cancelled) hooks?.onNote?.(index + 1);
        });
      }, PHRASE_GAP_MS * (index + 1))
    );
  });
  return () => {
    cancelled = true;
    timers.forEach((id) => window.clearTimeout(id));
    hushExplore();
  };
}

export const PHRASE_MS = PHRASE_GAP_MS * (PHRASE_YEARS.length - 1) + 420;

function scheduleNotes(
  transport: { schedule: (callback: (time: number) => void, time: number) => void; start: (time?: number) => void },
  synth: { oscillator: { type: string }; triggerAttackRelease: (frequency: number, duration: number, time: number) => void },
  notes: readonly MixNote[],
  onNote?: (slotIndex: number) => void,
  live = false
): void {
  notes.forEach((note) => {
    transport.schedule((time) => {
      if (!playbackAllowed()) return;
      onNote?.(note.slotIndex);
      synth.oscillator.type = note.oscillator;
      synth.triggerAttackRelease(note.frequency, note.duration, time);
    }, note.time);
  });
  // Tone 15 ignores events scheduled before start(0). A bare start() runs them.
  if (live) transport.start();
  else transport.start(0);
}

export async function playMix(plan: MixPlan, onNote?: (slotIndex: number) => void): Promise<() => void> {
  try {
    const Tone = await import("tone");
    await Tone.start();
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    transport.seconds = 0;
    const synth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.015, decay: 0.12, sustain: 0.18, release: 0.28 },
    }).toDestination();
    synth.volume.value = -8;
    scheduleNotes(transport, synth, plan.notes, onNote, true);
    return () => {
      transport.stop();
      transport.cancel(0);
      synth.dispose();
    };
  } catch {
    return () => undefined;
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  const blockAlign = channels * 2;
  const dataSize = samples * blockAlign;
  const array = new ArrayBuffer(44 + dataSize);
  const view = new DataView(array);
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);
  const channelData = Array.from({ length: channels }, (_, index) => buffer.getChannelData(index));
  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][sampleIndex] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([array], { type: "audio/wav" });
}

export async function renderMixWav(plan: MixPlan): Promise<Blob> {
  const Tone = await import("tone");
  const rendered = await Tone.Offline(({ transport }) => {
    const synth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.015, decay: 0.12, sustain: 0.18, release: 0.28 },
    }).toDestination();
    synth.volume.value = -6;
    scheduleNotes(transport, synth, plan.notes);
  }, Math.max(0.4, plan.duration));
  const audio = rendered.get();
  if (!audio) throw new Error("The offline render returned an empty buffer.");
  return audioBufferToWav(audio);
}
