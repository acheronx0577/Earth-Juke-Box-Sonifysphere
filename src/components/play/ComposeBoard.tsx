"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { LAYERS, MAP_REGIONS, regionById, type LayerId } from "@/data/exploreMap";
import { playMix, renderMixWav } from "@/lib/signalPlayback";
import { setSignalLive } from "@/lib/signalLive";
import { recordDisplayName } from "@/lib/guessWhy";
import {
  MIX_SLOT_COUNT,
  decodeMix,
  emptyMix,
  encodeMix,
  scheduleMix,
  slotLabel,
  type MixPlan,
  type MixSlot,
} from "@/lib/signalTheory";
import { IconDownload, IconPlay, IconStop } from "@/components/shared/Icons";
import { useSonifyPlayer } from "@/context/SonifyPlayerContext";
import styles from "./compose.module.css";

const LAYER_NOTE: Record<LayerId, number> = {
  temperature: 247,
  "sea-ice": 165,
  co2: 294,
  methane: 220,
};

const SHORT_REGION: Record<string, string> = {
  arctic: "Arctic",
  "north-america": "N. America",
  europe: "Europe",
  asia: "Asia",
  africa: "Africa",
  "south-america": "S. America",
  oceania: "Oceania",
  antarctica: "Antarctica",
  atlantic: "Atlantic",
  pacific: "Pacific",
  indian: "Indian Ocean",
  nino34: "Niño 3.4",
};

const SHORT_LAYER: Record<string, string> = {
  temperature: "Temperature",
  "sea-ice": "Sea ice",
  co2: "CO₂",
  methane: "Methane",
};

const HOW =
  "Pick a place or a record, then a slot. Or pick a slot, then a sound. Empty slots are rests. The left and right arrow keys move a sound, and Delete clears it. Bar height is the base note. Places are the twelve regions. Records are temperature, sea ice, CO₂, and methane. Tempo runs from 60 to 160. Play mix compiles the row, then plays it.";

function sameSlot(left: MixSlot | null, right: MixSlot | null): boolean {
  if (!left || !right) return false;
  return left.source === right.source && left.id === right.id;
}

function shortLabel(slot: MixSlot): string {
  return slot.source === "region" ? (SHORT_REGION[slot.id] ?? slot.id) : (SHORT_LAYER[slot.id] ?? slot.id);
}

function slotNote(slot: MixSlot | null): number | null {
  if (!slot) return null;
  if (slot.source === "region") return regionById(slot.id).note;
  return LAYER_NOTE[slot.id as LayerId] ?? null;
}

function barHeight(note: number | null): number {
  if (note === null) return 0;
  const t = Math.min(1, Math.max(0, (note - 150) / 170));
  return 22 + t * 74;
}

function clip(cut: number) {
  return `polygon(${cut}px 0, calc(100% - ${cut}px) 0, 100% ${cut}px, 100% calc(100% - ${cut}px), calc(100% - ${cut}px) 100%, ${cut}px 100%, 0 calc(100% - ${cut}px), 0 ${cut}px)`;
}

