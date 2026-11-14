"use client";

import { useEffect, useState } from "react";
import { ChallengePlate } from "@/components/play/ChallengePlate";
import { ListeningPrimer } from "@/components/play/ListeningPrimer";
import { readGuessRun } from "@/lib/guessSession";
import { createLenisInstance } from "@/lib/lenis";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

function ChallengeMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(SplitText);
    const { destroyLenis } = createLenisInstance({ syncTouch: false });
    const splits: Array<{ revert: () => void }> = [];
    const title = document.querySelector<HTMLElement>("[data-challenge-title]");
    if (title) {
      const split = SplitText.create(title, { type: "lines", mask: "lines", linesClass: "about-line" });
      splits.push(split);
      gsap.from(split.lines, { yPercent: 100, duration: 0.75, ease: "power3.out", stagger: 0.1 });
    }
    const plates = document.querySelectorAll(".sonify-plate");
    gsap.from(plates, { y: 24, opacity: 0, duration: 0.6, ease: "power3.out", stagger: 0.08 });
    return () => {
      splits.forEach((split) => split.revert());
      destroyLenis();
    };
  }, []);
  return null;
}

export function ChallengeHub() {
  const [resumeHref, setResumeHref] = useState<string | null>(null);
  const [resumeRound, setResumeRound] = useState(1);

  useEffect(() => {
    const stored = readGuessRun();
    if (!stored || stored.phase === "result") return;
    if (stored.phase === "ready" && stored.index === 0 && stored.history.length === 0) return;
    setResumeHref(`/challenge/guess?seed=${stored.seed}&resume=1`);
    setResumeRound(stored.index + 1);
  }, []);

  return (
    <main id="main-content" tabIndex={-1} className="sonify-play-page">
      <div className="sonify-play-wrap">
        <section className="sonify-hub-hero">
          <p className="about-kicker">Challenges</p>
          <div>
            <h1 data-challenge-title>Two ways to play with the sound.</h1>
            <p className="sonify-lede">Both use the same notes as the map. Sound starts only after you ask for it.</p>
          </div>
        </section>
        <section className="sonify-plates" aria-label="Pick a challenge">
          <ChallengePlate
            kicker="01 · Listening quiz"
            time="≈ 2 min · 5 rounds"
            title="Guess the Signal"
            what="Hear a short phrase from the map and name the region or the record."
            steps={[
              <>
                Press <b>Hear the signal</b>. Four notes play. <em>1.4 s</em>
              </>,
              <>
                Pick one of four answers. <em className="sonify-desk-keys">Keys 1–4</em>
              </>,
              <>See if you were right, and why. Then the next round.</>,
            ]}
            reward="A score, your best streak, and a link to hear the real data for a place you heard."
            glyph={
              <svg className="sonify-glyph" viewBox="0 0 44 44" aria-hidden="true">
                <rect x="4" y="26" width="6" height="14" fill="#f2f2f0" />
                <rect x="14" y="20" width="6" height="20" fill="#f2f2f0" />
                <rect x="24" y="12" width="6" height="28" fill="#f2f2f0" />
                <rect x="34" y="4" width="6" height="36" fill="#f2f2f0" />
              </svg>
            }
            cta={resumeHref ? `Resume round ${resumeRound}` : "Start round 1"}
            href={resumeHref ?? "/challenge/guess"}
            solid
          />
          <ChallengePlate
            kicker="02 · Make a track"
            time="≈ 3 min · 8 slots"
            title="Compose"
            what="Place regions and records into eight slots, set a tempo, and compile a piece you can play, download, or share."
            steps={[
              <>Fill the eight slots with places or records.</>,
              <>
                Set the tempo. <em>60–160 BPM</em>
              </>,
              <>
                Press <b>Compile</b>, then <b>Play</b>.
              </>,
            ]}
            reward="A WAV file of your mix and a link you can share."
            glyph={
              <svg className="sonify-glyph" viewBox="0 0 44 44" aria-hidden="true">
                <g fill="#f2f2f0">
                  <rect x="4" y="18" width="4" height="8" />
                  <rect x="10" y="12" width="4" height="20" />
                  <rect x="16" y="6" width="4" height="32" />
                  <rect x="22" y="14" width="4" height="16" />
                  <rect x="28" y="9" width="4" height="26" />
                  <rect x="34" y="16" width="4" height="12" />
                </g>
              </svg>
            }
            cta="Open the board"
            href="/challenge/compose"
          />
        </section>
        <ListeningPrimer />
        <p className="sonify-quiet about-kicker">Nothing autoplays. Each sound waits for your press.</p>
      </div>
      <ChallengeMotion />
    </main>
  );
}
