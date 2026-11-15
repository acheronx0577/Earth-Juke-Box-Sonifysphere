"use client";

import { useEffect, useId, useRef, useState } from "react";

interface WakeSliderProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly text: string;
  readonly compact?: boolean;
  readonly onChange: (value: number) => void;
}

const BARS = 32;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wakeAmount(index: number, handle: number): number {
  const delta = index - handle;
  const behind = delta < 0 ? 1.6 : 1;
  const dist = Math.abs(delta) / behind;
  return Math.exp(-(dist * dist) / 8);
}

export function WakeSlider({ label, value, min, max, step, text, compact = false, onChange }: WakeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [handle, setHandle] = useState(((value - min) / (max - min)) * (BARS - 1));
  const [reduced, setReduced] = useState(false);
  const labelId = useId();
  const full = compact ? 28 : 40;
  const rest = compact ? 8 : 12;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setHandle(((value - min) / (max - min)) * (BARS - 1));
  }, [value, min, max]);

  const commit = (next: number) => {
    const snapped = Math.round(clamp(next, min, max) / step) * step;
    const precise = Number(clamp(snapped, min, max).toFixed(3));
    onChange(precise);
  };

  const fromClient = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    setHandle(ratio * (BARS - 1));
    commit(min + ratio * (max - min));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const span = max - min;
    const page = span / 10;
    const key = event.key;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(key)) return;
    event.preventDefault();
    if (key === "Home") commit(min);
    else if (key === "End") commit(max);
    else if (key === "PageUp") commit(value + page);
    else if (key === "PageDown") commit(value - page);
    else if (key === "ArrowRight" || key === "ArrowUp") commit(value + step);
    else commit(value - step);
  };

  return (
    <div className={`lv-wake ${compact ? "is-compact" : ""}`}>
      <div
        ref={trackRef}
        className="lv-wake-track"
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={text}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          fromClient(event.clientX);
        }}
        onPointerMove={(event) => {
          if (!dragging) return;
          fromClient(event.clientX);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        {Array.from({ length: BARS }, (_, index) => {
          const lit = index / (BARS - 1) <= (value - min) / (max - min) + 0.0001;
          const rise = dragging && !reduced ? wakeAmount(index, handle) : 0;
          const height = rest + rise * (full - rest);
          return (
            <span
              key={index}
              className={lit ? "is-lit" : ""}
              style={{ height, transition: dragging || reduced ? "none" : "height 180ms ease" }}
            />
          );
        })}
      </div>
      <p className="lv-wake-readout" id={labelId}>
        <span>{label}</span>
        <strong>{text}</strong>
      </p>
    </div>
  );
}
