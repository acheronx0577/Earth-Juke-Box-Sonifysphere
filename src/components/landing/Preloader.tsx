"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { getGlobalLenis } from "@/lib/lenis";
import { warmListenAssets } from "@/lib/listenAssets";
import { canWarmAssets } from "@/lib/assetCache";

interface PreloaderProps {
  readonly onComplete?: () => void;
  readonly logoSrc?: string;
}

interface GridMetrics {
  readonly tileSize: number;
  readonly totalColumns: number;
  readonly totalRows: number;
  readonly isDesktop: boolean;
}

interface GridStops {
  readonly firstStop: HTMLDivElement;
  readonly secondStop: HTMLDivElement;
  readonly thirdStop: HTMLDivElement;
  readonly finalStop: HTMLDivElement;
  readonly markerStops: HTMLDivElement[];
  readonly fadeInTiles: HTMLDivElement[];
  readonly collapsingTiles: HTMLDivElement[];
}

interface TimelineConfig {
  readonly stops: GridStops;
  readonly marker: HTMLDivElement;
  readonly preloaderBg: HTMLDivElement;
  readonly logoSrc: string;
  readonly moveMarkerTo: (tile: HTMLElement, content: string) => void;
  readonly onFinish: () => void;
}

function calculateGridMetrics(width: number, height: number): GridMetrics {
  const isDesktop = width >= 1000;
  // Scaled-down tile dimensions across all screen sizes
  const targetTileSize = isDesktop
    ? Math.min(72, Math.max(56, Math.round(width / 24)))
    : Math.min(48, Math.max(38, Math.round(width / 9)));
  const snapToOdd = (value: number) => (value % 2 === 0 ? Math.max(3, value - 1) : Math.max(3, value));
  const columnCount = snapToOdd(Math.floor(width / targetTileSize));
  const rowCount = snapToOdd(Math.floor(height / targetTileSize));

  const tileSize = Math.max(width / columnCount, height / rowCount);
  const totalColumns = columnCount + 2;
  const totalRows = rowCount + 2;

  return { tileSize, totalColumns, totalRows, isDesktop };
}

function buildGridTiles(
  grid: HTMLElement,
  totalColumns: number,
  totalRows: number,
  tileSize: number
): HTMLDivElement[] {
  grid.style.width = `${totalColumns * tileSize}px`;
  grid.style.height = `${totalRows * tileSize}px`;
  grid.innerHTML = "";

  const tiles: HTMLDivElement[] = [];
  const totalTiles = totalColumns * totalRows;
  for (let i = 0; i < totalTiles; i++) {
    const tile = document.createElement("div");
    tile.className = "grid-tile";
    tile.style.width = `${tileSize}px`;
    tile.style.height = `${tileSize}px`;
    grid.appendChild(tile);
    tiles.push(tile);
  }
  return tiles;
}

function resolveGridStops(
  tiles: HTMLDivElement[],
  totalColumns: number,
  totalRows: number,
  isDesktop: boolean
): GridStops | null {
  const middleRow = Math.floor(totalRows / 2);
  const centerColumn = Math.floor(totalColumns / 2);
  const tileAtColumn = (col: number) => tiles[middleRow * totalColumns + col];

  const maxSpan = Math.floor(totalColumns / 2) - 1;
  const step = isDesktop
    ? Math.max(2, Math.min(4, Math.floor(maxSpan / 2)))
    : Math.max(1, Math.min(2, Math.floor(maxSpan / 2)));

  const firstStop = tileAtColumn(Math.max(1, centerColumn - step));
  const secondStop = tileAtColumn(Math.min(totalColumns - 2, centerColumn + step));
  const thirdStop = tileAtColumn(Math.min(totalColumns - 2, centerColumn + step + (isDesktop ? 2 : 1)));
  const finalStop = tileAtColumn(centerColumn);

  if (!firstStop || !secondStop || !thirdStop || !finalStop) {
    return null;
  }

  const markerStops = [firstStop, secondStop, thirdStop, finalStop];
  markerStops.forEach((tile) => {
    tile.style.backgroundColor = "rgba(242,242,240,0.08)";
    tile.style.outline = "0.5px solid rgba(242,242,240,0.2)";
  });

  const fadeInTiles = tiles.filter((tile) => !markerStops.includes(tile));
  const collapsingTiles = tiles.filter((tile) => tile !== finalStop);

  return {
    firstStop,
    secondStop,
    thirdStop,
    finalStop,
    markerStops,
    fadeInTiles,
    collapsingTiles,
  };
}

