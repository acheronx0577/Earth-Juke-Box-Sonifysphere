"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { KEELING_AMP_4, KEELING_AMP_8 } from "@/lib/keelingLine";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function HeroCo2Line() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const dotRef = useRef<SVGCircleElement | null>(null);
  const ringRef = useRef<SVGCircleElement | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const path = pathRef.current;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!root || !path || !dot || prefersReducedMotion()) return;

    const tween = gsap.to(path, {
      attr: { d: KEELING_AMP_8.d },
      duration: 6,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      delay: 2.6,
    });
    const dotTween = gsap.to([dot, ring], {
      attr: { cy: KEELING_AMP_8.endY },
      duration: 6,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      delay: 2.6,
    });

    let onScreen = true;
    const sync = () => {
      const hold = document.hidden || !onScreen;
      setPaused(hold);
      if (hold) {
        tween.pause();
        dotTween.pause();
      } else {
        tween.resume();
        dotTween.resume();
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry?.isIntersecting ?? false;
        sync();
      },
      { threshold: 0.15 }
    );
    observer.observe(root);
    document.addEventListener("visibilitychange", sync);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      tween.kill();
      dotTween.kill();
    };
  }, []);

  return (
    <div ref={rootRef} className={`about-co2 ${paused ? "co2-line-paused" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 1440 420" preserveAspectRatio="none" className="block h-full w-full">
        <path
          ref={pathRef}
          className="co2-line-path"
          d={KEELING_AMP_4.d}
          pathLength={1}
          stroke="#f2f2f0"
          strokeOpacity={0.7}
          strokeWidth={1.5}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
        <circle ref={dotRef} cx={KEELING_AMP_4.endX} cy={KEELING_AMP_4.endY} r={4} fill="#f2f2f0" />
        <circle
          ref={ringRef}
          className="co2-end-ring"
          cx={KEELING_AMP_4.endX}
          cy={KEELING_AMP_4.endY}
          r={4}
          fill="none"
          stroke="#f2f2f0"
          strokeOpacity={0.18}
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}
