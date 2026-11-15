"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSonifyPlayer } from "@/context/SonifyPlayerContext";
import { ABOUT_ASSETS, MINI_WAVEFORM_BARS } from "@/data/aboutData";
import type { ThemeId } from "@/data/landingData";
import { IconChevron, IconExpand, IconPlay } from "@/components/shared/Icons";

const THEME_ORDER: readonly ThemeId[] = ["co2", "temperature", "sea-ice", "methane"];

const THEME_SHORT_LABELS: Record<ThemeId, string> = {
  co2: "CO₂",
  temperature: "TEMP",
  "sea-ice": "ICE",
  methane: "CH₄",
};

const THEME_TITLES: Record<ThemeId, string> = {
  co2: "CO₂ in the air · Keeling curve",
  temperature: "Global surface temperature",
  "sea-ice": "Arctic sea ice extent",
  methane: "Atmospheric methane · CH₄",
};

const PLAY_BUTTON_CLIP = {
  clipPath:
    "polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)",
} as const;

function MiniPlayerPlayButton({
  playing,
  onToggle,
}: Readonly<{ playing: boolean; onToggle: () => void }>) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? "Pause audio" : "Play audio"}
      aria-pressed={playing}
      className="sonify-mini-play sonify-btn-primary absolute left-[12px] top-[6px] size-[44px] cursor-pointer bg-transparent border-0 p-0"
      data-name="MiniPlayer/Play"
    >
      <img
        alt=""
        className="absolute block inset-0 max-w-none size-full pointer-events-none"
        src={ABOUT_ASSETS.miniPlayButton}
      />
      {!playing && (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-[#f2f2f0] text-[#141414]"
          style={PLAY_BUTTON_CLIP}
        >
          <IconPlay />
        </span>
      )}
    </button>
  );
}

function getWaveformBarColorClass(dim: boolean | undefined, isMutedOrPaused: boolean): string {
  if (dim) return "bg-[rgba(242,242,240,0.36)]";
  if (isMutedOrPaused) return "bg-[rgba(242,242,240,0.5)]";
  return "bg-[#f2f2f0]";
}

const BARS_WITH_ID = MINI_WAVEFORM_BARS.map((bar, index) => ({
  ...bar,
  id: `waveform-bar-${index}`,
}));

function MiniPlayerWaveform({
  isMutedOrPaused,
  isSoloActive,
}: Readonly<{ isMutedOrPaused: boolean; isSoloActive: boolean }>) {
  return (
    <div
      className="sonify-mini-wave absolute top-[14px] left-[388px] h-[28px] w-[160px] overflow-clip"
      data-name="MiniPlayer/Mini waveform"
    >
      {BARS_WITH_ID.map((bar, index) => {
        const colorClass = getWaveformBarColorClass(bar.dim, isMutedOrPaused);
        const pulseScale = isSoloActive && index % 3 === 0 ? "scaleY(1.18)" : "scaleY(1)";
        return (
          <div
            key={bar.id}
            className={`absolute w-[1.5px] transition-transform duration-300 ${colorClass}`}
            style={{
              height: `${bar.h}px`,
              left: `${index * 2.5}px`,
              top: `${bar.top}px`,
              transform: pulseScale,
            }}
          />
        );
      })}
    </div>
  );
}

function MiniPlayerRightControls({
  muted,
  onToggleMuted,
}: Readonly<{ muted: boolean; onToggleMuted: () => void }>) {
  return (
    <>
      <button
        type="button"
        onClick={onToggleMuted}
        aria-label={muted ? "Unmute audio" : "Mute audio"}
        aria-pressed={muted}
        className="sonify-mini-mute sonify-btn-primary absolute top-[6px] left-[552px] size-[44px] cursor-pointer border-0 bg-transparent p-0"
        data-name="MiniPlayer/Mute"
      >
        <img
          alt=""
          className={`absolute block inset-0 max-w-none size-full pointer-events-none transition-opacity duration-200 ${
            muted ? "opacity-45" : "opacity-100"
          }`}
          src={ABOUT_ASSETS.miniMuteButton}
        />
      </button>

      <Link
        href="/listen"
        aria-label="Expand player"
        className="sonify-mini-expand sonify-text-link no-underline absolute top-[6px] left-[600px] flex size-[44px] content-stretch items-center justify-center"
        data-name="MiniPlayer/Expand"
      >
        <IconExpand className="text-[#f2f2f0]" />
      </Link>
    </>
  );
}

