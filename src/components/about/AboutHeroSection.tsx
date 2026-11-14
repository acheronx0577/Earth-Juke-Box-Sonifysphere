"use client";

import { memo, useEffect, useState } from "react";
import { SoundOffNote } from "@/components/shared/SoundOffNote";
import { HeroCo2Line } from "@/components/about/HeroCo2Line";
import { PrimaryPillAction } from "@/components/landing/Primitives";
import { IconPause, IconPlay } from "@/components/shared/Icons";
import { useSonifyPlayer } from "@/context/SonifyPlayerContext";

const HeroLines = memo(function HeroLines() {
  return (
    <p data-about-copy>
      SonifySphere plays the Mauna Loa CO₂ record as music.
      <br />
      Three voices, one for each pattern in the data.
    </p>
  );
});

const HeroTitle = memo(function HeroTitle() {
  return (
    <h1 id="about-h1" className="about-hero-title" data-about-title>
      how it sounds
    </h1>
  );
});

export function AboutHeroSection() {
  const { startEnsemble, ensembleOn, playing, togglePlaying, soundOn, setSoundEnabled, isSoundOn } = useSonifyPlayer();
  const hearing = ensembleOn && playing && soundOn;
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<"tab" | "load" | "off" | null>(null);

  useEffect(() => {
    if (soundOn && blocked === "off") setBlocked(null);
  }, [blocked, soundOn]);

  const startHearing = () => {
    setBusy(true);
    setBlocked(null);
    void import("tone")
      .then(async (Tone) => {
        try {
          await Tone.start();
        } catch (error) {
          const name = error instanceof DOMException ? error.name : "";
          setBlocked(name === "NotAllowedError" || name === "SecurityError" ? "tab" : "load");
          return;
        }
        if (Tone.getContext().state !== "running") {
          setBlocked("tab");
          return;
        }
        if (!startEnsemble()) setBlocked("off");
      })
      .catch(() => {
        setBlocked("load");
      })
      .finally(() => setBusy(false));
  };

  const onHear = () => {
    if (!isSoundOn()) {
      setBlocked("off");
      return;
    }
    if (hearing && !blocked) {
      togglePlaying();
      return;
    }
    startHearing();
  };

  const turnSoundOn = () => {
    setSoundEnabled(true);
    setBlocked(null);
    startHearing();
  };

  let label = (
    <>
      <IconPlay /> Hear it
    </>
  );
  if (busy) label = <>Starting…</>;
  else if (hearing) {
    label = (
      <>
        <IconPause /> Playing
      </>
    );
  }

  return (
    <section className="about-hero" aria-labelledby="about-h1">
      <div className="about-console">
        <img
          className="about-globe"
          src="/assets/about/globe-listen.webp"
          alt="The SonifySphere globe as it appears on the Listen page"
          width={1200}
          height={1200}
        />
        <HeroCo2Line />
        <span className="about-chip about-chip-left" data-flicker>
          315.71 ppm · Mar 1958
        </span>
        <span className="about-chip about-chip-right" data-flicker>
          432.34 ppm · May 2026
        </span>
        <div className="about-hero-copy">
          <HeroLines />
          <div className="about-hero-actions">
            <PrimaryPillAction label={label} pressed={hearing} busy={busy} onClick={onHear} />
          {blocked === "off" ? <SoundOffNote onTurnOn={turnSoundOn} /> : null}
          {blocked === "load" || blocked === "tab" ? (
            <p className="about-hear-error" role="alert">
              {blocked === "load"
                ? "The sound engine did not load. Check your connection and press again."
                : "Sound is blocked in this tab. Press again."}
            </p>
          ) : null}
          </div>
        </div>
        <HeroTitle />
        <a className="about-scroll" href="#voices" data-flicker>
          <i aria-hidden="true" />
          Scroll
        </a>
      </div>
    </section>
  );
}
