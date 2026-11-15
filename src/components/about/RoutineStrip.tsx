"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const BLOCKS = [
  {
    num: "01",
    tag: "Data",
    hud: "NOAA GML · 3,397M ELEV",
    title: "Mauna Loa",
    desc: "Data: NOAA GML Mauna Loa. 315.71 ppm in Mar 1958 to 432.34 ppm in May 2026.",
    action: "gml.noaa.gov ↗",
    href: "https://gml.noaa.gov/ccgg/trends/",
    external: true,
    icon: "station" as const,
  },
  {
    num: "02",
    tag: "Map",
    hud: "ORBITAL SOUND MESH",
    title: "Hear The Map",
    desc: "Click anywhere on the global map to hear latitude and terrain sonification.",
    action: "Explore The Map →",
    href: "/listen",
    external: false,
    icon: "sonar" as const,
  },
  {
    num: "03",
    tag: "Play",
    hud: "SYNTH & INTERVAL LAB",
    title: "Challenges",
    desc: "Guess the Signal, tune the spike, or follow the waveform ribbons.",
    action: "Open Challenges →",
    href: "/challenge",
    external: false,
    icon: "scope" as const,
  },
  {
    num: "04",
    tag: "Voices",
    hud: "3-VOICE HARMONIC STACK",
    title: "Three Voices",
    desc: "Pitch tracks CO₂ ppm, pulse tracks seasonal breathing, clicks mark all-time highs.",
    action: "Listen to Voices →",
    href: "/listen",
    external: false,
    icon: "waves" as const,
  },
] as const;

type RoutineBlock = (typeof BLOCKS)[number];

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function RoutineIcon({ kind }: { kind: RoutineBlock["icon"] }) {
  const paths: Record<RoutineBlock["icon"], ReactNode> = {
    station: (
      <>
        <path d="M10 54h44" />
        <path d="M18 54V34h28v20" />
        <path d="M16 34l16-8 16 8" />
        <path d="M29 54V42h6v12" />
        <path d="M32 26V10" />
        <path d="M32 14h10" />
        <circle cx="42" cy="14" r="2" />
        <path d="M26 18h6" />
        <circle cx="24" cy="18" r="1.6" />
        <path d="M32 10l6 3" />
      </>
    ),
    sonar: (
      <>
        <circle cx="32" cy="32" r="18" />
        <circle cx="32" cy="32" r="11" />
        <circle cx="32" cy="32" r="4" />
        <circle cx="32" cy="32" r="1.2" fill="currentColor" stroke="none" />
        <path d="M32 8v6M32 50v6M8 32h6M50 32h6" />
      </>
    ),
    scope: (
      <>
        <circle cx="32" cy="32" r="18" />
        <path d="M16 36c4-10 8-10 12 0s8 10 12 0 8-10 8-4" />
        <path d="M32 14v4M32 46v4M18 32h3M43 32h3" />
        <circle cx="46" cy="46" r="3" />
      </>
    ),
    waves: (
      <>
        <path d="M8 22c6-8 10-8 16 0s10 8 16 0 10-8 16 0" />
        <path d="M8 32c6-6 10-6 16 0s10 6 16 0 10-6 16 0" />
        <path d="M8 42c6-4 10-4 16 0s10 4 16 0 10-4 16 0" />
        <circle cx="24" cy="32" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="40" cy="32" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="32" cy="42" r="1.3" fill="currentColor" stroke="none" />
      </>
    ),
  };

  return (
    <div className="routine-icon" aria-hidden="true">
      <svg viewBox="0 0 64 64" {...stroke}>
        {paths[kind]}
      </svg>
    </div>
  );
}

function RoutineCard({ block }: { block: RoutineBlock }) {
  const link = block.external ? (
    <a href={block.href} target="_blank" rel="noopener noreferrer" className="routine-btn">
      {block.action}
    </a>
  ) : (
    <Link href={block.href} className="routine-btn">
      {block.action}
    </Link>
  );

  return (
    <div className="routine-block">
      <div className="routine-block-header">
        <p>{block.num}</p>
        <p>{block.tag}</p>
      </div>
      <RoutineIcon kind={block.icon} />
      <div className="routine-block-footer">
        <div className="routine-block-meta">
          <h3>{block.title}</h3>
          <p className="routine-hud">{block.hud}</p>
          <p>{block.desc}</p>
        </div>
        {link}
      </div>
    </div>
  );
}

export function RoutineStrip() {
  const sectionRef = useRef<HTMLElement>(null);
  const sliderWrapperRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    gsap.registerPlugin(ScrollTrigger);

    const section = sectionRef.current;
    const wrapper = sliderWrapperRef.current;
    const progress = progressBarRef.current;
    if (!section || !wrapper || !progress) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const sliderContainer = wrapper.parentElement;
    if (!sliderContainer) return;

    function calculateMaxTranslate() {
      const containerWidth = sliderContainer!.offsetWidth;
      const wrapperWidth = wrapper!.offsetWidth;
      return -(wrapperWidth - containerWidth);
    }

    const place = (amount: number) => {
      const maxTranslateX = calculateMaxTranslate();
      gsap.set(wrapper, { x: amount * maxTranslateX });
      gsap.set(progress, { scaleX: amount });
    };

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: () => `+=${window.innerHeight * (5 * 4) / 6}px`,
      pin: true,
      pinSpacing: true,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => place(self.progress),
      onRefresh: (self) => place(self.progress),
    });

    const onResize = () => {
      trigger.refresh();
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      trigger.kill();
    };
  }, []);

  return (
    <section className="routine" ref={sectionRef} aria-label="The Data and The Map">
      <div className="routine-container">
        <div className="routine-bg" />

        <div className="routine-copy">
          <div className="container">
            <div className="routine-header">
              <h3>The Data</h3>
              <h3>And The Map</h3>
            </div>

            <div className="routine-progress-bar" aria-hidden="true">
              <div className="routine-progress" ref={progressBarRef} />
            </div>

            <div className="routine-slider">
              <div className="routine-slider-wrapper" ref={sliderWrapperRef}>
                {BLOCKS.map((block) => (
                  <RoutineCard key={block.num} block={block} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
