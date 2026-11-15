"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const AnimatedTechText = dynamic(
  () => import("@/components/shared/TechText").then((module) => module.TechText),
  { ssr: false },
);

function isIPadOS() {
  return /iPad/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function FooterWordmark() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [animate, setAnimate] = useState(false);
  const [frame, setFrame] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1000px) and (hover: hover) and (pointer: fine)");
    const update = () => setAnimate(media.matches && !isIPadOS());

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      setFrame((current) => {
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        if (current.w === w && current.h === h) return current;
        return { w, h };
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const ready = frame.w > 0 && frame.h > 0;

  return (
    <div ref={frameRef} className="sonify-footer-wordmark">
      {animate && ready ? (
        <AnimatedTechText
          text="sonifysphere"
          className="cursor-target"
          fontFamily="PlanetKosmos"
          fontWeight={400}
          fontSize={Math.round(frame.h * 1.45)}
          letterSpacing={-0.03}
          color="#f2f2f0"
          accentColor="#f2f2f0"
          reveal="letter"
          dashLength={Math.max(2, frame.h * 0.02)}
          dashGap={Math.max(1.5, frame.h * 0.012)}
          strokeWidth={Math.max(1, frame.h * 0.008)}
          specks={15}
          selection={true}
          labels={true}
          draggable={true}
          bounce={0.4}
          clickKick={true}
          intro="none"
          sweep={true}
          speed={0.5}
          guides={false}
          scaleWithSize
          bleedTop={Math.round(frame.h * 1.15)}
          bleedBottom={Math.round(frame.h * 0.55)}
          bleedX={Math.round(frame.w * 0.05)}
        />
      ) : (
        <span className="sonify-footer-wordmark-static" aria-hidden="true">
          sonifysphere
        </span>
      )}
    </div>
  );
}
