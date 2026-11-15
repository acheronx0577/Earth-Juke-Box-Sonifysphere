"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { VoiceId } from "@/context/SonifyPlayerContext";
import { useSonifyPlayer } from "@/context/SonifyPlayerContext";
import { ASSETS, type ThemeId } from "@/data/landingData";
import {
  MAP_REGIONS,
  regionById,
  type LayerId,
  type SeasonId,
  type WeatherId,
} from "@/data/exploreMap";
import { datasetById, datasetForLayer, writeDatasetParam, type DatasetId } from "@/data/datasets";
import { hushExplore, triggerExploreNote, type ExploreParams } from "@/lib/exploreAudio";
import { chamferClip } from "@/components/listen/chamfer";
import { ExploreMap, LayerChips, type CustomArea } from "@/components/listen/ExploreMap";
import { RegionConnector } from "@/components/listen/RegionConnector";
import { AreaCard, RegionCard } from "@/components/listen/RegionCard";
import { CustomizeButton, CustomizeModal } from "@/components/listen/CustomizeModal";
import { ThemeRail } from "@/components/listen/ThemeRail";
import { TimelineStrip, type YearPhase } from "@/components/listen/TimelineStrip";
import { SoundOffNote } from "@/components/shared/SoundOffNote";
import { ShareListenModal } from "@/components/listen/ShareListenModal";

const LAYER_THEME: Record<LayerId, ThemeId> = {
  temperature: "temperature",
  "sea-ice": "sea-ice",
  co2: "co2",
  methane: "methane",
};

interface SessionProps {
  readonly layer: LayerId;
  readonly season: SeasonId;
  readonly weather: WeatherId;
  readonly wind: number;
  readonly year: number;
  readonly regionId: string | null;
  readonly customArea: CustomArea | null;
  readonly onSelectArea: (area: CustomArea) => void;
  readonly onClearArea: () => void;
  readonly railOpen: boolean;
  readonly voicesOpen: boolean;
  readonly themeSheet: boolean;
  readonly onLayer: (id: LayerId) => void;
  readonly onSeason: (id: SeasonId) => void;
  readonly onWeather: (id: WeatherId) => void;
  readonly onWind: (value: number) => void;
  readonly onYear: (year: number, phase: YearPhase) => void;
  readonly onSelect: (id: string) => void;
  readonly onPlayPlace: () => void;
  readonly onShare: () => void;
  readonly onRail: () => void;
  readonly onVoices: () => void;
  readonly onThemeSheet: () => void;
  readonly onVoice: (id: VoiceId) => void;
  readonly onCustomize: () => void;
  readonly soundAsk: "voice" | "place" | "timeline" | null;
  readonly onTurnSoundOn: () => void;
}

function MapLegend({ layer }: Readonly<{ layer: LayerId }>) {
  const imagery = (
    <p className="m-0 mt-2 max-w-[220px] font-mono text-[9px] leading-[1.35] tracking-[0.36px] text-[rgba(242,242,240,0.7)]">
      Imagery: NASA GIBS Blue Marble
    </p>
  );
  if (layer !== "temperature") {
    return (
      <div className="max-w-[260px]">
        <p className="m-0 font-mono text-[9px] tracking-[0.36px] text-[rgba(242,242,240,0.7)]">
          GREY = NO DATA FOR THIS LAYER HERE
        </p>
        {imagery}
      </div>
    );
  }
  return (
    <div className="w-full font-mono text-[10px] tracking-[0.4px] text-[rgba(242,242,240,0.85)]">
      <p className="m-0 text-[9px] tracking-[0.36px] text-[rgba(242,242,240,0.5)]">TEMP ANOMALY · °C · EXAMPLE</p>
      <div className="mt-2 flex items-center gap-2">
        <span>COLDER</span>
        <span className="h-1.5 w-[72px] bg-gradient-to-r from-[#7f66cc] via-[#f6efe4] to-[#e8762e]" />
        <span>WARMER</span>
      </div>
      <p className="m-0 mt-2 text-[9px] tracking-[0.36px] text-[rgba(242,242,240,0.7)]">
        <span className="mr-2 inline-block h-1.5 w-2.5 bg-[#454545]" />
        GREY = NO DATA FOR THIS LAYER HERE
      </p>
      {imagery}
    </div>
  );
}

