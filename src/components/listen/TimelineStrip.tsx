"use client";

import { useEffect, useId, useRef, useState } from "react";
import { chamferClip } from "@/components/listen/chamfer";

const START = 1958;
const END = 2026;
const SPAN = END - START;

export type YearPhase = "drag" | "commit";

function yearLabel(year: number): string {
  return year === 2026 ? "SEP 2026" : String(year);
}

function yearFromClientX(clientX: number, rect: DOMRect): number {
  if (rect.width <= 0) return START;
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return START + Math.round(ratio * SPAN);
}

export function TimelineStrip({
  year,
  onYear,
  motionNoteId,
}: Readonly<{
  year: number;
  onYear: (year: number, phase: YearPhase) => void;
  motionNoteId?: string;
}>) {
  const ticks = Array.from({ length: SPAN + 1 }, (_, index) => START + index);
  const progress = ((year - START) / SPAN) * 100;
  const readoutId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(640);
  const pointerActive = useRef(false);
  const ignoreNative = useRef(false);
  const shown = useRef(year);
  shown.current = year;
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const node = trackRef.current;
    if (!node) return;
    const measure = () => setTrackWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const report = (next: number, phase: YearPhase) => {
    const clamped = Math.min(END, Math.max(START, Math.round(next)));
    shown.current = clamped;
    onYear(clamped, phase);
  };

  return (
    <div className="relative h-12 w-full" style={{ clipPath: chamferClip(14), background: "#777777", padding: 1 }}>
      <div className="flex h-full items-center gap-2 px-3" style={{ clipPath: chamferClip(13), background: "#262626" }}>
        <div
          ref={trackRef}
          className="relative h-full min-h-11 flex-1"
          style={focused ? { outline: "1px solid #f2f2f0", outlineOffset: -1 } : undefined}
        >
          <div className="pointer-events-none absolute right-0 bottom-2 left-0 h-px bg-[rgba(242,242,240,0.35)]" />
          {ticks.map((tick) => {
            const narrow = trackWidth < 420;
            const anchor = tick === 1960 || tick === 1990 || tick === 2020;
            const major = narrow ? anchor : tick % 10 === 0;
            const leftRatio = (tick - START) / SPAN;
            const left = `${leftRatio * 100}%`;
            const crowded = !narrow && Math.abs(leftRatio * trackWidth - (progress / 100) * trackWidth) < 20;
            return (
              <span key={tick} className="pointer-events-none">
                <span
                  className="absolute bottom-[7px] w-px bg-[rgba(242,242,240,0.45)]"
                  style={{ left, height: major ? 8 : 4, opacity: major ? 0.8 : 0.45 }}
                />
                {major && !crowded && (
                  <span
                    className={`absolute top-0 font-mono text-[11px] leading-[14px] tracking-[0.3px] text-[rgba(242,242,240,0.6)] ${
                      narrow && tick === 1960 ? "left-0" : narrow && tick === 2020 ? "right-0" : "-translate-x-1/2"
                    }`}
                    style={narrow && (tick === 1960 || tick === 2020) ? undefined : { left }}
                  >
                    {tick}
                  </span>
                )}
              </span>
            );
          })}
          <span className="pointer-events-none absolute bottom-1 h-[16px] w-[7px] -translate-x-1/2" style={{ left: `${progress}%` }}>
            <span className="absolute bottom-[9px] left-[3px] h-[7px] w-px bg-[#f2f2f0]" />
            <span className="absolute bottom-0 left-0 size-[7px] bg-[#f2f2f0]" />
          </span>
          <input
            type="range"
            min={START}
            max={END}
            step={1}
            value={year}
            aria-label="Map year"
            aria-valuemin={START}
            aria-valuemax={END}
            aria-valuenow={year}
            aria-valuetext={yearLabel(year)}
            aria-describedby={motionNoteId ? `${readoutId} ${motionNoteId}` : readoutId}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onPointerDown={(event) => {
              pointerActive.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              report(yearFromClientX(event.clientX, event.currentTarget.getBoundingClientRect()), "drag");
            }}
            onPointerMove={(event) => {
              if (!pointerActive.current) return;
              report(yearFromClientX(event.clientX, event.currentTarget.getBoundingClientRect()), "drag");
            }}
            onPointerUp={(event) => {
              if (!pointerActive.current) return;
              report(yearFromClientX(event.clientX, event.currentTarget.getBoundingClientRect()), "commit");
              pointerActive.current = false;
              ignoreNative.current = true;
            }}
            onPointerCancel={() => {
              pointerActive.current = false;
              ignoreNative.current = true;
            }}
            onChange={(event) => {
              if (pointerActive.current) return;
              if (ignoreNative.current) {
                ignoreNative.current = false;
                return;
              }
              report(Number(event.currentTarget.value), "drag");
            }}
            onKeyUp={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "ArrowUp" && event.key !== "ArrowDown" && event.key !== "Home" && event.key !== "End") {
                return;
              }
              report(shown.current, "commit");
            }}
            className="listen-year-slider absolute inset-0 h-full w-full cursor-pointer touch-none opacity-0"
          />
        </div>
        <p id={readoutId} className="m-0 w-[72px] shrink-0 text-right font-mono text-[13px] tracking-[0.52px] text-[#f2f2f0]">
          {yearLabel(year)}
        </p>
      </div>
    </div>
  );
}
