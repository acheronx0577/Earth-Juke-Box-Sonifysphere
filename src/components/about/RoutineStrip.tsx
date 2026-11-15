"use client";

import { useEffect, useRef } from "react";
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
    image: "/assets/landing/chapters/chapter-01.webp",
    action: "gml.noaa.gov ↗",
    href: "https://gml.noaa.gov/ccgg/trends/",
    external: true,
  },
  {
    num: "02",
    tag: "Map",
    hud: "ORBITAL SOUND MESH",
    title: "Hear The Map",
    desc: "Click anywhere on the global map to hear latitude and terrain sonification.",
    image: "/assets/about/routine/routine_02_map.webp",
    action: "Explore The Map →",
    href: "/listen",
    external: false,
  },
  {
    num: "03",
    tag: "Play",
    hud: "SYNTH & INTERVAL LAB",
    title: "Challenges",
    desc: "Guess an atmospheric signal, or compose a custom planetary soundscape.",
    image: "/assets/about/routine/routine_03_challenges.webp",
    action: "Open Challenges →",
    href: "/challenge",
    external: false,
  },
  {
    num: "04",
    tag: "Voices",
    hud: "3-VOICE HARMONIC STACK",
    title: "Three Voices",
    desc: "Pitch tracks CO₂ ppm, pulse tracks seasonal breathing, clicks mark all-time highs.",
    image: "/assets/about/routine/routine_04_voices.webp",
    action: "Listen to Voices →",
    href: "/listen",
    external: false,
  },
] as const;

type RoutineBlock = (typeof BLOCKS)[number];

function RoutineCard({ block }: { block: RoutineBlock }) {
  return (
    <div className="routine-block">
      <div className="routine-block-header">
        <div className="routine-block-header-left">
          <span className="routine-num">{block.num}</span>
          <span className="routine-tag">{block.tag}</span>
        </div>
        <div className="routine-block-header-right">
          <span className="routine-hud-pill">{block.hud}</span>
        </div>
      </div>

      <div className="routine-media">
        <div className="routine-media-inner">
          <img
            src={block.image}
            loading="lazy"
            decoding="async"
            alt={block.title}
            className="routine-img"
            draggable={false}
          />
          <div className="routine-media-overlay" />
        </div>
      </div>

      <div className="routine-block-footer">
        <div className="routine-block-meta">
          <h3>{block.title}</h3>
          <p>{block.desc}</p>
        </div>
        {block.external ? (
          <a
            href={block.href}
            target="_blank"
            rel="noopener noreferrer"
            className="routine-btn"
          >
            {block.action}
          </a>
        ) : (
          <Link href={block.href} className="routine-btn">
            {block.action}
          </Link>
        )}
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
      const wrapperWidth = wrapper!.scrollWidth;
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
      end: () => `+=${window.innerHeight * 3.5}px`,
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