function getHeroRevealTargets(): HTMLElement[] {
  const heroNav = document.querySelector<HTMLElement>(".hero-content-nav");
  const heroTitle = document.querySelector<HTMLElement>(".sonify-hero-title");
  const heroCta = document.querySelector<HTMLElement>(".sonify-hero-cta");
  const heroFooter = document.querySelector<HTMLElement>(".hero-content-footer");
  return [heroNav, heroTitle, heroCta, heroFooter].filter(Boolean) as HTMLElement[];
}

function createMarkerMover(marker: HTMLElement, preloader: HTMLElement) {
  const preloaderRect = preloader.getBoundingClientRect();
  const getTileOffset = (tile: HTMLElement) => {
    const tileRect = tile.getBoundingClientRect();
    return {
      left: tileRect.left - preloaderRect.left,
      top: tileRect.top - preloaderRect.top,
    };
  };

  return {
    getTileOffset,
    moveMarkerTo: (tile: HTMLElement, content: string) => {
      const startState = Flip.getState(marker);
      gsap.set(marker, getTileOffset(tile));
      marker.innerHTML = content;
      Flip.from(startState, { duration: 1, ease: "power1.out" });
    },
  };
}

function buildPreloaderTimeline(config: TimelineConfig): gsap.core.Timeline {
  const { stops, marker, preloaderBg, logoSrc, moveMarkerTo, onFinish } = config;
  const { firstStop, secondStop, thirdStop, finalStop, fadeInTiles, collapsingTiles } = stops;

  const heroRevealTargets = getHeroRevealTargets();
  if (heroRevealTargets.length > 0) {
    gsap.set(heroRevealTargets, { y: 35, opacity: 0 });
  }

  const timeline = gsap.timeline({
    delay: 0.3,
    onComplete: onFinish,
  });

  timeline.to(
    fadeInTiles,
    {
      opacity: 1,
      duration: 0.125,
      stagger: { each: 2.0 / Math.max(1, fadeInTiles.length), from: "random" },
    },
    0
  );

  timeline.to(
    [firstStop, secondStop, thirdStop],
    {
      backgroundColor: "#f2f2f0",
      outlineColor: "#f2f2f0",
      duration: 0.15,
      stagger: 0.25,
    },
    2.4
  );

  timeline.add(() => moveMarkerTo(secondStop, "<p>50</p>"), 0.25);
  timeline.add(() => moveMarkerTo(thirdStop, "<p>75</p>"), 1.25);
  timeline.add(
    () => moveMarkerTo(finalStop, `<img src="${logoSrc}" alt="SonifySphere Logo" />`),
    2.4
  );

  // Fade out solid preloader underlay to show hero directly behind the tiles
  timeline.to(
    preloaderBg,
    {
      opacity: 0,
      duration: 0.25,
      ease: "power1.out",
    },
    "+=0.2"
  );

  // Collapse grid tiles to unveil the hero section
  timeline.to(
    collapsingTiles,
    {
      scaleY: 0,
      transformOrigin: "top",
      duration: 0.85,
      stagger: { each: 0.0035, from: "random" },
      ease: "power3.inOut",
    },
    "<"
  );

  timeline.to(
    [finalStop, marker],
    { scaleY: 0, transformOrigin: "top", duration: 0.85, ease: "power3.inOut" },
    "<"
  );

  if (heroRevealTargets.length > 0) {
    timeline.to(
      heroRevealTargets,
      {
        y: 0,
        opacity: 1,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.1,
      },
      "<0.1"
    );
  }

  return timeline;
}

