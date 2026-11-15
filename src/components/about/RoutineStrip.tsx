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
    image: "/about/data/data-01-mauna-loa.jpg",
    alt: "White observatory hut and instrument mast on lava above the clouds",
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
    image: "/about/data/data-02-hear-the-map.jpg",
    alt: "Dotted world map with an amber sonar ping over the Atlantic",
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
    image: "/about/data/data-03-challenges.jpg",
    alt: "Scope panel with a waveform, knobs, and a slider",
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
    image: "/about/data/data-04-three-voices.jpg",
    alt: "Three waveform lines on a dark grid",
  },
] as const;

type RoutineBlock = (typeof BLOCKS)[number];

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.15,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function RoutineIcon({ kind }: { kind: RoutineBlock["icon"] }) {
  const paths: Record<RoutineBlock["icon"], ReactNode> = {
    station: (
      <>
        <path d="M5 88h90" />
        <path d="M4 82C16 81 26 68 32 68h6" />
        <path d="M50 68h22C80 68 88 81 96 82" />
        <path d="M18 78q10-3.2 20 0t20 0 18 0" strokeDasharray="2.3 2.5" />
        <path d="M32 68V58h18v10" />
        <path d="M30 58h22" />
        <path d="M37 68v-5h3.4V68" />
        <path d="M42.4 60.4h2.8v2.6h-2.8z" />
        <path d="M60 68V32" />
        <path d="M55.5 48h9M56.6 42h6.8" />
        <path d="M60 44 54 68M60 44l8 24" />
        <path d="M60 34h14" />
        <circle cx="76.2" cy="34" r="2.45" />
        <path d="M60 32v-2.2" />
        <circle cx="57.4" cy="29.4" r="1.45" />
        <circle cx="62.6" cy="29.4" r="1.45" />
      </>
    ),
    sonar: (
      <>
        <circle cx="46" cy="50" r="20" />
        <ellipse cx="46" cy="50" rx="20" ry="6.6" />
        <ellipse cx="46" cy="50" rx="7.4" ry="20" />
        <path d="M32 40c2-6 6-8 10-4 3 3 2 8-1 11" />
        <path d="M48 36c5-2 10 1 11 6 1 5 4 8 8 8" />
        <path d="M46 30v3.2M46 66.8V70M26 50h3.2M62.8 50H66" />
        <circle cx="62" cy="46" r="1.7" />
        <path d="M62 34.5a11.5 11.5 0 0 1 11.5 11.5 11.5 11.5 0 0 1-11.5 11.5" strokeDasharray="1.7 2.3" />
        <path d="M62 26a20 20 0 0 1 20 20 20 20 0 0 1-20 20" strokeDasharray="1.7 2.6" />
        <path d="M62 17.5a28.5 28.5 0 0 1 28.5 28.5 28.5 28.5 0 0 1-28.5 28.5" strokeDasharray="1.7 3" />
      </>
    ),
    scope: (
      <>
        <path d="M22 18h52l8 8v48l-8 8H22l-8-8V26z" />
        <path d="M26 26h44l4 4v28l-4 4H26l-4-4V30z" />
        <path d="M22 48h6M68 48h6M48 26v5M48 57v5" />
        <path d="M24 44h4M32 44h4M40 44h4M56 44h4M64 44h4" />
        <path d="M48 30v4M48 52v4M30 48h4M62 48h4" />
        <path d="M24 50h6c3 0 4-16 9-16s6 20 11 14 5-16 10-10 4 8 12 8" />
        <circle cx="30" cy="74" r="3.4" />
        <circle cx="42" cy="74" r="3.4" />
        <path d="M52 74h22" />
        <circle cx="64" cy="74" r="2.3" />
      </>
    ),
    waves: (
      <>
        <path d="M12 36c6 0 8-14 16-14s8 18 16 12 8-16 16-8 8 10 16 6" />
        <path d="M12 54c10 0 12-10 22-10s12 10 22 10 12-10 22-8" />
        <path d="M12 72h12l3.2-12L30.4 72H44l3-8 3 8h14l3.2-13L67.4 72H82l2.6-7 2.6 7H90" />
      </>
    ),
  };

  return (
    <div className="routine-icon" aria-hidden="true">
      <svg viewBox="0 0 100 100" {...stroke}>
        {paths[kind]}
      </svg>
    </div>
  );
}

void RoutineIcon;

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
      <div className="routine-media">
        <img
          src={block.image}
          alt={block.alt}
          className="routine-img"
          data-slot={block.icon}
          draggable={false}
        />
      </div>
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
      end: () => {
        const slider = sliderContainer!.offsetWidth || 1;
        const spans = Math.abs(calculateMaxTranslate()) / slider;
        const screens = Math.max((5 * 4) / 6, spans * 2.4);
        return `+=${window.innerHeight * screens}px`;
      },
      pin: true,
      pinSpacing: true,
      scrub: 1,
      anticipatePin: 0,
      invalidateOnRefresh: true,
      onUpdate: (self) => place(self.progress),
      onRefresh: (self) => place(self.progress),
    });

    const onResize = () => {
      trigger.refresh();
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    // A flick's leftover momentum was sliding from this pin straight through the registry.
    let hold = false;
    const sectionVisible = () => {
      const rect = section.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    };
    const onTouchStart = () => {
      hold = false;
    };
    const onTouchEnd = () => {
      if (!sectionVisible()) return;
      const y = window.scrollY;
      const until = performance.now() + 1400;
      hold = true;
      const tick = () => {
        if (!hold) return;
        if (Math.abs(window.scrollY - y) > 0.5) window.scrollTo(0, y);
        if (performance.now() < until) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      hold = false;
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
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
