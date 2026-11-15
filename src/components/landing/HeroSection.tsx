"use client";

import Link from "next/link";
import { ASSETS } from "@/data/landingData";
import { useSonifyPlayer } from "@/context/SonifyPlayerContext";
import { PrimaryPillButton, TextLinkButton } from "@/components/landing/Primitives";
import { HeroPixelHover } from "@/components/landing/HeroPixelHover";

export function HeroSoundToggle() {
  const { soundOn, toggleSoundOn } = useSonifyPlayer();
  const waveClass = soundOn ? "opacity-100" : "opacity-25";
  const labelText = soundOn ? "Sound on" : "Sound off";

  return (
    <button
      type="button"
      onClick={toggleSoundOn}
      aria-pressed={soundOn}
      aria-label={labelText}
      className="sonify-sound-toggle relative flex gap-[8px] items-center h-[32px] w-[117px] cursor-pointer shrink-0 z-[8]"
    >
      <div className="sonify-sound-bg absolute h-[32px] left-0 top-0 w-[117px] pointer-events-none">
        <img alt="" className="absolute block inset-0 max-w-none size-full" src={ASSETS.soundToggleBg} />
      </div>
      <div className="h-[14px] relative shrink-0 w-[9px]">
        <img alt="" className="absolute block inset-0 max-w-none size-full" src={ASSETS.speakerIcon} />
      </div>
      <div className={`h-[10px] relative shrink-0 w-[2px] transition-opacity duration-200 ${waveClass}`}>
        <div className="absolute inset-[-6%_-30%]">
          <img alt="" className="block max-w-none size-full object-contain" src={ASSETS.waveIcon} />
        </div>
      </div>
      <span className="sonify-sound-label font-mono font-medium leading-[1.2] relative shrink-0 text-[#f2f2f0] text-[13px] tracking-[0.52px] uppercase whitespace-nowrap">
        {labelText}
      </span>
    </button>
  );
}

function HeroWordmark() {
  return (
    <Link
      href="/"
      aria-label="SonifySphere Home"
      className="hidden min-[1001px]:block h-[38px] md:h-[44px] w-auto aspect-[123.8/21.72] shrink-0 z-[8] transition-transform duration-200 hover:scale-105"
    >
      <img
        alt="SonifySphere"
        className="block max-w-none size-full"
        src={ASSETS.headerWordmark}
      />
    </Link>
  );
}

function HeroImages() {
  return (
    <div className="hero-img-container">
      <div className="hero-img" data-si-generated="true" data-si-tool="ChatGPT" data-si-media="image">
        <img
          alt=""
          className="sonify-earth-breathe absolute inset-0 max-w-none object-cover object-top pointer-events-none size-full"
          src={ASSETS.heroEarthSky}
        />
        <img
          alt=""
          className="absolute inset-0 max-w-none object-cover object-bottom pointer-events-none size-full"
          src={ASSETS.heroForegroundAstronaut}
        />
        <HeroPixelHover />
      </div>
      <div className="hero-img-overlay" />
      <div className="hero-img-gradient" />
      <p className="pointer-events-none absolute right-4 top-28 z-[2] m-0 max-w-[10.5rem] text-right font-mono text-[11px] font-medium uppercase leading-[1.35] tracking-[0.14em] text-[#f2f2f0] [text-shadow:0_1px_2px_#141414]">
        AI-generated image
      </p>
    </div>
  );
}

function HeroTitleAndCta() {
  return (
    <div className="hero-content-header">
      <h1
        aria-label="earth breathes"
        className="sonify-hero-title relative w-[min(764px,calc(100vw-3rem))] aspect-[764/94] max-w-full overflow-hidden"
      >
        <span className="absolute inset-[2.15%_62.39%_3.22%_0.27%] block">
          <img alt="earth" className="absolute block inset-0 max-w-none size-full" src={ASSETS.heroTitleEarth} />
        </span>
        <span className="absolute inset-[2.15%_0.27%_3.22%_38.81%] block">
          <img alt="breathes" className="absolute block inset-0 max-w-none size-full" src={ASSETS.heroTitleBreathes} />
        </span>
      </h1>

      <div className="sonify-hero-cta flex flex-wrap gap-4 sm:gap-7 items-center justify-center mt-6">
        <PrimaryPillButton label="Enter with sound" href="/listen?sound=on" />
        <TextLinkButton label="Enter without audio" href="/listen?sound=off" />
      </div>
    </div>
  );
}

function HeroFooterReadouts() {
  return (
    <div className="hero-content-footer">
      <div
        className="hidden sm:flex relative h-[28px] w-[356px] items-center"
        data-name="Hero/Readout chip · credit_hero (sci-fi telemetry)"
      >
        <img alt="" className="absolute block inset-0 max-w-none size-full" src={ASSETS.chipLeftBg} />
        <p className="relative font-mono font-medium leading-[normal] pl-[26px] text-[#f2f2f0] text-[12px] uppercase whitespace-nowrap">
          SIGNAL · LUNAR RELAY 04 // RECEIVING EARTH
        </p>
        <div className="sonify-cursor-blink absolute bg-[#f2f2f0] h-[11px] right-[12px] top-[9px] w-[8px]" />
        <div className="absolute bg-[#f2f2f0] h-[11px] left-[12px] top-[9px] w-px" />
        <div className="absolute bg-[#f2f2f0] h-px left-[12px] top-[9px] w-[6px]" />
        <div className="absolute bg-[#f2f2f0] h-px left-[12px] top-[19px] w-[6px]" />
      </div>

      <div
        className="sonify-hero-clock-chip relative flex h-[28px] w-fit max-w-full items-center px-3"
        data-name="Hero/Readout chip · LATEST + FEED"
      >
        <img alt="" className="absolute block inset-0 max-w-none size-full" src={ASSETS.chipRightBg} />
        <p className="relative font-mono font-medium leading-[normal] text-[#f2f2f0] text-[11px] sm:text-[12px] whitespace-nowrap">
          AI-GENERATED IMAGE
        </p>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="hero" data-name="Landing/Hero E-a">
      <div className="hero-container">
        <HeroImages />
        <div className="hero-content">
          <div className="container">
            <div className="hero-content-nav">
              <HeroWordmark />
              <HeroSoundToggle />
            </div>
            <HeroTitleAndCta />
            <HeroFooterReadouts />
          </div>
        </div>
      </div>
    </section>
  );
}
