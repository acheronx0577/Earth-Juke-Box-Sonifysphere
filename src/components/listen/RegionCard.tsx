"use client";

import Link from "next/link";
import { SoundOffNote } from "@/components/shared/SoundOffNote";
import { layerLit, readingFor, type LayerId, type MapRegion } from "@/data/exploreMap";
import { chamferClip } from "@/components/listen/chamfer";

const ROWS: readonly { id: LayerId; label: string }[] = [
  { id: "temperature", label: "TEMPERATURE" },
  { id: "sea-ice", label: "SEA ICE" },
  { id: "co2", label: "CO₂" },
  { id: "methane", label: "METHANE" },
];

export function RegionCard({
  region,
  layer,
  onPlay,
  onShare,
  soundOff = false,
  onTurnSoundOn,
}: Readonly<{
  region: MapRegion;
  layer: LayerId;
  onPlay: () => void;
  onShare: () => void;
  /** Live wind speed for this region (omitted = no wind row). */
  soundOff?: boolean;
  onTurnSoundOn?: () => void;
}>) {
  const reading = readingFor(region, layer);
  const clip = chamferClip(12);
  const buttonClip = chamferClip(10);

  return (
    <article
      data-region-card=""
      className="pointer-events-none relative flex h-full max-h-full min-h-0 w-full max-w-full flex-col"
      style={{ clipPath: clip, background: "#f2f2f0", padding: 1 }}
    >
      <div
        className="grid h-full min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto]"
        style={{ clipPath: clip, background: "#262626" }}
      >
        <div data-region-head="" className="px-5 pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="m-0 font-mono text-[10px] tracking-[0.4px] text-[rgba(242,242,240,0.6)]">
              REGION · {String(region.index).padStart(2, "0")} / 12
            </p>
            <button type="button" onClick={onShare} className="sonify-text-link pointer-events-auto cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.4px] text-[#f2f2f0]">
              Share
            </button>
          </div>
          <h2 className="m-0 mt-2 font-sans text-[22px] leading-[1.2] font-medium tracking-[-0.22px] text-[#f2f2f0]">{region.name}</h2>
          <p className="m-0 mt-1 font-mono text-[10px] tracking-[0.4px] text-[rgba(242,242,240,0.75)]">{reading.metric}</p>
          <p className={`listen-reading m-0 mt-1 font-sans font-light leading-none tracking-[-0.8px] text-[#f2f2f0] ${reading.available ? "text-[40px]" : "text-[32px]"}`}>
            {reading.value}
          </p>
          <p className="m-0 mt-1 font-mono text-[9px] tracking-[0.36px] text-[rgba(242,242,240,0.75)]">{reading.source}</p>
        </div>

        <div data-region-body="" className="min-h-0 overflow-hidden px-5 py-2">
          <div className="flex min-h-full flex-col justify-center gap-2">
            <div className="h-px w-full bg-[rgba(242,242,240,0.14)]" />
            {region.id === "nino34" && layer === "temperature" ? (
              <div className="relative h-[72px] w-full shrink-0 overflow-hidden">
                <img src="/assets/listen/spark-zero.svg" alt="" width={256} height={2} className="absolute bottom-4 left-0" />
                <img src="/assets/listen/spark-line.svg" alt="ONI example curve, 1958 to 2026" width={257} height={57} />
              </div>
            ) : null}
            <p className="m-0 font-mono text-[9px] tracking-[0.36px] text-[rgba(242,242,240,0.6)]">
              {region.id === "nino34" ? "ONI (NOAA) · 1958–2026 · EXAMPLE DATA" : "EXAMPLE · this place"}
            </p>
            <div className="h-px w-full bg-[rgba(242,242,240,0.14)]" />
            <div>
              <p className="m-0 font-mono text-[9px] tracking-[0.36px] text-[rgba(242,242,240,0.5)]">LAYERS</p>
              <div className="mt-2 grid grid-cols-2 gap-y-2">
                {ROWS.map((row) => {
                  const lit = layerLit(region, row.id);
                  return (
                    <p
                      key={row.id}
                      className={`m-0 font-mono text-[9px] tracking-[0.36px] ${lit ? "text-[#f2f2f0]" : "text-[rgba(242,242,240,0.35)]"}`}
                    >
                      <span className={`mr-1 inline-block size-[6px] ${lit ? "bg-[#f2f2f0]" : "bg-[#454545]"}`} />
                      {row.label}
                      {lit ? "" : " · NO DATA"}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div data-region-foot="" className="sticky bottom-0 bg-[#262626] px-5 pt-2 pb-2">
          <button
            type="button"
            onClick={onPlay}
            className="sonify-press pointer-events-auto flex h-8 w-full cursor-pointer items-center justify-center gap-2 border-0 font-sans text-[15px] font-medium text-[#141414]"
            style={{ clipPath: buttonClip, background: "#f2f2f0" }}
          >
            <img src="/assets/listen/play-triangle.svg" alt="" width={10} height={12} />
            Hear it
          </button>
          {soundOff && onTurnSoundOn ? <SoundOffNote onTurnOn={onTurnSoundOn} /> : null}
          <Link
            href="/challenge"
            data-place-extra=""
            className="sonify-text-link pointer-events-auto mt-1 block text-center font-mono text-[11px] tracking-[0.3px] text-[rgba(242,242,240,0.55)] no-underline hover:text-[#f2f2f0]"
          >
            Test your ear →
          </Link>
        </div>
      </div>
    </article>
  );
}

function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}`;
}

function formatLng(lng: number): string {
  return `${Math.abs(lng).toFixed(1)}°${lng >= 0 ? "E" : "W"}`;
}

/** Card for an area the listener drew: its geographic bounds. */
export function AreaCard({
  area,
  onClear,
}: Readonly<{
  area: { west: number; south: number; east: number; north: number };
  onClear: () => void;
}>) {
  const clip = chamferClip(12);
  return (
    <article
      data-region-card=""
      data-area-card=""
      className="pointer-events-none relative flex w-full max-w-full flex-col"
      style={{ clipPath: clip, background: "#f2f2f0", padding: 1 }}
    >
      <div className="px-5 pt-3 pb-3" style={{ clipPath: clip, background: "#262626" }}>
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 font-mono text-[10px] tracking-[0.4px] text-[rgba(242,242,240,0.6)]">CUSTOM AREA</p>
          <button
            type="button"
            onClick={onClear}
            className="sonify-text-link pointer-events-auto cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.4px] text-[#f2f2f0]"
          >
            Clear
          </button>
        </div>
        <p className="m-0 mt-2 font-mono text-[10px] tracking-[0.4px] text-[rgba(242,242,240,0.75)]">
          {formatLat(area.south)}–{formatLat(area.north)} · {formatLng(area.west)}–{formatLng(area.east)}
        </p>
      </div>
    </article>
  );
}
