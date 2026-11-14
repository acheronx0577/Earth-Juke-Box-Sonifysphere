"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
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

export function StoryChaptersCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const galleryRef = useRef<CircularGalleryRef>(null);

  const handlePrev = useCallback(() => {
    setDirection(-1);
    galleryRef.current?.prev();
  }, []);

  const handleNext = useCallback(() => {
    setDirection(1);
    galleryRef.current?.next();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext]);

  const activeChapter = CHAPTERS[activeIndex] || CHAPTERS[0];

  return (
    <section
      className="story-chapters-section relative flex w-full flex-col justify-between bg-[#141414] pt-6 pb-3 sm:pt-8 sm:pb-5"
      aria-label="Story Chapters Carousel"
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(242,242,240,0.04) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(242,242,240,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }}
    >
      <div className="story-chapters-layout mx-auto flex w-full max-w-[1500px] flex-1 flex-col justify-between px-4 sm:px-8 lg:px-12">
        {/* Top HUD Row */}
        <div className="story-chapters-top flex w-full items-center justify-between gap-2 pt-2">
          <div className="story-chip-glass inline-flex items-center gap-2 px-4 py-2">
            <span className="font-mono text-xs uppercase tracking-wider text-[#f2f2f0]/80">
              Challenges · 5 games
            </span>
          </div>

          <div className="story-chip-solid inline-flex items-center gap-2 px-4 py-2 transition-all duration-300">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#141414]">
              <RollingText
                text={`${activeChapter.num} · ${activeChapter.title}`}
                direction={direction}
                hoverRoll={false}
              />
            </span>
          </div>
        </div>

        {/* Circular Gallery Showcase - Infinite Straight Auto-scroll */}
        <div className="story-chapters-gallery-frame relative my-1 w-full overflow-hidden">
          <CircularGallery
            ref={galleryRef}
            items={CHAPTERS}
            bend={0}
            textColor="#f2f2f0"
            borderRadius={0.05}
            itemSize={1.2}
            itemAspect={0.78}
            gap={0.22}
            wave={0}
            fadeEdges={0.12}
            shadow={0.3}
            scrollSpeed={2}
            scrollEase={0.05}
            autoScroll={0.45}
            snap={true}
            openOnClick={true}
            onActiveChange={(index) => {
              setActiveIndex((prev) => {
                if (index !== prev) {
                  setDirection(index > prev ? 1 : -1);
                }
                return index;
              });
            }}
            onItemClick={(_item, index) => {
              setActiveIndex(index);
            }}
          />
        </div>

        {/* Center Controller - Pushed to Middle Bottom */}
        <div className="mt-0 mb-3 sm:mb-5 flex flex-col items-center justify-center gap-2.5">
          <div className="flex items-center gap-3 sm:gap-5 lg:gap-7">
            {/* Prev Button */}
            <button
              type="button"
              onClick={handlePrev}
              className="story-btn-round relative flex size-10 sm:size-12 items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              aria-label="Previous Challenge"
            >
              <img
                src="/assets/story/16f81.svg"
                alt=""
                className="absolute inset-0 size-full pointer-events-none"
              />
              <span className="relative z-10 font-mono text-base sm:text-lg text-[#f2f2f0]">←</span>
            </button>

            {/* Play Challenge (White Pill) */}
            <Link
              href={activeChapter.challengePath}
              className="story-btn-pill relative inline-flex items-center justify-center px-3 sm:px-7 lg:px-9 py-3 sm:py-3.5 transition-transform hover:scale-105 active:scale-95 bg-[#f2f2f0] text-[#141414] cursor-pointer"
              aria-label={`Play ${activeChapter.title}`}
            >
              <img
                src="/assets/story/d4b62.svg"
                alt=""
                className="absolute inset-0 size-full pointer-events-none"
              />
              <span className="relative z-10 font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-[#141414] inline-flex items-center justify-center">
                <RollingText
                  text={`Play ${activeChapter.title}`}
                  direction={direction}
                  hoverRoll={true}
                />
              </span>
            </Link>

            {/* Next Button */}
            <button
              type="button"
              onClick={handleNext}
              className="story-btn-round relative flex size-10 sm:size-12 items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              aria-label="Next Challenge"
            >
              <img
                src="/assets/story/16f81.svg"
                alt=""
                className="absolute inset-0 size-full pointer-events-none"
              />
              <span className="relative z-10 font-mono text-base sm:text-lg text-[#f2f2f0]">→</span>
            </button>
          </div>

          {/* Dynamic Counter */}
          <div className="flex items-center justify-center">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#f2f2f0]/80">
              {activeChapter.num} / 05
            </p>
          </div>
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
