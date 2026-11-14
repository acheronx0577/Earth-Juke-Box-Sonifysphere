"use client";

import { useState } from "react";
import Link from "next/link";
import { HERO_MARKERS } from "@/data/aboutHeroMarkers";
import { SoundOffNote } from "@/components/shared/SoundOffNote";
import { useSonifyPlayer } from "@/context/SonifyPlayerContext";

export function MapHero() {
  const { startEnsemble, ensembleOn, playing, soundOn, setSoundEnabled, isSoundOn } = useSonifyPlayer();
  const [selected, setSelected] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const hearing = ensembleOn && playing && soundOn;

  const onHear = () => {
    if (!isSoundOn()) {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    startEnsemble();
  };

  const onMarker = (id: string) => {
    setSelected((current) => (current === id ? null : id));
  };

  return (
    <section className="hm" id="s-hero" aria-label="How it sounds">
      <div className="hm-stage">
        <img className="hm-map" src="/assets/about/hero-map.svg" alt="" />
        <div className="hm-markers">
          {HERO_MARKERS.map((marker) => {
            const open = selected === marker.id;
            return (
              <button
                key={marker.id}
                type="button"
                className={`mk mk--${marker.tier}${marker.phone ? " mk--phone" : ""}${open ? " is-open" : ""}`}
                style={{ ["--x" as string]: `${marker.x}%`, ["--y" as string]: `${marker.y}%` }}
                aria-pressed={open}
                aria-label={`${marker.name}${marker.detail ? `. ${marker.detail}` : ""}. Press to select.`}
                onClick={() => onMarker(marker.id)}
              >
                <span className="mk-sq" aria-hidden="true" />
                <span className="mk-tag" aria-hidden="true">
                  {marker.tag}
                </span>
                {marker.caption ? (
                  <span className="mk-cap" aria-hidden="true">
                    {marker.caption}
                  </span>
                ) : null}
                <span className="mk-tip" aria-hidden="true">
                  <b>{marker.name}</b>
                  <i>{marker.detail ?? "Region on the /listen map"}</i>
                  <em>■ Selected · press again to clear</em>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="hm-scrim" aria-hidden="true" />
      <div className="hm-bottom">
        <div className="hm-head">
          <h1>
            <span className="hm-l1">How it</span>
            <span>sounds</span>
          </h1>
          <p className="hm-scroll am-label">
            Scroll to explore <span aria-hidden="true">↓</span>
          </p>
        </div>
        <div className="hm-stat">
          <p className="hm-stat-lbl am-label">Mauna Loa CO₂ · Mar 1958 → May 2026</p>
          <p className="hm-stat-num">
            <span className="hm-s1">315.71 →</span>
            <span>432.34 ppm</span>
          </p>
          <div className="hm-actions">
            <button type="button" className="am-btn am-btn-primary" aria-pressed={hearing} onClick={onHear}>
              {hearing ? "Playing" : "Hear it"}
            </button>
            <Link href="/listen" className="am-btn">
              Open the map →
            </Link>
          </div>
          {blocked ? (
            <SoundOffNote
              onTurnOn={() => {
                setSoundEnabled(true);
                setBlocked(false);
                startEnsemble();
              }}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