function MiniPlayerTrackAndTheme({
  activeTheme,
  currentReadingLabel,
  onCycleTheme,
}: Readonly<{
  activeTheme: ThemeId;
  currentReadingLabel: string;
  onCycleTheme: () => void;
}>) {
  return (
    <>
      <div
        className="sonify-mini-track absolute top-[10px] left-[68px] flex w-[208px] max-w-[calc(100%-88px)] content-stretch flex-col items-start gap-[2px] overflow-hidden whitespace-nowrap"
        data-name="MiniPlayer/Track info"
      >
        <p className="m-0 max-w-full truncate font-sans text-[15px] font-medium leading-[1.3] text-[#f2f2f0]">
          {THEME_TITLES[activeTheme]}
        </p>
        <p className="m-0 max-w-full truncate font-mono text-[12px] font-normal leading-[1.2] text-[#f2f2f0]">
          {currentReadingLabel}
        </p>
      </div>

      <button
        type="button"
        onClick={onCycleTheme}
        aria-label={`Switch theme (current: ${THEME_SHORT_LABELS[activeTheme]})`}
        className="sonify-mini-theme sonify-btn-primary absolute h-[44px] left-[280px] top-[6px] w-[96px] cursor-pointer bg-transparent border-0 p-0 text-left"
        data-name="MiniPlayer/Theme switcher"
      >
        <img
          alt=""
          className="absolute block inset-0 max-w-none size-full pointer-events-none"
          src={ABOUT_ASSETS.miniThemeSwitcherBg}
        />
        <span className="absolute font-mono font-normal leading-[1.3] left-[10px] text-[#f2f2f0] text-[11px] top-[7px] tracking-[0.44px] uppercase whitespace-nowrap">
          {THEME_SHORT_LABELS[activeTheme]}
        </span>
        <span className="absolute left-[74px] top-[9px] text-[#f2f2f0]">
          <IconChevron direction="down" />
        </span>
      </button>
    </>
  );
}

function showsPlayerOnlyWhileAudio(pathname: string): boolean {
  return pathname === "/" || pathname === "/about" || pathname === "/challenge" || pathname.startsWith("/challenge/");
}

function getMiniPlayerVisibility(pathname: string, audioActive: boolean): boolean {
  if (pathname === "/listen" || pathname.startsWith("/listen/")) return false;
  if (showsPlayerOnlyWhileAudio(pathname)) return audioActive;
  return true;
}

function MiniPlayerClose({ onClose }: Readonly<{ onClose: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close player"
      className="sonify-mini-close absolute top-[6px] left-[648px] flex size-[44px] cursor-pointer items-center justify-center border border-[#777777] bg-transparent p-0 text-[#f2f2f0]"
      style={{
        clipPath:
          "polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  );
}

export function MiniPlayerPill() {
  const pathname = usePathname();
  const {
    playing,
    muted,
    activeTheme,
    soloVoice,
    ensembleOn,
    currentReadingLabel,
    togglePlaying,
    toggleMuted,
    setActiveTheme,
    dismissPlayer,
    playerDismissed,
  } = useSonifyPlayer();

  const isVisible = !playerDismissed && getMiniPlayerVisibility(pathname, soloVoice !== null || ensembleOn);
  const isMutedOrPaused = !playing || muted;

  const cycleTheme = () => {
    const idx = THEME_ORDER.indexOf(activeTheme);
    setActiveTheme(THEME_ORDER[(idx + 1) % THEME_ORDER.length]);
  };

  return (
    <aside
      aria-label="Persistent mini-player"
      aria-hidden={!isVisible}
      inert={!isVisible}
      data-open={isVisible ? "true" : "false"}
      className={`sonify-mini-player fixed z-40 h-[56px] overflow-hidden transition-transform duration-500 ease-out ${
        isVisible ? "pointer-events-auto" : "pointer-events-none"
      }`}
      data-name="Player/Mini-player pill"
    >
      <img
        alt=""
        className="absolute block inset-0 max-w-none size-full pointer-events-none"
        src={ABOUT_ASSETS.miniPlayerBg}
      />
      <MiniPlayerPlayButton playing={playing} onToggle={togglePlaying} />
      <MiniPlayerTrackAndTheme
        activeTheme={activeTheme}
        currentReadingLabel={currentReadingLabel}
        onCycleTheme={cycleTheme}
      />
      <MiniPlayerWaveform
        isMutedOrPaused={isMutedOrPaused}
        isSoloActive={Boolean(soloVoice) && !isMutedOrPaused}
      />
      <MiniPlayerRightControls muted={muted} onToggleMuted={toggleMuted} />
      <MiniPlayerClose onClose={dismissPlayer} />
    </aside>
  );
}