function monotone(points: readonly [number, number][]): string {
  const n = points.length;
  if (n < 2) return "";
  const dx: number[] = [];
  const slope: number[] = [];
  const m = new Array<number>(n).fill(0);
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = points[i + 1][0] - points[i][0] || 1;
    slope[i] = (points[i + 1][1] - points[i][1]) / dx[i];
  }
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  for (let i = 0; i < n - 1; i += 1) {
    if (Math.abs(slope[i]) < 1e-6) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / slope[i];
      const b = m[i + 1] / slope[i];
      const h = a * a + b * b;
      if (h > 9) {
        const t = 3 / Math.sqrt(h);
        m[i] = t * a * slope[i];
        m[i + 1] = t * b * slope[i];
      }
    }
  }
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const c1x = points[i][0] + dx[i] / 3;
    const c1y = points[i][1] + (m[i] * dx[i]) / 3;
    const c2x = points[i + 1][0] - dx[i] / 3;
    const c2y = points[i + 1][1] - (m[i + 1] * dx[i]) / 3;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${points[i + 1][0]} ${points[i + 1][1]}`;
  }
  return d;
}

function sequencePath(heights: readonly number[]): string {
  const width = 800;
  const height = 200;
  const floor = height - 8;
  const points = heights.map((value, index) => {
    const x = ((index + 0.5) / heights.length) * width;
    const y = Math.min(floor, height - (value / 100) * (height - 16));
    return [x, y] as [number, number];
  });
  return monotone(points.map(([x, y]) => [x, Math.min(y, floor)] as [number, number]));
}

function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number, count: number, focusAt: (next: number) => void) {
  let next = index;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % count;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + count) % count;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = count - 1;
  else return;
  event.preventDefault();
  focusAt(next);
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="3" cy="7" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11" cy="3.2" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11" cy="10.8" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.5 6.3 9.4 4M4.5 7.7l4.9 2.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function ComposeBoard({ initialMix }: { readonly initialMix: string | null }) {
  const { pause, soundOn, setSoundEnabled, isSoundOn } = useSonifyPlayer();
  const loaded = useMemo(() => (initialMix ? decodeMix(initialMix) : null), [initialMix]);
  const invalidLink = Boolean(initialMix) && !loaded;
  const [slots, setSlots] = useState<(MixSlot | null)[]>(() => loaded?.slots ?? emptyMix());
  const [bpm, setBpm] = useState(() => loaded?.bpm ?? 96);
  const [armed, setArmed] = useState<MixSlot | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [plan, setPlan] = useState<MixPlan | null>(null);
  const [audio, setAudio] = useState<"idle" | "playing">("idle");
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [soundOff, setSoundOff] = useState(false);
  const [shareNote, setShareNote] = useState("");
  const [editing, setEditing] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [regionCursor, setRegionCursor] = useState(0);
  const [layerCursor, setLayerCursor] = useState(0);
  const [slotCursor, setSlotCursor] = useState(0);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const endTimer = useRef<number | null>(null);
  const regionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const layerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const slotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const infoRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const glowId = `${useId().replace(/:/g, "")}glow`;

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
    if (endTimer.current !== null) window.clearTimeout(endTimer.current);
    setAudio("idle");
    setPlayingIndex(null);
    setSignalLive(false);
  };

  useEffect(() => {
    return () => {
      stopRef.current?.();
      if (endTimer.current !== null) window.clearTimeout(endTimer.current);
      setSignalLive(false);
    };
  }, []);

  useEffect(() => {
    if (!infoOpen) return;
    dialogRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setInfoOpen(false);
      infoRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [infoOpen]);

  const invalidate = () => {
    setPlan(null);
    setRenderError(null);
    setShareNote("");
    setEditing(true);
    stop();
  };

  const retune = (next: number) => {
    setReplaceIndex(null);
    const tempo = Math.min(160, Math.max(60, Math.round(next)));
    setBpm(tempo);
    stop();
    setShareNote("");
    setPlan((current) => (current ? scheduleMix(slots, tempo) : null));
  };

  const place = (index: number, slot: MixSlot) => {
    setSlots((current) => current.map((item, itemIndex) => (itemIndex === index ? slot : item)));
    setSelected(null);
    invalidate();
  };

  const clearSlot = (index: number) => {
    setSlots((current) => current.map((item, itemIndex) => (itemIndex === index ? null : item)));
    invalidate();
  };

  const onPalette = (slot: MixSlot) => {
    setReplaceIndex(null);
    if (selected !== null) {
      place(selected, slot);
      setArmed(null);
      return;
    }
    setArmed((current) => (sameSlot(current, slot) ? null : slot));
  };

  const onSlot = (index: number) => {
    if (armed && slots[index]) {
      if (replaceIndex === index) {
        place(index, armed);
        setArmed(null);
        setReplaceIndex(null);
        return;
      }
      setReplaceIndex(index);
      setSelected(null);
      return;
    }
    setReplaceIndex(null);
    if (armed) {
      place(index, armed);
      setArmed(null);
      return;
    }
    setSelected((current) => (current === index ? null : index));
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= MIX_SLOT_COUNT) return;
    setSlots((current) => {
      const copy = [...current];
      const held = copy[index];
      copy[index] = copy[next] ?? null;
      copy[next] = held ?? null;
      return copy;
    });
    invalidate();
  };

  const clear = () => {
    setReplaceIndex(null);
    setSlots(emptyMix());
    setArmed(null);
    setSelected(null);
    invalidate();
  };

  const filledCount = slots.filter(Boolean).length;
  const filled = filledCount > 0;

  useEffect(() => {
    if (soundOn) {
      setSoundOff(false);
      return;
    }
    stop();
  }, [soundOn]);

  const startPlayback = async (next: MixPlan | null = plan) => {
    if (!next) return;
    setReplaceIndex(null);
    pause();
    stop();
    setSignalLive(true);
    setAudio("playing");
    const halt = await playMix(next, (slotIndex) => setPlayingIndex(slotIndex));
    stopRef.current = halt;
    endTimer.current = window.setTimeout(() => {
      setAudio("idle");
      setPlayingIndex(null);
      setSignalLive(false);
    }, next.duration * 1000);
  };

  const play = async () => {
    const next = scheduleMix(slots, bpm);
    if (next.notes.length === 0) return;
    setPlan(next);
    setEditing(false);
    setRenderError(null);
    if (!isSoundOn()) {
      setSoundOff(true);
      return;
    }
    setSoundOff(false);
    await startPlayback(next);
  };

  const turnSoundOn = () => {
    setSoundEnabled(true);
    setSoundOff(false);
    void startPlayback();
  };

  const download = async () => {
    const next = plan ?? scheduleMix(slots, bpm);
    if (next.notes.length === 0) return;
    setRendering(true);
    setRenderError(null);
    try {
      const blob = await renderMixWav(next);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "earth-mixtape.wav";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      setRenderError("The mix did not render. Play the mix, then download.");
    } finally {
      setRendering(false);
    }
  };

  const share = async () => {
    if (filledCount === 0) return;
    setReplaceIndex(null);
    const mix = encodeMix(slots, bpm);
    const url = `${window.location.origin}/challenge/compose?mix=${encodeURIComponent(mix)}`;
    window.history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied.");
    } catch {
      setShareNote(url);
    }
  };

  const saveImage = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#141414";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#b4b2ae";
    context.font = "600 22px ui-monospace, monospace";
    context.fillText("SONIFYSPHERE · COMPOSE", 72, 140);
    context.fillStyle = "#f2f2f0";
    context.font = "560 72px sans-serif";
    context.fillText("Earth mixtape", 72, 280);
    context.font = "500 28px ui-monospace, monospace";
    context.fillText(`${filledCount} OF 8 SLOTS · ${bpm} BPM`, 72, 360);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "sonifysphere-earth-mixtape.png";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setShareNote("Result image downloaded.");
  };

  const tempoPercent = ((bpm - 60) / 100) * 100;
  const armedLabel = armed ? slotLabel(armed) : "";
  const firstEmpty = slots.findIndex((slot) => slot === null);
  const targetIndex = armed && selected === null ? firstEmpty : selected !== null && !slots[selected] ? selected : firstEmpty;
  const showReady = Boolean(plan) && audio === "idle" && !editing;
  const heights = slots.map((slot) => barHeight(slotNote(slot)));
  const curve = sequencePath(heights);
  const prompt =
    replaceIndex !== null && armed && slots[replaceIndex]
      ? `Click slot ${replaceIndex + 1} again to replace ${slotLabel(slots[replaceIndex])} with ${armedLabel}.`
      : armed
        ? "Now pick a slot."
        : selected !== null
          ? "Now pick a sound."
          : "Choose a sound, then a slot.";

  const squares = (
    <span className={styles.squares} role="group" aria-label={`${filledCount} of 8 slots`}>
      {slots.map((slot, index) => (
        <span key={index} className={styles.square} data-on={slot ? "true" : "false"} />
      ))}
    </span>
  );

  const info = (
    <span className={styles.infoWrap}>
      <button
        ref={infoRef}
        type="button"
        className={`${styles.shell} ${styles.info}`}
        style={{ clipPath: clip(7) }}
        aria-expanded={infoOpen}
        aria-controls="compose-info"
        aria-label="How this challenge works"
        onClick={() => setInfoOpen((open) => !open)}
      >
        <span className={styles.face} style={{ clipPath: clip(7) }}>
          i
        </span>
      </button>
      {infoOpen ? (
        <div ref={dialogRef} id="compose-info" className={styles.popover} style={{ clipPath: clip(12) }} role="dialog" aria-label="How it works" tabIndex={-1}>
          <div className={styles.popoverFace} style={{ clipPath: clip(12) }}>
            <span className={styles.num}>How it works</span>
            <p>{HOW}</p>
          </div>
        </div>
      ) : null}
    </span>
  );

  const sequencer = (showPlace: boolean) => (
    <div className={styles.stage}>
      <div className={styles.slots} data-testid="compose-slots">
        <svg className={styles.curve} viewBox="0 0 800 200" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <filter id={glowId} x="-4%" y="-30%" width="108%" height="160%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          <path className={styles.glow} d={curve} filter={`url(#${glowId})`} />
          <path className={styles.line} d={curve} />
        </svg>
        {slots.map((slot, index) => {
          const full = slot ? slotLabel(slot) : "empty";
          const target = showPlace && !slot && targetIndex === index;
          const name = slot ? shortLabel(slot) : "Rest";
          const playing = audio === "playing" && playingIndex === index;
          return (
            <button
              key={`slot-${index}`}
              type="button"
              ref={(node) => {
                slotRefs.current[index] = node;
              }}
              className={styles.slot}
              data-on={slot ? "true" : "false"}
              aria-label={`Slot ${index + 1}, ${full}`}
              aria-pressed={selected === index}
              tabIndex={slotCursor === index ? 0 : -1}
              onClick={() => {
                setSlotCursor(index);
                onSlot(index);
              }}
              onKeyDown={(event) => {
                if ((event.key === "Delete" || event.key === "Backspace") && slot) {
                  event.preventDefault();
                  clearSlot(index);
                  return;
                }
                if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && slot) {
                  event.preventDefault();
                  const direction = event.key === "ArrowLeft" ? -1 : 1;
                  const next = index + direction;
                  if (next < 0 || next >= MIX_SLOT_COUNT) return;
                  move(index, direction);
                  setSlotCursor(next);
                  slotRefs.current[next]?.focus();
                  return;
                }
                moveFocus(event, index, MIX_SLOT_COUNT, (next) => {
                  setSlotCursor(next);
                  slotRefs.current[next]?.focus();
                });
              }}
            >
              <span className={`${styles.col} sonify-slot${playing ? " is-playing" : ""}`}>
                {slot ? (
                  <span className={styles.bar} data-on="true" data-play={playing ? "true" : "false"} style={{ height: `${heights[index]}%` }} />
                ) : null}
                {target ? (
                  <span className={`${styles.shell} ${styles.place}`} style={{ clipPath: clip(12) }}>
                    <span className={styles.face} style={{ clipPath: clip(12) }}>
                      <span className={styles.placeWord}>Place here</span>
                      <span className={styles.plus}>+</span>
                    </span>
                  </span>
                ) : null}
              </span>
              <span className={styles.meta}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.slotName}>{name}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const soundNote = soundOff ? (
    <div className={styles.banner} role="status">
      <p>Sound is off.</p>
      <button type="button" onClick={turnSoundOn}>
        Turn sound on
      </button>
    </div>
  ) : null;

  return (
    <main id="main-content" tabIndex={-1} className={styles.page} data-result={showReady ? "true" : undefined} data-hide-target-cursor="true">
      <div className={styles.board} data-testid="compose-board" data-audio={audio}>
      <p className={styles.sr} aria-live="polite">
        {prompt}
        {shareNote ? ` ${shareNote}` : ""}
      </p>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.num}>02</span>
          <h1>{showReady ? "Earth mixtape" : "Compose"}</h1>
          {showReady ? null : info}
        </div>
        <div className={styles.scoreSide}>
          <span>
            <b>
              {filledCount}/8
            </b>{" "}
            SLOTS
          </span>
          {squares}
        </div>
      </header>
      {invalidLink ? (
        <p className={styles.banner} role="status">
          That link does not hold a mix. Start with an empty row.
        </p>
      ) : null}
      {showReady ? (
        <section className={styles.result} aria-labelledby="compose-ready">
          <h2 id="compose-ready" className={styles.sr}>
            Mix ready
          </h2>
          <p className={styles.stats}>
            {filledCount} OF 8 SLOTS · {bpm} BPM
          </p>
          {sequencer(true)}
          <div className={styles.resultActions}>
            <button type="button" className={`${styles.shell} ${styles.plain} bg-[#f2f2f0]`} style={{ clipPath: clip(8) }} data-testid="compose-play" onClick={() => void play()}>
              <span className={styles.face} style={{ clipPath: clip(8) }}>
                <IconPlay /> Play
              </span>
            </button>
            <button type="button" className={`${styles.shell} ${styles.plain}`} style={{ clipPath: clip(8) }} disabled={rendering} aria-busy={rendering || undefined} onClick={() => void download()}>
              <span className={styles.face} style={{ clipPath: clip(8) }}>
                <IconDownload /> {rendering ? "Rendering…" : "Download WAV"}
              </span>
            </button>
          </div>
          <div className={styles.links}>
            <button type="button" onClick={() => void share()}>
              Copy link
            </button>
            <button type="button" onClick={() => void saveImage()}>
              Save image
            </button>
            <button type="button" onClick={() => setEditing(true)}>
              Edit mix
            </button>
            <Link href="/challenge/ribbons">Next · Ribbons</Link>
          </div>
          {renderError ? (
            <p className={styles.banner} role="alert">
              {renderError}
            </p>
          ) : null}
          {shareNote ? <p className={styles.note}>{shareNote}</p> : null}
          {soundNote}
        </section>
      ) : (
        <>
          {sequencer(false)}
          <div className={styles.palette} role="group" aria-label="Sounds">
            {MAP_REGIONS.map((region, regionIndex) => {
              const slot = { source: "region", id: region.id } as const;
              const pressed = sameSlot(armed, slot);
              return (
                <button
                  key={region.id}
                  type="button"
                  ref={(node) => {
                    regionRefs.current[regionIndex] = node;
                  }}
                  className={`${styles.shell} ${styles.pill}${pressed ? " bg-[#f2f2f0]" : ""}`}
                  style={{ clipPath: clip(7) }}
                  aria-pressed={pressed}
                  aria-label={region.name}
                  tabIndex={regionCursor === regionIndex ? 0 : -1}
                  onClick={() => {
                    setRegionCursor(regionIndex);
                    onPalette(slot);
                  }}
                  onKeyDown={(event) =>
                    moveFocus(event, regionIndex, MAP_REGIONS.length, (next) => {
                      setRegionCursor(next);
                      regionRefs.current[next]?.focus();
                    })
                  }
                >
                  <span className={styles.face} style={{ clipPath: clip(7) }}>
                    <span className={styles.pitch} style={{ height: Math.max(6, Math.round(((region.note - 150) / 170) * 16)) }} />
                    {SHORT_REGION[region.id] ?? region.name}
                  </span>
                </button>
              );
            })}
            {LAYERS.map((layer, layerIndex) => {
              const slot = { source: "layer", id: layer.id } as const;
              const pressed = sameSlot(armed, slot);
              const note = LAYER_NOTE[layer.id];
              return (
                <button
                  key={layer.id}
                  type="button"
                  ref={(node) => {
                    layerRefs.current[layerIndex] = node;
                  }}
                  className={`${styles.shell} ${styles.pill}${pressed ? " bg-[#f2f2f0]" : ""}`}
                  style={{ clipPath: clip(7) }}
                  aria-pressed={pressed}
                  aria-label={recordDisplayName(layer.id)}
                  tabIndex={layerCursor === layerIndex ? 0 : -1}
                  onClick={() => {
                    setLayerCursor(layerIndex);
                    onPalette(slot);
                  }}
                  onKeyDown={(event) =>
                    moveFocus(event, layerIndex, LAYERS.length, (next) => {
                      setLayerCursor(next);
                      layerRefs.current[next]?.focus();
                    })
                  }
                >
                  <span className={styles.face} style={{ clipPath: clip(7) }}>
                    <span className={styles.pitch} style={{ height: Math.max(6, Math.round(((note - 150) / 170) * 16)) }} />
                    {SHORT_LAYER[layer.id] ?? recordDisplayName(layer.id)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className={styles.dock}>
            <p className={styles.prompt} data-testid="compose-status">
              {prompt}
            </p>
            <label className={styles.tempo}>
              TEMPO
              <input
                aria-label="Tempo"
                type="range"
                min={60}
                max={160}
                step={1}
                value={bpm}
                style={{ ["--wind" as string]: `${tempoPercent}%` }}
                onChange={(event) => retune(Number(event.target.value))}
                onKeyDown={(event) => {
                  if (event.key !== "PageUp" && event.key !== "PageDown") return;
                  event.preventDefault();
                  const delta = event.key === "PageUp" ? 10 : -10;
                  retune(Math.min(160, Math.max(60, bpm + delta)));
                }}
              />
              <span>{bpm} BPM</span>
            </label>
            <button type="button" className={styles.textLink} onClick={clear}>
              Clear
            </button>
            <button type="button" className={styles.iconButton} aria-label="Download WAV" disabled={!filled || rendering} onClick={() => void download()}>
              <IconDownload />
            </button>
            <button type="button" className={styles.iconButton} aria-label="Share link" disabled={!filled} onClick={() => void share()}>
              <ShareIcon />
            </button>
            <div className={styles.play}>
              <button
                type="button"
                className={`${styles.shell} ${styles.plain} bg-[#f2f2f0]`}
                style={{ clipPath: clip(8) }}
                data-testid={audio === "playing" ? "compose-stop" : "compose-play"}
                disabled={audio !== "playing" && !filled}
                onClick={() => {
                  if (audio === "playing") stop();
                  else void play();
                }}
              >
                <span className={styles.face} style={{ clipPath: clip(8) }}>
                  {audio === "playing" ? <IconStop /> : <IconPlay />}
                  {audio === "playing" ? "Stop" : "Play mix"}
                </span>
              </button>
            </div>
          </div>
          {renderError ? (
            <p className={styles.banner} role="alert">
              {renderError}
            </p>
          ) : null}
          {shareNote ? <p className={styles.note}>{shareNote}</p> : null}
          {soundNote}
        </>
      )}
      </div>
    </main>
  );
}
