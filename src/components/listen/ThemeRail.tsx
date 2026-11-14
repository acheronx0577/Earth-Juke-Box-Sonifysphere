"use client";

import { useId } from "react";
import { SEASONS, WEATHER, type SeasonId, type WeatherId } from "@/data/exploreMap";
import { chamferClip } from "@/components/listen/chamfer";

interface ThemeRailProps {
  readonly season: SeasonId;
  readonly weather: WeatherId;
  readonly wind: number;
  readonly fluid?: boolean;
  readonly open: boolean;
  /** When false, the desktop edge control is rendered by the parent, outside any scaled scroller. */
  readonly dockTab?: boolean;
  readonly onSeason: (id: SeasonId) => void;
  readonly onWeather: (id: WeatherId) => void;
  readonly onWind: (value: number) => void;
  readonly onToggle: () => void;
}

function GlobeMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="#f2f2f0" strokeWidth="1" />
      <ellipse cx="8" cy="8" rx="2.6" ry="6.25" fill="none" stroke="#f2f2f0" strokeWidth="1" />
      <path d="M2 8h12M3.4 5.2h9.2M3.4 10.8h9.2" fill="none" stroke="#f2f2f0" strokeWidth="1" />
    </svg>
  );
}

const THEME_TAB_CLIP =
  "polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)";
const THEME_TAB_FACE =
  "polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px)";

function ThemeTab({ open, onToggle }: { readonly open: boolean; readonly onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? "Collapse theme rail" : "Open theme rail"}
      className="pointer-events-auto h-[200px] w-11 shrink-0 cursor-pointer border-0 p-px"
      style={{ clipPath: THEME_TAB_CLIP, background: "#f2f2f0" }}
    >
      <span
        className="flex h-full w-full flex-col items-center justify-between py-3"
        style={{ clipPath: THEME_TAB_FACE, background: "#262626" }}
      >
        <span aria-hidden="true" className="font-mono text-[13px] leading-none text-[#f2f2f0]">
          »
        </span>
        <span className="font-mono text-[11px] tracking-[0.18em] text-[#f2f2f0] [writing-mode:vertical-rl] rotate-180">
          THEME
        </span>
        <GlobeMark />
      </span>
    </button>
  );
}

function PhotoFrame({
  src,
  alt,
  chamfer,
  selected,
  className,
  label,
}: Readonly<{
  src: string;
  alt: string;
  chamfer: number;
  selected?: boolean;
  className: string;
  label?: string;
}>) {
  const clip = chamferClip(chamfer);
  return (
    <div className={className} style={{ clipPath: clip, background: selected ? "#f2f2f0" : "transparent", padding: selected ? 1 : 0 }}>
      <div className="relative h-full w-full" style={{ clipPath: clip }}>
        <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
        {label && (
          <span className="absolute bottom-2 left-2 font-sans text-[11px] font-semibold text-[#f2f2f0]">{label}</span>
        )}
      </div>
    </div>
  );
}

export function ThemeRail({
  season,
  weather,
  wind,
  fluid = false,
  open,
  dockTab = true,
  onSeason,
  onWeather,
  onWind,
  onToggle,
}: ThemeRailProps) {
  const selected = SEASONS.find((item) => item.id === season) ?? SEASONS[1];
  const shell = chamferClip(14);
  const windId = useId();

  return (
    <div className={`listen-theme-panel pointer-events-none relative ${fluid ? "w-full" : open ? "listen-theme-panel-open w-[288px]" : "w-11"}`}>
      {open && (
        <div className="pointer-events-auto" style={{ clipPath: shell, background: "#777777", padding: 1 }}>
          <div className="listen-theme-content flex flex-col gap-2.5 p-3" style={{ clipPath: shell, background: "#262626" }}>
            <p className="m-0 font-sans text-[12px] font-semibold text-[#f2f2f0]">THEME · selected</p>
            <PhotoFrame
              src={selected.hero ?? selected.still}
              alt={`${selected.label} Earth, North America`}
              chamfer={14}
              className={fluid ? "listen-theme-hero h-[140px] w-full" : "listen-theme-hero h-[112px] w-[264px]"}
              label={`${selected.label} · ${selected.month}`}
            />
            <p className="m-0 font-sans text-[11px] font-medium text-[#aaaaaa]">SEASON</p>
            <div className="grid grid-cols-2 gap-2">
              {SEASONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSeason(item.id)}
                  aria-pressed={item.id === season}
                  className="sonify-clip-focus pointer-events-auto cursor-pointer border-0 bg-transparent p-0 text-left"
                >
                  <PhotoFrame
                    src={item.still}
                    alt={item.label}
                    chamfer={12}
                    selected={item.id === season}
                    className={fluid ? "listen-theme-season aspect-[128/92] w-full" : "listen-theme-season h-[92px] w-[128px]"}
                    label={item.label}
                  />
                </button>
              ))}
            </div>
            <p className="m-0 font-sans text-[11px] font-medium text-[#aaaaaa]">WEATHER</p>
            <div className="listen-theme-weather flex gap-2">
              {WEATHER.map((item) => {
                const selectedChip = item.id === weather;
                const clip = chamferClip(10);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onWeather(item.id)}
                    aria-pressed={selectedChip}
                    className="sonify-clip-focus pointer-events-auto h-[54px] w-[60px] cursor-pointer border-0 p-px"
                    style={{ clipPath: clip, background: selectedChip ? "#f2f2f0" : "#777777" }}
                  >
                    <span
                      className="flex h-full w-full flex-col items-center justify-center gap-0.5"
                      style={{ clipPath: clip, background: "#262626" }}
                    >
                      <img src={item.icon} alt="" width={22} height={22} />
                      <span className={`font-sans text-[11px] font-semibold ${selectedChip ? "text-[#f2f2f0]" : "text-[#aaaaaa]"}`}>
                        {item.label}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <label htmlFor={windId} className="m-0 font-sans text-[11px] font-medium text-[#aaaaaa]">
                WIND SOUND
              </label>
              <p className="m-0 font-sans text-[11px] text-[#f2f2f0]">{wind}%</p>
            </div>
            <input
              id={windId}
              className="listen-wind pointer-events-auto"
              style={{ ["--wind" as string]: `${wind}%` }}
              type="range"
              min={0}
              max={100}
              value={wind}
              aria-label="WIND"
              aria-valuetext={`${wind} percent wind sound, from calm to gale`}
              onChange={(event) => onWind(Number(event.target.value))}
            />
            <div className="flex justify-between font-sans text-[11px] text-[#aaaaaa]">
              <span>calm</span>
              <span>gale</span>
            </div>
          </div>
        </div>
      )}
      {!open ? (
        <ThemeTab open={open} onToggle={onToggle} />
      ) : fluid ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? "Collapse theme rail" : "Open theme rail"}
          className="sonify-cut-shell pointer-events-auto mt-3 w-full max-w-full"
          style={{ clipPath: shell }}
        >
          <span className="sonify-cut-face font-mono text-[12px] uppercase tracking-[0.12em]" style={{ clipPath: shell }}>
            {open ? "Collapse theme" : "Open theme"}
          </span>
        </button>
      ) : dockTab ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? "Collapse theme rail" : "Open theme rail"}
          className="listen-theme-dock pointer-events-auto absolute top-1/2 -right-12 h-11 w-11 -translate-y-1/2 cursor-pointer border-0 p-0 font-mono text-[16px] font-bold text-[#f2f2f0]"
        >
          {open ? "«" : "»"}
        </button>
      ) : null}
    </div>
  );
}
