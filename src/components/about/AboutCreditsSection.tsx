"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ABOUT_CREDIT_ROWS } from "@/data/aboutData";

const FlowingMenu = dynamic(() => import("@/components/shared/FlowingMenu"), {
  ssr: false,
  loading: () => null,
});

const DESKTOP_MENU_QUERY = "(min-width: 1200px) and (hover: hover) and (pointer: fine)";
const FLOWING_MARQUEES: Record<string, string> = {
  data: "CO₂ · NOAA MAUNA LOA · EMBEDDED",
  gibs: "IMAGERY · NASA GIBS · BLUE MARBLE AND COLOUR MAP",
  library: "MEDIA · NASA IMAGE AND VIDEO LIBRARY",
  gistemp: "TEMPERATURE · NASA GISTEMP V4 · EXAMPLE",
  image: "FRAMES · NASA EPIC / DSCOVR · IMAGE-DERIVED",
  eic: "EIC · NASA SVS · IMAGE-DERIVED",
  "svs-5196": "DYAMOND CO₂ · NASA SVS 5196 · IMAGE-DERIVED",
  "svs-3912": "CURRENTS & SST · NASA SVS 3912 · ECCO2",
  "svs-5011": "LIGHTNING · NASA SVS 5011 · PULSE TRIGGERS",
  "svs-13786": "CALDWELL 73 · NASA SVS 13786 · CONCEPTUAL MAPPING",
  eonet: "EVENTS · NASA EONET · OPEN EVENTS IN VIEW",
  meteomatics: "WEATHER · METEOMATICS · WHEN CONFIGURED",
  "planetary-computer": "SATELLITE · MICROSOFT PLANETARY COMPUTER · STAC & DATA API",
  power: "SOLAR & MET · NASA POWER API · CONTINUOUS FALLBACK",
  "azure-storage": "CLOUD CACHE · MICROSOFT AZURE BLOB & QUEUE STORAGE",
  elevenlabs: "NARRATION & TEXTURES · ELEVENLABS AI · LABELED",
  "noaa-cpc": "SURFACE TEMP · NOAA CPC EQUAL EARTH",
  "ges-disc": "ATMOSPHERE CO₂ · NASA GES DISC / OCO-2",
  "hero-image": "AI HERO + CHAPTER ART · SI-GENERATED",
  "si-tools": "SI TOOLS · GROK BOT, CHATGPT, CLAUDE, ANTIGRAVITY, CODEX",
  "audio-provenance": "AUDIO · TONE.JS / WEB AUDIO",
  "video-provenance": "VIDEO · NO AI VIDEO",
  type: "TYPE · PLANET KOSMOS",
  "ui-type": "UI TYPE · GEIST",
  layout: "LAYOUT · ORBIT MATTER",
  "react-bits": "UI · REACT BITS FLOWING MENU",
};
const FLOWING_IMAGES: Record<string, string> = {
  data: "/assets/credits/noaa-co2.webp",
  image: "/assets/credits/nasa-epic-earth.webp",
  "hero-image": "/assets/credits/hero-ai-generated.webp",
  "si-tools": "/assets/credits/ai-tools.webp",
  "audio-provenance": "/assets/credits/audio-visualization.webp",
  "video-provenance": "/assets/credits/video-status.webp",
  type: "/assets/credits/planet-kosmos.webp",
  "ui-type": "/assets/credits/vercel-geist.webp",
  layout: "/assets/credits/codegrid-orbit-matter.webp",
  "react-bits": "/assets/credits/reactbits.webp",
};

function isIPadOS() {
  return /iPad/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function AboutCreditsSection() {
  const [desktopMenuEnabled, setDesktopMenuEnabled] = useState(false);
  const [menuReady, setMenuReady] = useState(false);
  const onMenuReady = useCallback(() => setMenuReady(true), []);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MENU_QUERY);
    const updateViewport = () => {
      const enableMenu = media.matches && !isIPadOS();
      setDesktopMenuEnabled(enableMenu);
      if (!enableMenu) setMenuReady(false);
    };

    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  const flowingItems = useMemo(
    () =>
      ABOUT_CREDIT_ROWS.map((row) => ({
        index: row.label.toUpperCase(),
        text: row.text,
        marquee: FLOWING_MARQUEES[row.id] ?? row.label,
        image: FLOWING_IMAGES[row.id],
        meta: row.linkLabel?.replace(/\s*↗$/, ""),
        link: row.linkHref,
        target: row.linkHref ? "_blank" : undefined,
        rel: row.linkHref ? "noreferrer" : undefined,
        ariaLabel: `${row.label}: ${row.text}${row.linkLabel ? `, source ${row.linkLabel}` : ""}`,
      })),
    [],
  );

  const flowingIsReady = desktopMenuEnabled && menuReady;

  return (
    <section
      className="about-wrap about-credits"
      aria-labelledby="credits-h"
      data-flowing-loading={desktopMenuEnabled ? "true" : undefined}
      data-flowing-ready={flowingIsReady ? "true" : undefined}
    >
      <div className="about-sec-head">
        <p className="about-kicker" id="credits-h">
          Credits
        </p>
      </div>

      <div className="about-credits-flowing-shell" aria-hidden={!flowingIsReady}>
        {desktopMenuEnabled && (
          <FlowingMenu
            items={flowingItems}
            className="about-credits-flowing"
            ariaLabel="Project credits and sources"
            speed={46}
            duration={0.58}
            stretch={0.18}
            magnet={0.14}
            followCursor={0.2}
            dimInactive
            align="left"
            showIndex
            showArrow
            textColor="#f2f2f0"
            bgColor="transparent"
            marqueeBgColor="#f2f2f0"
            marqueeTextColor="#141414"
            borderColor="rgba(242, 242, 240, 0.2)"
            onReady={onMenuReady}
          />
        )}
      </div>

      <div className="about-credits-static" aria-hidden={flowingIsReady}>
        {ABOUT_CREDIT_ROWS.map((row) => (
          <div key={row.id} className="about-crow">
            <p className="about-kicker">{row.label}</p>
            <p className="about-credit-value">{row.text}</p>
            {row.linkHref && row.linkLabel ? (
              <a href={row.linkHref} target="_blank" rel="noreferrer" className="about-credit-link">
                {row.linkLabel}
              </a>
            ) : (
              <span className="hidden min-[1001px]:block" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
