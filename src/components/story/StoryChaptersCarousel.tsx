"use client";

import { useState, useEffect, useCallback, useRef, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import CircularGallery, { type CircularGalleryRef, type GalleryItem } from "@/components/shared/CircularGallery";
import { RollingText } from "@/components/shared/RollingText";
import CircularText from "@/components/shared/CircularText";

import type { VoiceId } from "@/lib/voiceSettings";

interface ChapterData extends GalleryItem {
  id: string;
  num: string;
  headerTag: string;
  title: string;
  subtitle: string;
  challengePath: string;
  challengeAction: string;
  year: string;
  audioVoice?: VoiceId;
}

const CHAPTERS: ChapterData[] = [
  {
    id: "challenge-01",
    num: "01",
    headerTag: "Challenge 01 · Ear Training",
    year: "Quiz",
    title: "Guess the Signal",
    subtitle: "Listen to sonified planetary records and identify the vital sign",
    challengePath: "/challenge/guess",
    challengeAction: "Play Quiz ↗",
    image: "/assets/landing/chapters/chapter-01.webp",
    text: "01 · Guess the Signal",
    description: "Ear training quiz: identify atmospheric CO₂ signals by ear",
    audioVoice: "pitch",
  },
  {
    id: "challenge-02",
    num: "02",
    headerTag: "Challenge 02 · Sound Studio",
    year: "Mixtape",
    title: "Compose Track",
    subtitle: "Layer 4 planetary signals into a custom atmospheric soundscape",
    challengePath: "/challenge/compose",
    challengeAction: "Open Studio ↗",
    image: "/assets/landing/chapters/chapter-02.webp",
    text: "02 · Compose Track",
    description: "Sound studio: compile an ambient climate mixtape",
    audioVoice: "pulse",
  },
  {
    id: "challenge-03",
    num: "03",
    headerTag: "Challenge 03 · Wave Match",
    year: "Tuning",
    title: "Tune the Signal",
    subtitle: "Align frequency dials to detect the climate anomaly spike",
    challengePath: "/challenge/match",
    challengeAction: "Tune Signal ↗",
    image: "/assets/landing/chapters/chapter-03.webp",
    text: "03 · Tune the Signal",
    description: "Wave match: tune oscillators to match warming anomaly spikes",
    audioVoice: "click",
  },
  {
    id: "challenge-04",
    num: "04",
    headerTag: "Challenge 04 · Waveform Ribbons",
    year: "Seasons",
    title: "Waveform Ribbons",
    subtitle: "Track the ~6 ppm annual forest inhale through synchronized acoustic sweeps",
    challengePath: "/listen",
    challengeAction: "Listen Pulses ↗",
    image: "/assets/about/routine/routine_04_voices.webp",
    text: "04 · Waveform Ribbons",
    description: "Atmospheric pulse: sonify global seasonal breathing",
    audioVoice: "pulse",
  },
  {
    id: "challenge-05",
    num: "05",
    headerTag: "Challenge 05 · Climate Console",
    year: "Archive",
    title: "Climate Console",
    subtitle: "Explore the historical 1958–2026 sonification synthesizer archive",
    challengePath: "/jukebox",
    challengeAction: "Open Console ↗",
    image: "/assets/about/routine/routine_03_challenges.webp",
    text: "05 · Climate Console",
    description: "Jukebox archive: trigger historical planetary acoustic sweeps",
    audioVoice: "pitch",
  },
];

/**
 * Card-widths per second is autoScroll * 0.25, so 0.8 crosses about one card every 5s.
 * Positive flow advances the numbered row (01 then 02), matching the Next control:
 * cards travel toward the left edge and the following card enters from the right.
 */
const FLOW_SPEED = 0.8;

function useListenBadgeSize() {
  const [size, setSize] = useState(120);
  useEffect(() => {
    const apply = () => {
      const next = Math.round(
        Math.min(148, Math.max(84, Math.min(window.innerWidth * 0.078, window.innerHeight * 0.13)))
      );
      setSize(next);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);
  return size;
}

export function StoryChaptersCarousel() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const galleryRef = useRef<CircularGalleryRef>(null);
  const badgeRef = useRef<HTMLDivElement | null>(null);
  const badgeSize = useListenBadgeSize();

  const handleBadgeClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (isNavigating) return;
    setIsNavigating(true);
    if (!badgeRef.current) {
      router.push("/listen");
      return;
    }
    gsap.to(badgeRef.current, {
      rotate: "+=360",
      scale: 1.15,
      duration: 0.5,
      ease: "power2.inOut",
      onComplete: () => {
        router.push("/listen");
      },
    });
  }, [isNavigating, router]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const handlePrev = useCallback(() => {
    setDirection(-1);
    galleryRef.current?.prev();
  }, []);

  const handleNext = useCallback(() => {
    setDirection(1);
    galleryRef.current?.next();
  }, []);

  // Keyboard navigation. The gallery handles arrows while one of its cards is focused.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (target?.closest(".circular-gallery")) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      if (e.key === "ArrowLeft") handlePrev();
      else handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext]);

  const activeChapter = CHAPTERS[activeIndex] || CHAPTERS[0];
  const paused = reduced || hovered || focused;

  return (
    <section
      className="story-chapters-section relative w-full bg-[#141414]"
      aria-label="Story Chapters Carousel"
      data-paused={paused ? "true" : "false"}
      data-reduced-motion={reduced ? "true" : "false"}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setHovered(false);
      }}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(242,242,240,0.04) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(242,242,240,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "clamp(48px, 4vw, 84px) clamp(48px, 4vw, 84px)",
      }}
    >
      <div className="story-chapters-layout">
        {/* Top HUD Row */}
        <div className="story-chapters-top">
          <div className="story-chip-glass story-hud-chip inline-flex items-center">
            <span className="story-hud-type font-mono uppercase text-[#f2f2f0]/80">
              Challenges · 5 games
            </span>
          </div>

          <div className="story-chip-solid story-hud-chip inline-flex items-center transition-all duration-300">
            <span className="story-hud-type font-mono font-semibold uppercase text-[#141414]">
              <RollingText
                text={`${activeChapter.num} · ${activeChapter.title}`}
                direction={direction}
                hoverRoll={false}
              />
            </span>
          </div>
        </div>

        {/* Full-bleed gallery. Card size follows the viewport inside CircularGallery. */}
        <div className="story-chapters-gallery-frame">
          <CircularGallery
            ref={galleryRef}
            items={CHAPTERS}
            bend={0}
            textColor="#f2f2f0"
            borderRadius={0.05}
            itemSize={1.2}
            itemAspect={0.78}
            gap={0.2}
            wave={0}
            fadeEdges={0.06}
            shadow={0}
            dpr={1.25}
            scrollSpeed={2}
            scrollEase={0.08}
            autoScroll={paused ? 0 : FLOW_SPEED}
            snap={false}
            openOnClick={true}
            onActiveChange={(index) => {
              setActiveIndex((prev) => {
                if (index !== prev) {
                  const count = CHAPTERS.length;
                  const forward = (index - prev + count) % count;
                  const backward = (prev - index + count) % count;
                  setDirection(forward <= backward ? 1 : -1);
                }
                return index;
              });
            }}
            onItemClick={(_item, index) => {
              setActiveIndex(index);
            }}
          />
        </div>

        <div className="story-chapters-controls">
          <div className="story-chapters-controls-row">
            <button
              type="button"
              onClick={handlePrev}
              className="story-btn-round"
              aria-label="Previous Challenge"
            >
              <img
                src="/assets/story/16f81.svg"
                alt=""
                className="absolute inset-0 size-full pointer-events-none"
              />
              <span className="story-btn-glyph">←</span>
            </button>

            <Link
              href={activeChapter.challengePath}
              prefetch={false}
              className="story-btn-pill"
              aria-label={`Play ${activeChapter.title}`}
            >
              <img
                src="/assets/story/d4b62.svg"
                alt=""
                className="absolute inset-0 size-full pointer-events-none"
              />
              <span className="story-btn-label">
                <RollingText
                  text={`Play ${activeChapter.title}`}
                  direction={direction}
                  hoverRoll={true}
                />
              </span>
            </Link>

            <button
              type="button"
              onClick={handleNext}
              className="story-btn-round"
              aria-label="Next Challenge"
            >
              <img
                src="/assets/story/16f81.svg"
                alt=""
                className="absolute inset-0 size-full pointer-events-none"
              />
              <span className="story-btn-glyph">→</span>
            </button>
          </div>

          <p className="story-chapters-count" data-challenge-count={activeChapter.num}>
            {activeChapter.num} / 05
          </p>
        </div>

        <div className="story-chapters-bottom">
          <div className="story-chip-glass story-hud-chip story-noaa-chip story-bottom-wide inline-flex items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-[#f2f2f0]/40" />
            <span className="story-noaa-label">
              NOAA GML · Mauna Loa Observatory
            </span>
          </div>

          <Link
            href="/listen"
            className="story-chip-glass story-listen-pill"
            aria-label="Listen to the map"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-[#f2f2f0]/40" />
            <span className="story-listen-pill-label">Listen to the map</span>
          </Link>

          <Link
            href="/listen"
            onClick={handleBadgeClick}
            className="story-listen-badge story-bottom-wide group"
            aria-label="823 months loaded - Listen to sonifications"
          >
            <div ref={badgeRef} className="will-change-transform">
              <CircularText
                text="823 MONTHS * LOADED * LISTEN * "
                onHover="speedUp"
                direction="clockwise"
                spinDuration={20}
                size={badgeSize}
                fontSize={Math.max(8, Math.round((badgeSize * 11) / 120))}
                fontWeight={900}
                hoverTilt={15}
                className="font-sans font-bold text-[#f2f2f0]/90 transition-colors group-hover:text-[#f2f2f0]"
              >
                <div className="relative flex size-10 items-center justify-center overflow-hidden pointer-events-none">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-8 text-[#f2f2f0] transition-all duration-300 ease-out group-hover:translate-x-10 group-hover:-translate-y-10 group-hover:opacity-0"
                  >
                    <line x1="6" y1="18" x2="18" y2="6" />
                    <polyline points="9 6 18 6 18 15" />
                  </svg>
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="absolute size-8 -translate-x-10 translate-y-10 text-[#f2f2f0] opacity-0 transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
                  >
                    <line x1="6" y1="18" x2="18" y2="6" />
                    <polyline points="9 6 18 6 18 15" />
                  </svg>
                </div>
              </CircularText>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
