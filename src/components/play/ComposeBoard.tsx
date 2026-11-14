"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { LAYERS, MAP_REGIONS, type LayerId } from "@/data/exploreMap";
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
import { IconChevron, IconDownload, IconPlay, IconStop, SignalMeter } from "@/components/shared/Icons";
import { ComposeStepper } from "@/components/play/ComposeStepper";
import { CutButton } from "@/components/play/CutControls";
import { PlayFrame } from "@/components/play/PlayFrame";
import { useSonifyPlayer } from "@/context/SonifyPlayerContext";
import { SoundOffNote } from "@/components/shared/SoundOffNote";

const LAYER_NOTE: Record<LayerId, number> = {
  temperature: 247,
  "sea-ice": 165,
  co2: 294,
  methane: 220,
};

function sameSlot(left: MixSlot | null, right: MixSlot | null): boolean {
  if (!left || !right) return false;
  return left.source === right.source && left.id === right.id;
}

function NoteBar({ note }: { readonly note: number }) {
  const height = Math.max(2, Math.round(((note - 150) / 170) * 12) + 2);
  return (
    <span className="sonify-note-bar" aria-hidden="true">
      <i style={{ height }} />
    </span>
  );
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

export function ComposeBoard({ initialMix }: { readonly initialMix: string | null }) {
  const { pause, soundOn, setSoundEnabled, isSoundOn } = useSonifyPlayer();
  const loaded = useMemo(() => (initialMix ? decodeMix(initialMix) : null), [initialMix]);
  const invalidLink = Boolean(initialMix) && !loaded;
  const [slots, setSlots] = useState<(MixSlot | null)[]>(() => loaded?.slots ?? emptyMix());
  const [bpm, setBpm] = useState(() => loaded?.bpm ?? 96);
  const [tempoTouched, setTempoTouched] = useState(() => Boolean(loaded));
  const [armed, setArmed] = useState<MixSlot | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [plan, setPlan] = useState<MixPlan | null>(null);
  const [audio, setAudio] = useState<"idle" | "playing">("idle");
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [soundOff, setSoundOff] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [regionCursor, setRegionCursor] = useState(0);
  const [layerCursor, setLayerCursor] = useState(0);
  const [slotCursor, setSlotCursor] = useState(0);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const endTimer = useRef<number | null>(null);
  const regionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const layerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const slotRefs = useRef<Array<HTMLButtonElement | null>>([]);

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

  const invalidate = () => {
    setPlan(null);
    setRenderError(null);
    setShareUrl("");
    setCopied(false);
    setCopyFailed(false);
    stop();
  };

  const retune = (next: number) => {
    setReplaceIndex(null);
    const tempo = Math.min(160, Math.max(60, Math.round(next)));
    setBpm(tempo);
    setTempoTouched(true);
    stop();
    setShareUrl("");
    setCopied(false);
    setCopyFailed(false);
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

  const compile = () => {
    setReplaceIndex(null);
    const next = scheduleMix(slots, bpm);
    if (next.notes.length === 0) return;
    setPlan(next);
    setRenderError(null);
  };

  useEffect(() => {
    if (soundOn) {
      setSoundOff(false);
      return;
    }
    stop();
  }, [soundOn]);

  const startPlayback = async () => {
    if (!plan) return;
    setReplaceIndex(null);
    pause();
    stop();
    setSignalLive(true);
    setAudio("playing");
    const halt = await playMix(plan, (slotIndex) => setPlayingIndex(slotIndex));
    stopRef.current = halt;
    endTimer.current = window.setTimeout(() => {
      setAudio("idle");
      setPlayingIndex(null);
      setSignalLive(false);
    }, plan.duration * 1000);
  };

  const play = async () => {
    if (!plan) return;
    if (!isSoundOn()) {
      setSoundOff(true);
      return;
    }
    setSoundOff(false);
    await startPlayback();
  };

  const turnSoundOn = () => {
    setSoundEnabled(true);
    setSoundOff(false);
    void startPlayback();
  };

  const download = async () => {
    if (!plan) return;
    setRendering(true);
    setRenderError(null);
    try {
      const blob = await renderMixWav(plan);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "earth-mixtape.wav";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      setRenderError("The mix did not render. Compile again, then download.");
    } finally {
      setRendering(false);
    }
  };

  const share = async () => {
    if (!plan) return;
    setReplaceIndex(null);
    const mix = encodeMix(slots, bpm);
    const url = `${window.location.origin}/challenge/compose?mix=${encodeURIComponent(mix)}`;
    setShareUrl(url);
    window.history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };

  const tempoPercent = ((bpm - 60) / 100) * 100;
  const step: 1 | 2 | 3 | 4 = plan ? 4 : filledCount === 0 ? 1 : tempoTouched ? 3 : 2;
  const armedLabel = armed ? slotLabel(armed) : "";
  const firstEmpty = slots.findIndex((slot) => slot === null);
  const targetIndex = armed ? (selected ?? firstEmpty) : selected;
  const status = (() => {
    if (plan && audio === "playing" && playingIndex !== null) {
      return `Compiled · ${plan.notes.length} notes · ${plan.bpm} bpm · Playing slot ${playingIndex + 1}`;
    }
    if (plan) return `Compiled · ${plan.notes.length} notes · ${plan.bpm} bpm`;
    if (loaded) return "Mix loaded. It stays quiet until you compile and play.";
    if (!filled) return "Fill at least one slot to compile";
    return "Not compiled yet";
  })();

  return (
    <PlayFrame
      title="Compose"
      toolbar={<span className="about-kicker">{filledCount} of 8 slots filled</span>}
    >
      <div className="flex flex-col gap-6" data-testid="compose-board" data-audio={audio}>
        <ComposeStepper step={step} />
        {invalidLink && (
          <p className="sonify-banner" role="status">
            That link does not hold a mix. Start with an empty row.
          </p>
        )}
        <div className="sonify-console">
          <div className="sonify-console-in">
            <section className="sonify-block" aria-labelledby="compose-fill">
              <h2 id="compose-fill">1 · Fill the slots</h2>
              <p className="sonify-help" aria-live="polite">
                {replaceIndex !== null && armed && slots[replaceIndex] ? (
                  <>
                    Click slot {replaceIndex + 1} again to replace {slotLabel(slots[replaceIndex])} with <b>{armedLabel}</b>.
                  </>
                ) : armed ? (
                  <>
                    <b>{armedLabel}</b> is armed. Choose a slot.
                  </>
                ) : (
                  "Choose a sound, then a slot. Or choose a slot, then a sound."
                )}
              </p>
              <div className="sonify-pal-head">
                <span className="about-kicker">Places · 12</span>
                <span className="about-kicker">Bar height = base note</span>
              </div>
              <div className="sonify-palette">
                {MAP_REGIONS.map((region, regionIndex) => {
                  const slot = { source: "region", id: region.id } as const;
                  const pressed = sameSlot(armed, slot);
                  return (
                    <CutButton
                      key={region.id}
                      ref={(node) => {
                        regionRefs.current[regionIndex] = node;
                      }}
                      solid={pressed}
                      aria-pressed={pressed}
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
                      <NoteBar note={region.note} />
                      {region.name}
                    </CutButton>
                  );
                })}
              </div>
              <div className="sonify-pal-head">
                <span className="about-kicker">Records · 4</span>
              </div>
              <div className="sonify-palette">
                {LAYERS.map((layer, layerIndex) => {
                  const slot = { source: "layer", id: layer.id } as const;
                  const pressed = sameSlot(armed, slot);
                  return (
                    <CutButton
                      key={layer.id}
                      ref={(node) => {
                        layerRefs.current[layerIndex] = node;
                      }}
                      solid={pressed}
                      aria-pressed={pressed}
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
                      <NoteBar note={LAYER_NOTE[layer.id]} />
                      {recordDisplayName(layer.id)}
                    </CutButton>
                  );
                })}
              </div>
            </section>

            <section className="sonify-block" aria-labelledby="compose-slots-h">
              <h2 id="compose-slots-h">Your eight slots</h2>
              <p className="sonify-help">One note per slot, played left to right. Empty slots are rests. ← → move a sound.</p>
              <div className="sonify-slots" data-testid="compose-slots" role="list">
                {slots.map((slot, index) => {
                  const label = slot ? slotLabel(slot) : "empty";
                  const target = targetIndex === index && targetIndex >= 0 && !slot;
                  return (
                    <div
                      key={`slot-${index}`}
                      role="listitem"
                      className={`sonify-slot ${slot ? "is-filled" : "is-empty"} ${target ? "is-target" : ""} ${
                        audio === "playing" && playingIndex === index ? "is-playing" : ""
                      }`}
                    >
                      <button
                        type="button"
                        ref={(node) => {
                          slotRefs.current[index] = node;
                        }}
                        className="sonify-slot-hit"
                        aria-label={`Slot ${index + 1}, ${label}`}
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
                          moveFocus(event, index, MIX_SLOT_COUNT, (next) => {
                            setSlotCursor(next);
                            slotRefs.current[next]?.focus();
                          });
                        }}
                      >
                        <span className="about-kicker">{String(index + 1).padStart(2, "0")}</span>
                        <span className="sonify-slot-name">
                          {replaceIndex === index && armed ? `Replace with ${armedLabel}` : slot ? slotLabel(slot) : target ? "Place here" : ""}
                        </span>
                      </button>
                      {slot ? (
                        <div className="sonify-slot-moves">
                          <CutButton
                            aria-label={`Move slot ${index + 1} earlier`}
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                          >
                            <IconChevron direction="left" />
                          </CutButton>
                          <CutButton
                            aria-label={`Move slot ${index + 1} later`}
                            disabled={index === MIX_SLOT_COUNT - 1}
                            onClick={() => move(index, 1)}
                          >
                            <IconChevron direction="right" />
                          </CutButton>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="sonify-block" aria-labelledby="compose-tempo">
              <h2 id="compose-tempo">2 · Set the tempo</h2>
              <div className="sonify-tempo-row">
                <span className="about-kicker">60</span>
                <input
                  aria-label="Tempo"
                  className="listen-wind sonify-tempo"
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
                <span className="sonify-bpm">
                  <b>{bpm}</b> <span className="about-kicker">BPM</span>
                </span>
              </div>
            </section>

            <section className="sonify-block" aria-labelledby="compose-play-h">
              <h2 id="compose-play-h">3 · Compile, then play</h2>
              <div className="sonify-controls">
                <CutButton solid onClick={compile} disabled={!filled} data-testid="compose-compile">
                  Compile
                </CutButton>
                <CutButton onClick={() => void play()} disabled={!plan || audio === "playing"} data-testid="compose-play">
                  <IconPlay />
                  Play
                </CutButton>
                <CutButton onClick={stop} disabled={audio !== "playing"} data-testid="compose-stop">
                  <IconStop />
                  Stop
                </CutButton>
                <CutButton onClick={clear}>Clear</CutButton>
              </div>
              <div className="sonify-live-row">
                <SignalMeter live={audio === "playing"} />
                <p className="about-kicker" data-testid="compose-status" aria-live="polite">
                  {status}
                </p>
              </div>
              {soundOff ? <SoundOffNote onTurnOn={turnSoundOn} /> : null}
            </section>

            <section className="sonify-block sonify-block-last" aria-labelledby="compose-keep">
              <h2 id="compose-keep">4 · Keep it</h2>
              <p className="sonify-help">{plan ? "Download your mix, or copy a link that rebuilds it." : "Compile first to download or share."}</p>
              <div className="sonify-controls">
                <CutButton onClick={() => void download()} disabled={!plan || rendering} aria-busy={rendering || undefined}>
                  <IconDownload />
                  {rendering ? "Rendering…" : "Download WAV"}
                </CutButton>
                <CutButton onClick={() => void share()} disabled={!plan}>
                  Copy share link
                </CutButton>
              </div>
              {renderError && (
                <p className="sonify-alert" role="alert">
                  <span className="sonify-vmark" aria-hidden="true">
                    !
                  </span>
                  {renderError}
                </p>
              )}
              {copyFailed && <p className="sonify-help">Couldn&apos;t copy. Here is the link:</p>}
              {shareUrl && (
                <label className="sonify-share">
                  <span className="about-kicker">{copied ? "Link copied" : "Share link"}</span>
                  <input
                    readOnly
                    data-testid="compose-share-url"
                    value={shareUrl}
                    className="sonify-field w-full min-w-0 px-3 py-3 font-mono text-[12px]"
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </label>
              )}
            </section>
          </div>
        </div>
      </div>
    </PlayFrame>
  );
}
