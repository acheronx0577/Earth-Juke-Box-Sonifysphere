"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { chamferPoints } from "@/components/listen/chamfer";
import styles from "./contact.module.css";

interface ContactFrameProps {
  cut?: number;
  fill?: string;
  stroke?: string;
  className?: string;
  style?: CSSProperties;
  intro?: boolean;
  children?: ReactNode;
}

/** Chamfered frame. The border is the SVG stroke, so it continues through all four corners. */
export function ContactFrame({ cut = 8, fill = "none", stroke = "rgba(255,243,234,0.26)", className, style, intro = false, children }: ContactFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const read = () => {
      const rect = node.getBoundingClientRect();
      const w = Math.round(rect.width * 100) / 100;
      const h = Math.round(rect.height * 100) / 100;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const drawn = size.w > 1 && size.h > 1 ? chamferPoints(size.w, size.h, cut, 1) : null;

  return (
    <div ref={ref} className={className} style={style} data-intro={intro ? "" : undefined}>
      {drawn ? (
        <svg className={styles.frame} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
          <polygon points={drawn.points} fill={fill} stroke={stroke} strokeWidth={1} />
        </svg>
      ) : null}
      <div className={styles.frameBody}>{children}</div>
    </div>
  );
}