export function Preloader({
  onComplete,
  logoSrc = "/assets/landing/sonifysphere-glyph-dark.svg",
}: Readonly<PreloaderProps>) {
  const [isComplete, setIsComplete] = useState(false);
  const preloaderRef = useRef<HTMLDivElement | null>(null);
  const preloaderBgRef = useRef<HTMLDivElement | null>(null);
  const preloaderGridRef = useRef<HTMLDivElement | null>(null);
  const progressMarkerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let idle: number | undefined;
    let fallback: number | undefined;
    const warm = () => {
      if (cancelled) return;
      const prepare = () => {
        if (document.documentElement.dataset.lite === "on") return;
        if (!canWarmAssets()) return;
        void warmListenAssets();
      };
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(prepare, { timeout: 2500 });
      else fallback = window.setTimeout(prepare, 0);
    };
    // Let the current view's hero finish first; warming never delays the reveal.
    const heroImages = Array.from(document.querySelectorAll<HTMLImageElement>(".hero-img img"));
    void Promise.allSettled(heroImages.map((image) => image.decode())).then(warm);
    return () => {
      cancelled = true;
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (fallback !== undefined) window.clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let seen = document.documentElement.dataset.sonifyNavigating === "1";
    try {
      seen ||= sessionStorage.getItem("sonify-intro-seen") === "1";
      sessionStorage.setItem("sonify-intro-seen", "1");
    } catch { /* Storage is optional in private/restricted browser sessions. */ }
    if (seen) {
      setIsComplete(true);
      onComplete?.();
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsComplete(true);
      onComplete?.();
      return;
    }

    gsap.registerPlugin(Flip);

    const preloader = preloaderRef.current;
    const preloaderBg = preloaderBgRef.current;
    const preloaderGrid = preloaderGridRef.current;
    const progressMarker = progressMarkerRef.current;

    if (!preloader || !preloaderBg || !preloaderGrid || !progressMarker) {
      return;
    }

    document.body.style.overflow = "hidden";
    getGlobalLenis()?.stop();

    const metrics = calculateGridMetrics(window.innerWidth, window.innerHeight);
    const tiles = buildGridTiles(
      preloaderGrid,
      metrics.totalColumns,
      metrics.totalRows,
      metrics.tileSize
    );

    const stops = resolveGridStops(
      tiles,
      metrics.totalColumns,
      metrics.totalRows,
      metrics.isDesktop
    );

    if (!stops) {
      document.body.style.overflow = "";
      setIsComplete(true);
      onComplete?.();
      return;
    }

    preloader.style.setProperty("--tile-size", `${metrics.tileSize}px`);
    gsap.set(stops.fadeInTiles, { opacity: 0 });
    const mover = createMarkerMover(progressMarker, preloader);
    // Reveal the percentage only after it sits on the first tile. It is in the
    // server HTML, so leaving it visible paints "25" at the viewport corner.
    gsap.set(progressMarker, {
      width: metrics.tileSize,
      height: metrics.tileSize,
      ...mover.getTileOffset(stops.firstStop),
      visibility: "visible",
    });

    const timeline = buildPreloaderTimeline({
      stops,
      marker: progressMarker,
      preloaderBg,
      logoSrc,
      moveMarkerTo: mover.moveMarkerTo,
      onFinish: () => {
        const heroTargets = getHeroRevealTargets();
        if (heroTargets.length > 0) {
          gsap.set(heroTargets, { opacity: 1, y: 0 });
        }
        document.body.style.overflow = "";
        getGlobalLenis()?.start();
        setIsComplete(true);
        onComplete?.();
      },
    });

    return () => {
      timeline.kill();
      document.body.style.overflow = "";
      getGlobalLenis()?.start();
    };
  }, [logoSrc, onComplete]);

  if (isComplete) {
    return null;
  }

  return (
    <div
      ref={preloaderRef}
      className="preloader"
      role="status"
      aria-live="polite"
      aria-label="Loading SonifySphere"
    >
      <div ref={preloaderBgRef} className="preloader-bg" />
      <div ref={preloaderGridRef} className="preloader-grid" />
      <div ref={progressMarkerRef} className="progress-marker" style={{ visibility: "hidden" }}>
        <p>25</p>
      </div>
    </div>
  );
}
