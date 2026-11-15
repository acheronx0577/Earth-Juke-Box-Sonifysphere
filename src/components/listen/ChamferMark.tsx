"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { chamferPoints, type ChamferSides } from "@/components/listen/chamfer";

const STROKE = 1.5;

interface Frame {
  w: number;
  h: number;
  cut: number;
  sides: ChamferSides;
}

function readFrame(parent: HTMLElement, phone: boolean): Frame {
  const rect = parent.getBoundingClientRect();
  const w = Math.round(rect.width * 100) / 100;
  const h = Math.round(rect.height * 100) / 100;
  const cut = Number.parseFloat(getComputedStyle(parent).getPropertyValue("--cut")) || 8;
  let sides: ChamferSides = "all";
  if (phone && parent.classList.contains("lv-timeline-track")) sides = "leading";
  else if (phone && parent.classList.contains("lv-date")) sides = "trailing";
  return { w, h, cut, sides };
}

/** SVG stroke that follows the chamfer. The fill stays on the element; this is only the border. */
export function ChamferMark() {
  const ref = useRef<SVGSVGElement>(null);
  const [frame, setFrame] = useState<Frame>({ w: 0, h: 0, cut: 8, sides: "all" });

  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const phoneQuery = window.matchMedia("(max-width: 699px)");
    const read = () => {
      const next = readFrame(parent, phoneQuery.matches);
      setFrame((prev) =>
        prev.w === next.w && prev.h === next.h && prev.cut === next.cut && prev.sides === next.sides ? prev : next,
      );
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(parent);
    phoneQuery.addEventListener("change", read);
    return () => {
      observer.disconnect();
      phoneQuery.removeEventListener("change", read);
    };
  }, []);

  const { w, h, cut, sides } = frame;
  const drawn = w > 1 && h > 1 ? chamferPoints(w, h, cut, STROKE, sides) : null;
  const points = drawn?.points ?? "";
  let shape = null;
  if (points && drawn?.closed) shape = <polygon points={points} />;
  else if (points) shape = <polyline points={points} />;

  return (
    <svg ref={ref} className="lv-chamfer-svg" aria-hidden="true" viewBox={points ? `0 0 ${w} ${h}` : undefined}>
      {shape}
    </svg>
  );
}
