"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import CircularGallery, { type CircularGalleryRef, type GalleryItem } from "@/components/shared/CircularGallery";
import { RollingText } from "@/components/shared/RollingText";

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

export function StoryChaptersCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const galleryRef = useRef<CircularGalleryRef>(null);

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

        {/* Bottom navigation link */}
        <div className="story-chapters-bottom flex w-full justify-end pb-0">
          <Link href="/listen" className="story-chip-glass story-listen-link inline-flex items-center gap-2 px-4 py-2">
            <span className="size-1.5 rounded-full bg-[#f2f2f0]/40" />
            <span className="font-mono text-[11px] uppercase tracking-wider">
              Listen to the map ↗
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
