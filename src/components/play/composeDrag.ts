"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { playbackAllowed } from "@/lib/playbackGate";
import { scheduleMix, type MixSlot } from "@/lib/signalTheory";

const HOLD_MS = 340;
const MOUSE_SLOP = 5;
const TOUCH_SLOP = 12;

export type ComposeDrop = {
  readonly slot: MixSlot;
  readonly fromIndex: number | null;
  readonly toIndex: number | null;
  readonly outside: boolean;
};

type Origin = {
  slot: MixSlot;
  fromIndex: number | null;
  label: string;
};

type Pending = Origin & {
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  active: boolean;
  capture: Element | null;
};

export type DragGhost = {
  x: number;
  y: number;
  label: string;
};

let previewSynth: { dispose: () => void } | null = null;

export async function playSlotPreview(slot: MixSlot): Promise<boolean> {
  if (!playbackAllowed()) return false;
  try {
    const note = scheduleMix([slot], 96).notes[0];
    if (!note) return false;
    const Tone = await import("tone");
    if (!playbackAllowed()) return false;
    await Tone.start();
    if (!playbackAllowed()) return false;
    previewSynth?.dispose();
    const synth = new Tone.Synth({
      oscillator: { type: note.oscillator },
      envelope: { attack: 0.008, decay: 0.14, sustain: 0, release: 0.18 },
    }).toDestination();
    synth.volume.value = -10;
    previewSynth = synth;
    synth.triggerAttackRelease(note.frequency, 0.18);
    window.setTimeout(() => {
      if (previewSynth === synth) previewSynth = null;
      synth.dispose();
    }, 700);
    return true;
  } catch {
    return false;
  }
}

function slotIndexAt(x: number, y: number): number | null {
  const hit = document.elementFromPoint(x, y);
  const button = hit instanceof Element ? hit.closest("[data-slot-index]") : null;
  if (!(button instanceof HTMLElement)) return null;
  const index = Number(button.dataset.slotIndex);
  return Number.isInteger(index) ? index : null;
}

export function useComposeDrag(options: {
  slotsRoot: () => HTMLElement | null;
  onDrop: (drop: ComposeDrop) => void;
}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const pending = useRef<Pending | null>(null);
  const holdTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const listeners = useRef(false);
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const live = useRef<{
    move: (event: PointerEvent) => void;
    up: (event: PointerEvent) => void;
    cancel: (event: PointerEvent) => void;
    touch: (event: TouchEvent) => void;
    end: () => void;
  }>({
    move() {},
    up() {},
    cancel() {},
    touch() {},
    end() {},
  });
  const stable = useRef({
    move: (event: PointerEvent) => live.current.move(event),
    up: (event: PointerEvent) => live.current.up(event),
    cancel: (event: PointerEvent) => live.current.cancel(event),
    touch: (event: TouchEvent) => live.current.touch(event),
  });

  const clearHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const detach = () => {
    if (!listeners.current) return;
    listeners.current = false;
    window.removeEventListener("pointermove", stable.current.move);
    window.removeEventListener("pointerup", stable.current.up);
    window.removeEventListener("pointercancel", stable.current.cancel);
    window.removeEventListener("touchmove", stable.current.touch);
  };

  const end = () => {
    clearHold();
    const current = pending.current;
    if (current?.capture?.hasPointerCapture?.(current.pointerId)) {
      try {
        current.capture.releasePointerCapture(current.pointerId);
      } catch {
        // The pointer is already gone.
      }
    }
    pending.current = null;
    detach();
    setGhost(null);
    setOver(null);
  };

  const arm = (x: number, y: number) => {
    const current = pending.current;
    if (!current || current.active) return;
    current.active = true;
    clearHold();
    if (current.capture) {
      try {
        current.capture.setPointerCapture(current.pointerId);
      } catch {
        // Touch capture can fail once the browser owns the gesture.
      }
    }
    const next = slotIndexAt(x, y);
    setOver(next);
    setGhost({ x, y, label: current.label });
  };

  function onPointerMove(event: PointerEvent) {
    const current = pending.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (current.pointerType === "touch") {
      if (!current.active) return;
      const next = slotIndexAt(event.clientX, event.clientY);
      setOver(next);
      setGhost({ x: event.clientX, y: event.clientY, label: current.label });
      return;
    }
    const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
    if (!current.active) {
      if (distance < MOUSE_SLOP) return;
      arm(event.clientX, event.clientY);
    }
    const next = slotIndexAt(event.clientX, event.clientY);
    setOver(next);
    setGhost({ x: event.clientX, y: event.clientY, label: current.label });
  }

  function onTouchMove(event: TouchEvent) {
    const current = pending.current;
    if (!current || current.pointerType !== "touch") return;
    const touch = event.touches[0];
    if (!touch) return;
    if (current.active) {
      event.preventDefault();
      return;
    }
    const dx = touch.clientX - current.startX;
    const dy = touch.clientY - current.startY;
    if (Math.hypot(dx, dy) < TOUCH_SLOP) return;
    if (Math.abs(dy) >= Math.abs(dx)) {
      end();
      return;
    }
    event.preventDefault();
    arm(touch.clientX, touch.clientY);
  }

  function finish(x: number, y: number) {
    const current = pending.current;
    const active = Boolean(current?.active);
    const moved = current ? Math.hypot(x - current.startX, y - current.startY) >= MOUSE_SLOP : false;
    const toIndex = active && moved ? slotIndexAt(x, y) : null;
    const root = optionsRef.current.slotsRoot();
    const box = root?.getBoundingClientRect();
    const outside = active && moved && box ? x < box.left || x > box.right || y < box.top || y > box.bottom : false;
    if (active && moved) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
    end();
    if (!current || !active || !moved) return;
    optionsRef.current.onDrop({
      slot: current.slot,
      fromIndex: current.fromIndex,
      toIndex,
      outside,
    });
  }

  function onPointerUp(event: PointerEvent) {
    const current = pending.current;
    if (!current || event.pointerId !== current.pointerId) return;
    finish(event.clientX, event.clientY);
  }

  function onPointerCancel(event: PointerEvent) {
    const current = pending.current;
    if (!current || event.pointerId !== current.pointerId) return;
    end();
  }

  const start = (event: ReactPointerEvent<HTMLElement>, origin: Origin) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (pending.current) return;
    pending.current = {
      ...origin,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      capture: event.currentTarget,
    };
    if (!listeners.current) {
      listeners.current = true;
      window.addEventListener("pointermove", stable.current.move);
      window.addEventListener("pointerup", stable.current.up);
      window.addEventListener("pointercancel", stable.current.cancel);
      window.addEventListener("touchmove", stable.current.touch, { passive: false });
    }
    if (event.pointerType === "touch") {
      clearHold();
      holdTimer.current = window.setTimeout(() => arm(event.clientX, event.clientY), HOLD_MS);
    }
  };

  live.current.move = onPointerMove;
  live.current.up = onPointerUp;
  live.current.cancel = onPointerCancel;
  live.current.touch = onTouchMove;
  live.current.end = end;

  useEffect(() => () => live.current.end(), []);

  return {
    ghost,
    over,
    dragging: ghost !== null,
    start,
    consumeClick: () => {
      if (!suppressClick.current) return false;
      suppressClick.current = false;
      return true;
    },
  };
}