function PrecipLegend() {
  const rows = [
    ["#5b9bd5", "light"],
    ["#7b5ea7", "mod"],
    ["#c45c8a", "heavy"],
    ["#e8c547", "extreme"],
  ] as const;
  return (
    <div className="w-[88px] p-px" style={{ clipPath: chamferClip(10), background: "rgba(242,242,240,0.45)" }}>
      <div className="p-2.5" style={{ clipPath: chamferClip(9), background: "#262626" }}>
        <p className="m-0 font-mono text-[11px] font-medium tracking-[0.4px] text-[rgba(242,242,240,0.75)]">PRECIP</p>
        {rows.map(([color, label]) => (
          <p key={label} className="m-0 mt-1 flex items-center gap-2 font-mono text-[11px] text-[rgba(242,242,240,0.85)]">
            <span className="size-2.5" style={{ background: color }} />
            {label}
          </p>
        ))}
      </div>
    </div>
  );
}

const VOICES_PANEL_CLIP = chamferClip(10);
const VOICES_PANEL_FACE = chamferClip(9);
const VOICES_TAB_CLIP = chamferClip(8);
const VOICES_TAB_FACE = chamferClip(7);

function VoicesTab({
  open,
  onToggle,
  onVoice,
  onCustomize,
  layout,
  soundOff,
  onTurnSoundOn,
}: Readonly<{
  open: boolean;
  onToggle: () => void;
  onVoice: (id: VoiceId) => void;
  onCustomize: () => void;
  layout: "header" | "mobile";
  soundOff: boolean;
  onTurnSoundOn: () => void;
}>) {
  const horizontal = layout === "header";
  const mobile = layout === "mobile";
  return (
    <div className="relative flex items-start">
      {open && (
        <div
          className={`${horizontal ? "absolute top-[calc(100%+8px)] right-0 z-[60] min-[1000px]:top-[52px] min-[1000px]:right-[316px]" : "absolute bottom-[calc(100%+8px)] left-0 z-[60]"} w-[148px] p-px`}
          style={{ clipPath: VOICES_PANEL_CLIP, background: "#777777" }}
        >
          <div className="flex flex-col gap-2 p-3" style={{ clipPath: VOICES_PANEL_FACE, background: "#262626" }}>
            <CustomizeButton onClick={onCustomize} />
            {(["pitch", "pulse", "click"] as const).map((id) => (
              <button key={id} type="button" onClick={() => onVoice(id)} className="sonify-voice cursor-pointer border-0 bg-transparent p-0 text-left font-mono text-[11px] uppercase tracking-[0.4px] text-[#f2f2f0]">
                {id}
              </button>
            ))}
            {soundOff ? <SoundOffNote onTurnOn={onTurnSoundOn} /> : null}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label="Voices"
        className={`sonify-clip-focus sonify-voice relative cursor-pointer border-0 p-px ${horizontal ? "h-8 w-[88px]" : "h-10 w-10"}`}
        style={{ clipPath: VOICES_TAB_CLIP, background: "rgba(242,242,240,0.55)" }}
      >
        <span
          className="flex h-full w-full items-center justify-center font-mono text-[11px] tracking-[0.44px] text-[#f2f2f0]"
          style={{ clipPath: VOICES_TAB_FACE, background: "#262626" }}
        >
          {mobile ? (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M2 7v4h3l4 3V4L5 7H2Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M11 7a3 3 0 0 1 0 4m2-6a6 6 0 0 1 0 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span className="sr-only">Voices</span>
            </>
          ) : "VOICES"}
        </span>
      </button>
    </div>
  );
}

function SkipToRegions({ href }: Readonly<{ href: string }>) {
  return (
    <a href={href} className="sonify-skip-link">
      Skip to map regions
    </a>
  );
}

function ListenCanvas(props: SessionProps) {
  const preview = props.regionId ? regionById(props.regionId) : null;
  return (
    <>
      <SkipToRegions href="#listen-regions" />
      <Link href="/" aria-label="SonifySphere home" className="absolute top-[21px] left-24 z-40 hidden h-[22px] w-[124px] min-[1000px]:block">
        <img src={ASSETS.headerWordmark} alt="" width={124} height={22} />
      </Link>
      <div className="pointer-events-auto absolute top-8 right-8 z-[60] hidden min-[1000px]:block">
        <VoicesTab
          layout="header"
          open={props.voicesOpen}
          onToggle={props.onVoices}
          onVoice={props.onVoice}
          onCustomize={props.onCustomize}
          soundOff={props.soundAsk === "voice"}
          onTurnSoundOn={props.onTurnSoundOn}
        />
      </div>
      <ExploreMap
        id="listen-regions"
        fit="exact"
        layer={props.layer}
        selectedId={props.regionId}
        onSelect={props.onSelect}
        customArea={props.customArea}
        onSelectArea={props.onSelectArea}
      />

      {/* Desktop HUD */}
      <div className="pointer-events-none absolute inset-0 z-20 hidden min-[1000px]:block">
        <div className="pointer-events-none absolute top-[70px] left-16 z-20 flex flex-col gap-4">
          <div className="listen-pass pointer-events-none relative z-[35] w-max max-w-[640px]">
            <LayerChips layer={props.layer} onLayer={props.onLayer} />
          </div>
          <div className="flex min-h-0 items-center gap-2">
            <div className="listen-theme-column relative z-30 flex min-h-0 flex-col">
              <ThemeRail
                season={props.season}
                weather={props.weather}
                wind={props.wind}
                open={props.railOpen}
                dockTab={false}
                onSeason={props.onSeason}
                onWeather={props.onWeather}
                onWind={props.onWind}
                onToggle={props.onRail}
              />
            </div>
            {props.railOpen ? (
              <button
                type="button"
                onClick={props.onRail}
                aria-expanded={props.railOpen}
                aria-label="Collapse theme rail"
                className="listen-theme-dock pointer-events-auto relative z-40"
              >
                «
              </button>
            ) : null}
          </div>
        </div>
        {props.customArea ? (
          <div
            className="listen-pass pointer-events-none absolute top-[84px] right-8 z-40 flex w-[300px] min-h-0 flex-col">
            <AreaCard
              area={props.customArea}
              onClear={props.onClearArea}
            />
          </div>
        ) : preview ? (
          <div
            className="listen-pass pointer-events-none absolute top-[84px] right-8 z-40 flex w-[300px] min-h-0 flex-col"
            style={{
              height: "min(460px, calc(100vh - 340px))",
              maxHeight: "calc(100vh - 340px)",
            }}
          >
            <RegionCard
              region={preview}
              layer={props.layer}
              onPlay={props.onPlayPlace}
              onShare={props.onShare}
              soundOff={props.soundAsk === "place"}
              onTurnSoundOn={props.onTurnSoundOn}
            />
          </div>
        ) : props.soundAsk === "timeline" ? null : (
          <div
            className="pointer-events-none absolute bottom-[104px] left-1/2 z-[24] h-8 w-[262px] -translate-x-1/2 p-px"
            style={{ clipPath: chamferClip(8), background: "#777777" }}
          >
            <p
              className="m-0 flex h-full w-full items-center justify-center bg-[#262626] font-mono text-[11px] tracking-[0.02em] text-[#aaaaaa]"
              style={{ clipPath: chamferClip(7) }}
            >
              Click anywhere on the map to hear it
            </p>
          </div>
        )}
        <div className="pointer-events-auto absolute bottom-8 left-1/2 z-40 w-[min(816px,calc(100%-624px))] -translate-x-1/2">
          {props.soundAsk === "timeline" ? <SoundOffNote onTurnOn={props.onTurnSoundOn} /> : null}
          <TimelineStrip
            year={props.year}
            onYear={props.onYear}
          />
        </div>
        <div className="listen-legend listen-pass pointer-events-none z-20">
          <MapLegend layer={props.layer} />
        </div>
        <div className="listen-pass pointer-events-none absolute right-8 bottom-8 z-20">
          <PrecipLegend />
        </div>
        {props.regionId ? <RegionConnector regionId={props.regionId} /> : null}
      </div>

      {!props.regionId && !props.customArea && (
        <div
          className="pointer-events-none absolute z-[24] h-8 p-px min-[1000px]:hidden"
          style={{
            left: "var(--listen-edge)",
            right: "var(--listen-edge)",
            bottom: "var(--listen-edge)",
            clipPath: chamferClip(8),
            background: "#777777",
          }}
        >
          <p
            className="m-0 flex h-full w-full items-center justify-center bg-[#262626] font-mono text-[11px] tracking-[0.02em] text-[#aaaaaa]"
            style={{ clipPath: chamferClip(7) }}
          >
            Tap anywhere on the map to hear it
          </p>
        </div>
      )}

      {/* Mobile HUD Controls */}
      <div className="listen-mobile-controls pointer-events-none min-[1000px]:hidden">
        <div className="pointer-events-auto listen-voices-launcher">
          <VoicesTab
            layout="mobile"
            open={props.voicesOpen}
            onToggle={props.onVoices}
            onVoice={props.onVoice}
            onCustomize={props.onCustomize}
            soundOff={props.soundAsk === "voice"}
            onTurnSoundOn={props.onTurnSoundOn}
          />
        </div>

        {props.themeSheet && (
          <div className="listen-theme-sheet pointer-events-auto">
            <p className="m-0 font-mono text-[11px] tracking-[0.36px] text-[rgba(242,242,240,0.7)]">YEAR</p>
            <div className="mt-2">
              {props.soundAsk === "timeline" ? <SoundOffNote onTurnOn={props.onTurnSoundOn} /> : null}
              <TimelineStrip
                year={props.year}
                onYear={props.onYear}
              />
            </div>
            <p className="m-0 mt-4 min-w-0 max-w-[260px] font-mono text-[11px] tracking-[0.36px] text-[rgba(242,242,240,0.55)]">
              ILLUSTRATIVE PRESETS · NOT LIVE DATA
            </p>
            <div className="mt-4">
              <LayerChips layer={props.layer} onLayer={props.onLayer} />
            </div>
            <div className="mt-4">
              <ThemeRail
                fluid
                season={props.season}
                weather={props.weather}
                wind={props.wind}
                open={props.railOpen}
                onSeason={props.onSeason}
                onWeather={props.onWeather}
                onWind={props.onWind}
                onToggle={props.onRail}
              />
            </div>
            <div className="mt-4">
              <MapLegend layer={props.layer} />
            </div>
          </div>
        )}

        <button
          type="button"
          className="listen-theme-launcher pointer-events-auto p-px"
          aria-expanded={props.themeSheet}
          aria-label={props.themeSheet ? "Close theme controls" : "Open theme controls"}
          onClick={props.onThemeSheet}
          style={{
            clipPath: chamferClip(8),
            background: props.themeSheet ? "#f2f2f0" : "#777777",
          }}
        >
          <span
            className="flex h-full w-full items-center justify-center gap-2 bg-[#262626] font-mono text-[11px] tracking-[0.08em] text-[#aaaaaa]"
            style={{ clipPath: chamferClip(7) }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M1 3.5h12M1 7h12M1 10.5h12" fill="none" stroke="#aaaaaa" strokeWidth="1.25" />
            </svg>
            THEME
          </span>
        </button>

        {props.customArea ? (
          <div className="listen-place-sheet">
            <AreaCard
              area={props.customArea}
              onClear={props.onClearArea}
            />
          </div>
        ) : null}
        {preview && !props.customArea && (
          <div className="listen-place-sheet">
            <RegionCard
              region={preview}
              layer={props.layer}
              onPlay={props.onPlayPlace}
              onShare={props.onShare}
              soundOff={props.soundAsk === "place"}
              onTurnSoundOn={props.onTurnSoundOn}
            />
          </div>
        )}
      </div>
    </>
  );
}

export function ListenExplore({
  initialSound,
  initialData,
}: Readonly<{ initialSound: "on" | "off" | null; initialData: DatasetId | null }>) {
  const { setActiveTheme, stopEnsemble, playSoloVoice, setSoundEnabled, soundOn, muted, isSoundOn } = useSonifyPlayer();
  const [soundAsk, setSoundAsk] = useState<"voice" | "place" | "timeline" | null>(null);
  const pendingVoice = useRef<VoiceId | null>(null);
  const pendingYear = useRef<number | null>(null);
  const starting = datasetById(initialData);
  const [layer, setLayer] = useState<LayerId>(starting?.layer ?? "temperature");
  const [season, setSeason] = useState<SeasonId>("summer");
  const [weather, setWeather] = useState<WeatherId>("clear");
  const [wind, setWind] = useState(28);
  const [year, setYear] = useState(2026);
  const [regionId, setRegionId] = useState<string | null>(initialData ? "nino34" : null);
  const [shareOpen, setShareOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [voicesOpen, setVoicesOpen] = useState(false);
  const [themeSheet, setThemeSheet] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customArea, setCustomArea] = useState<CustomArea | null>(null);
  const yearRef = useRef(year);
  const activeRegion = regionId ? regionById(regionId) : regionById("nino34");
  const paramsRef = useRef<ExploreParams>({
    layer,
    season,
    weather,
    wind,
    year,
    note: activeRegion.note,
  });

  paramsRef.current = {
    layer,
    season,
    weather,
    wind,
    year: yearRef.current,
    note: activeRegion.note,
  };

  useLayoutEffect(() => {
    if (initialSound === "off") setSoundEnabled(false);
    else if (initialSound === "on") setSoundEnabled(true);
  }, [initialSound, setSoundEnabled]);

  useEffect(() => {
    stopEnsemble();
  }, [stopEnsemble]);


  useEffect(() => {
    setActiveTheme(LAYER_THEME[layer]);
  }, [layer, setActiveTheme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const region = params.get("region") ?? params.get("place");
    if (region && MAP_REGIONS.some((item) => item.id === region)) {
      setRegionId(region);
    } else if (params.get("data")) {
      setRegionId("nino34");
    }
    const data = params.get("data");
    if (data === "co2") setLayer("co2");
    else if (data === "ch4") setLayer("methane");
    else if (data === "temp") setLayer("temperature");
    const theme = params.get("theme");
    if (theme === "spring" || theme === "summer" || theme === "fall" || theme === "winter") setSeason(theme);
  }, []);

  const closePlace = useCallback(() => {
    setRegionId(null);
    setCustomArea(null);
    hushExplore();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (regionId || customArea)) closePlace();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePlace, regionId, customArea]);

  const begin = useCallback(() => {
    stopEnsemble();
    yearRef.current = paramsRef.current.year;
    void triggerExploreNote(paramsRef.current);
  }, [stopEnsemble]);

  const playVoice = useCallback((id: VoiceId) => {
    hushExplore();
    playSoloVoice(id);
  }, [playSoloVoice]);

  const turnSoundOn = useCallback(() => {
    const kind = soundAsk;
    const voice = pendingVoice.current;
    setSoundEnabled(true);
    setSoundAsk(null);
    if (kind === "voice" && voice) playVoice(voice);
    else if (kind === "place") begin();
    else if (kind === "timeline") {
      const year = pendingYear.current ?? yearRef.current;
      stopEnsemble();
      void triggerExploreNote({ ...paramsRef.current, year });
    }
  }, [begin, playVoice, setSoundEnabled, soundAsk, stopEnsemble]);

  useEffect(() => {
    if (initialSound !== "on") return;
    const start = () => begin();
    window.addEventListener("pointerdown", start, { once: true });
    return () => window.removeEventListener("pointerdown", start);
  }, [begin, initialSound]);

  const soundRef = useRef({ on: soundOn, muted });
  soundRef.current = { on: soundOn, muted };
  const pendingNote = useRef<number | null>(null);
  const noteTimer = useRef<number | null>(null);

  const flushNote = useCallback(() => {
    const next = pendingNote.current;
    pendingNote.current = null;
    if (next === null) return;
    if (!soundRef.current.on || soundRef.current.muted) return;
    void triggerExploreNote({ ...paramsRef.current, year: next });
  }, []);

  useEffect(() => {
    if (soundOn) setSoundAsk(null);
  }, [soundOn]);

  useEffect(() => {
    return () => {
      if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    };
  }, []);

  const onYear = (next: number, phase: YearPhase) => {
    const clamped = Math.min(2026, Math.max(1958, Math.round(next)));
    if (yearRef.current !== clamped) {
      yearRef.current = clamped;
      setYear(clamped);
    }
    if (!soundRef.current.on) {
      pendingYear.current = clamped;
      setSoundAsk("timeline");
      return;
    }
    if (soundRef.current.muted) return;
    pendingNote.current = clamped;
    const immediate = phase === "commit";
    if (immediate) {
      if (noteTimer.current !== null) {
        window.clearTimeout(noteTimer.current);
        noteTimer.current = null;
      }
      flushNote();
      return;
    }
    if (noteTimer.current !== null) return;
    noteTimer.current = window.setTimeout(() => {
      noteTimer.current = null;
      flushNote();
    }, 140);
  };

  const onLayer = (id: LayerId) => {
    setLayer(id);
    const next = datasetForLayer(id);
    if (next) writeDatasetParam(next.id);
  };

  const session: SessionProps = {
    layer,
    season,
    weather,
    wind,
    year,
    regionId,
    railOpen,
    voicesOpen,
    themeSheet,
    onLayer,
    onSeason: setSeason,
    onWeather: setWeather,
    onWind: setWind,
    onYear,
    onSelect: (id) => {
      setCustomArea(null);
      setRegionId(id);
    },
    customArea,
    onSelectArea: (area) => {
      setRegionId(null);
      setCustomArea(area);
    },
    onClearArea: closePlace,
    onPlayPlace: () => {
      if (!isSoundOn()) {
        setSoundAsk("place");
        return;
      }
      setSoundAsk(null);
      begin();
    },
    onShare: () => setShareOpen(true),
    onRail: () => setRailOpen((open) => !open),
    onVoices: () => setVoicesOpen((open) => !open),
    onThemeSheet: () => setThemeSheet((open) => !open),
    onVoice: (id) => {
      if (!isSoundOn()) {
        pendingVoice.current = id;
        setSoundAsk("voice");
        return;
      }
      setSoundAsk(null);
      playVoice(id);
    },
    onCustomize: () => setCustomizeOpen(true),
    soundAsk,
    onTurnSoundOn: turnSoundOn,
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-card-open={regionId || customArea ? "true" : "false"}
      className="listen-stage relative h-screen w-full overflow-hidden bg-[#141414] text-[#f2f2f0]"
    >
      {shareOpen && regionId ? (
        <ShareListenModal
          regionId={regionId}
          regionName={regionById(regionId).name}
          layer={layer}
          season={season}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
      <h1 className="sr-only">Explore the map</h1>
      <ListenCanvas {...session} />
      {customizeOpen ? <CustomizeModal onClose={() => setCustomizeOpen(false)} /> : null}
    </main>
  );
}
