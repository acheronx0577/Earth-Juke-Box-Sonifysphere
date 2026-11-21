"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useSonifyPlayer } from "@/context/SonifyPlayerContext";
import { onPlaybackStopped } from "@/lib/playbackGate";
import { legendFromMetadata, type LegendModel } from "@/components/listen/v4/legend";
import { EIC_FRAME_IMAGE, EIC_FRAME_SOURCE, EIC_FRAME_STATUS } from "@/components/listen/v4/eicSource";
import { ListenMap } from "@/components/listen/v4/ListenMap";
import { frequencyForValue, layerTimbreFor, noteNameForFrequency } from "@/components/listen/v4/audioMapping";
import { MAP_REGIONS } from "@/data/exploreMap";
import { REGION_SHAPES } from "@/components/listen/regionGeometry";
import {
  CURATED_SOURCE_IDS,
  EXTRA_LAYERS,
  INSTRUMENTS,
  MAP_SOURCE,
  PRIMARY_LAYERS,
  SEED_SEARCHES,
  SEED_SOURCES,
  STYLES,
  VARIATIONS,
  YEAR_END,
  YEAR_START,
  dateLabel,
  formatCoord,
  hearTitle,
  layerLabel,
  legendMetaFor,
  paramForLayer,
  placeMatch,
  readProbe,
  type InstrumentId,
  type LayerId,
  type ListenSource,
  type PitchMode,
  type SearchRecord,
  type SoundStyle,
  type VariationId,
} from "@/components/listen/v4/model";
import { createLatestRequest, isAbortError } from "@/components/listen/v4/latestRequest";
import { startProbeAudio, stopProbeAudio, updateProbeAudio, useProbeAudioBinding, type HearingParams } from "@/components/listen/v4/probeAudio";
import { LISTEN_UPLOAD_ACCEPT, validateListenUpload } from "@/lib/listen/uploadValidation";
import { probeInstant, readingContextsMatch, type ReadingContext, type TaggedReading } from "@/components/listen/v4/readingContext";
import { elevationValueLabel, precipitationDetail, precipitationValueLabel } from "@/components/listen/v4/layerRange";
import { formatUtcInstant, isNoDataResponse } from "@/components/listen/v4/utcLabel";
import { WakeSlider } from "@/components/listen/v4/WakeSlider";
import { proximityMix, type ListeningFocus } from "@/components/listen/v4/proximityAudio";
import { ChamferMark } from "@/components/listen/ChamferMark";
import "./listen-v4.css";

const HISTORY_KEY = "sonifysphere-listen-v4";
const PROFILE_KEY = "sonifysphere-listen-v4-profiles";

const MAP_SCAN_POINTS = MAP_REGIONS.map((region) => {
  const coordinates = region.id === "nino34"
    ? region.center
    : REGION_SHAPES.find((shape) => shape.id === region.id)?.label ?? region.center;
  return { id: region.id, name: region.name, lng: coordinates[0], lat: coordinates[1] };
}).sort((a, b) => a.lng - b.lng);

interface NasaHit {
  id: string;
  title: string;
  mediaType: "image" | "video";
  preview: string;
  date: string | null;
  center: string;
  description: string;
}

interface SavedProfile {
  id: string;
  name: string;
  layer: LayerId;
  style: SoundStyle;
  instrument: InstrumentId;
  variation: VariationId;
  pitchMode?: PitchMode;
  ambience?: boolean;
  volume: number;
  tempo: number;
  year: number;
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.2 10.2 L13 13" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function PlayGlyph({ stop = false }: { readonly stop?: boolean }) {
  return stop ? (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="currentColor" />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 1.2 L10.5 6 L2 10.8 Z" fill="currentColor" />
    </svg>
  );
}

function Chevron({ up = false }: { readonly up?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ transform: up ? "rotate(180deg)" : undefined }}>
      <path d="M2 5 L7 10 L12 5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function MapThumb() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" fill="#1a120f" />
      <ellipse cx="20" cy="22" rx="16" ry="10" fill="#8a6248" />
      <rect x="16" y="18" width="10" height="4" fill="#e08a3c" />
    </svg>
  );
}

function Thumb({ source }: { readonly source: ListenSource }) {
  return (
    <span className="lv-thumb lv-cut" aria-hidden="true">
      <ChamferMark />
      {source.kind === "map" || source.kind === "search" ? <MapThumb /> : source.preview ? <img src={source.preview} alt="" /> : <MapThumb />}
      {source.kind === "video" ? (
        <>
          <span className="lv-play-badge">
            <PlayGlyph />
          </span>
          <span className="lv-thumb-badge">{source.duration ?? "0:48"}</span>
        </>
      ) : null}
    </span>
  );
}

function Chip({
  pressed,
  children,
  onClick,
  dashed = false,
  label,
  holdScroll = false,
}: {
  readonly pressed: boolean;
  readonly children: string;
  readonly onClick: () => void;
  readonly dashed?: boolean;
  readonly label?: string;
  /** A mouse click should not slide the chip row to reveal this button. */
  readonly holdScroll?: boolean;
}) {
  return (
    <button
      type="button"
      className={`lv-chip lv-cut ${pressed ? "is-on" : ""} ${dashed ? "is-more" : ""}`}
      aria-pressed={pressed}
      aria-label={label}
      onMouseDown={holdScroll ? (event) => {
        const row = event.currentTarget.parentElement;
        if (!row) return;
        const left = row.scrollLeft;
        requestAnimationFrame(() => {
          row.scrollLeft = left;
        });
      } : undefined}
      onClick={onClick}
    >
      <ChamferMark />
      {children}
    </button>
  );
}

const LEGACY_SEARCH_IDS = new Set<string>([
  "ocean-currents",
  "carbon-dioxide",
  "arctic-ice",
  "hilary-2023",
  "canada-smoke-2023",
]);

function sanitizeSavedSearches(raw: unknown): SearchRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is SearchRecord => Boolean(item && !LEGACY_SEARCH_IDS.has(item.id)));
}

function sanitizeSavedSources(raw: unknown, current: readonly ListenSource[]): ListenSource[] {
  if (!Array.isArray(raw)) return [...current];
  const extras = raw.filter(
    (item): item is ListenSource =>
      Boolean(item && item.id !== "reef-example" && !CURATED_SOURCE_IDS.has(item.id) && !current.some((seed) => seed.id === item.id))
  );
  return [...extras, ...current].slice(0, 20);
}

function SourceItem({
  item,
  activeId,
  onOpen,
}: {
  readonly item: ListenSource;
  readonly activeId: string;
  readonly onOpen: (source: ListenSource) => void;
}) {
  return (
    <button
      type="button"
      className="lv-hist lv-cut"
      aria-current={item.id === activeId ? "true" : undefined}
      onClick={() => onOpen(item)}
    >
      <ChamferMark />
      <span className="lv-hist-face">
        <Thumb source={item} />
        <span className="lv-hist-copy">
          <strong>
            <span className="lv-kind">{item.eyebrow}</span>
            <span className="lv-hist-title">{item.title}</span>
          </strong>
          <small>{item.meta}</small>
        </span>
      </span>
    </button>
  );
}

function HistoryList({
  sources,
  searches,
  activeId,
  onOpen,
  onSearch,
  onNew,
  onClearHistory,
  drawer,
  onClose,
  closeRef,
}: {
  readonly sources: readonly ListenSource[];
  readonly searches: readonly SearchRecord[];
  readonly activeId: string;
  readonly onOpen: (source: ListenSource) => void;
  readonly onSearch: (term: string) => void;
  readonly onNew: () => void;
  readonly onClearHistory?: () => void;
  readonly drawer?: boolean;
  readonly onClose?: () => void;
  readonly closeRef?: RefObject<HTMLButtonElement | null>;
}) {
  const userSources = sources.filter((item) => !CURATED_SOURCE_IDS.has(item.id));
  const nasaSources = sources.filter((item) => CURATED_SOURCE_IDS.has(item.id));
  const userItemsCount = userSources.length + searches.length;

  return (
    <>
      {drawer ? (
        <div className="lv-drawer-head lv-drawer-only">
          <div>
            <p className="lv-mono lv-eyebrow">
              HISTORY · {userItemsCount > 0 ? `${userItemsCount} RECENT` : "0 RECENT"}
            </p>
            <p className="lv-title">Data sources</p>
          </div>
          <div className="lv-drawer-actions">
            {userItemsCount > 0 && onClearHistory ? (
              <button
                type="button"
                className="lv-clear-btn"
                onClick={onClearHistory}
                aria-label="Clear recent user history"
              >
                CLEAR
              </button>
            ) : null}
            <button ref={closeRef} type="button" className="lv-icon-btn lv-cut" aria-label="Close history" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
      ) : (
        <div className="lv-history-desktop-head">
          <p className="lv-mono lv-eyebrow">HISTORY</p>
          {userItemsCount > 0 && onClearHistory ? (
            <button
              type="button"
              className="lv-clear-btn"
              onClick={onClearHistory}
              aria-label="Clear recent user history"
            >
              CLEAR
            </button>
          ) : null}
        </div>
      )}
      <button type="button" className="lv-new lv-cut" aria-describedby="lv-upload-note" onClick={onNew}>
        <ChamferMark />
        + New source
      </button>
      <p id="lv-upload-note" className="lv-upload-note">
        JPEG, PNG, or WebP up to 25 MB · MP4 or WebM up to 100 MB and 15 minutes
      </p>

      {userSources.length > 0 ? (
        <>
          <p className="lv-mono lv-eyebrow lv-section">YOUR UPLOADS & RECENT</p>
          <div className="lv-list">
            {userSources.map((item) => (
              <SourceItem key={item.id} item={item} activeId={activeId} onOpen={onOpen} />
            ))}
          </div>
        </>
      ) : null}

      <p className="lv-mono lv-eyebrow lv-section">NASA SOURCES</p>
      <div className="lv-list">
        {nasaSources.map((item) => (
          <SourceItem key={item.id} item={item} activeId={activeId} onOpen={onOpen} />
        ))}
      </div>

      {searches.length > 0 ? (
        <>
          <p className="lv-mono lv-eyebrow lv-section">RECENT SEARCHES</p>
          <div className="lv-list">
            {searches.map((item) => (
              <button type="button" key={item.id} className="lv-hist lv-cut" onClick={() => onSearch(item.term)}>
                <ChamferMark />
                <span className="lv-hist-face">
                  <span className="lv-search-glyph lv-cut" aria-hidden="true">
                    <ChamferMark />
                    <SearchIcon />
                  </span>
                  <span className="lv-hist-copy">
                    <strong>
                      <span className="lv-find">FIND </span>
                      <span className="lv-hist-title">{item.term}</span>
                    </strong>
                    {item.detail ? <small>{item.detail}</small> : null}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

function SoundFields({
  compact,
  styleId,
  instrument,
  variation,
  pitchMode,
  ambience,
  scanAvailable,
  scanning,
  volume,
  tempo,
  onStyle,
  onInstrument,
  onVariation,
  onPitchMode,
  onAmbience,
  onScan,
  onVolume,
  onTempo,
}: {
  readonly compact: boolean;
  readonly styleId: SoundStyle;
  readonly instrument: InstrumentId;
  readonly variation: VariationId;
  readonly pitchMode: PitchMode;
  readonly ambience: boolean;
  readonly scanAvailable: boolean;
  readonly scanning: boolean;
  readonly volume: number;
  readonly tempo: number;
  readonly onStyle: (id: SoundStyle) => void;
  readonly onInstrument: (id: InstrumentId) => void;
  readonly onVariation: (id: VariationId) => void;
  readonly onPitchMode: (id: PitchMode) => void;
  readonly onAmbience: () => void;
  readonly onScan: () => void;
  readonly onVolume: (value: number) => void;
  readonly onTempo: (value: number) => void;
}) {
  return (
    <>
      <div className="lv-field">
        <p className="lv-mono lv-eyebrow">SOUND STYLE · ORCHESTRA ADDS ~4 MB</p>
        <div className="lv-chip-grid" role="group" aria-label="Sound style">
          {STYLES.map((item) => (
            <Chip key={item.id} pressed={styleId === item.id} onClick={() => onStyle(item.id)}>
              {item.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="lv-field">
        <p className="lv-mono lv-eyebrow">INSTRUMENT</p>
        <div className="lv-chip-grid" role="group" aria-label="Instrument">
          {INSTRUMENTS.map((item) => item.id === "strings" ? null : (
            <Chip key={item.id} pressed={instrument === item.id} onClick={() => onInstrument(item.id)}>
              {item.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="lv-field">
        <p className="lv-mono lv-eyebrow">VARIATION</p>
        <div className="lv-chip-grid" role="group" aria-label="Variation">
          {VARIATIONS.map((item) => (
            <Chip key={item.id} pressed={variation === item.id} onClick={() => onVariation(item.id)}>
              {item.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="lv-field">
        <p className="lv-mono lv-eyebrow">PITCH MAPPING</p>
        <div className="lv-chip-grid lv-pitch-mode" role="group" aria-label="Pitch mapping">
          <Chip pressed={pitchMode === "continuous"} onClick={() => onPitchMode("continuous")}>CONTINUOUS</Chip>
          <Chip pressed={pitchMode === "pentatonic"} onClick={() => onPitchMode("pentatonic")}>PENTATONIC</Chip>
        </div>
      </div>
      <div className="lv-field">
        <p className="lv-mono lv-eyebrow">AMBIENT BED</p>
        <div className="lv-chip-grid lv-ambience-toggle" role="group" aria-label="Ambient bed">
          <Chip pressed={ambience} onClick={onAmbience}>{ambience ? "ON" : "OFF"}</Chip>
        </div>
      </div>
      {scanAvailable ? (
        <div className="lv-field lv-scan-field">
          <p className="lv-mono lv-eyebrow">SPATIAL MAP SCAN</p>
          <button type="button" className="lv-map-scan lv-cut" aria-pressed={scanning} onClick={onScan}>
            <ChamferMark />
            {scanning ? "STOP SCAN" : "SCAN WEST → EAST"}
          </button>
          <small className="lv-scan-note">12 regional example points · stereo follows the visible map</small>
        </div>
      ) : null}
      <WakeSlider label="VOLUME" min={0} max={100} step={1} value={volume} text={`${Math.round(volume)}%`} compact={compact} onChange={onVolume} />
      <WakeSlider
        label="MOTION"
        min={0.5}
        max={2}
        step={0.1}
        value={tempo}
        text={`${Number(tempo.toFixed(1))}×`}
        compact={compact}
        onChange={onTempo}
      />
    </>
  );
}

function AudioKey({
  layer,
  year,
  source,
  reading,
  styleId,
  instrument,
  variation,
  pitchMode,
  ambience,
  pan,
  tempo,
}: {
  readonly layer: LayerId;
  readonly year: number;
  readonly source: ListenSource;
  readonly reading: ReturnType<typeof readProbe>;
  readonly styleId: SoundStyle;
  readonly instrument: InstrumentId;
  readonly variation: VariationId;
  readonly pitchMode: PitchMode;
  readonly ambience: boolean;
  readonly pan: number;
  readonly tempo: number;
}) {
  const activeId = layer === "all" ? "visual" : layer;
  const active = reading.cards.find((card) => card.id === activeId);
  const toneLabel = (value: number) => {
    const frequency = frequencyForValue(value, variation, pitchMode);
    if (frequency === null) return "Silent";
    return pitchMode === "pentatonic"
      ? `${noteNameForFrequency(frequency)} · ${Math.round(frequency)} Hz`
      : `${Math.round(frequency)} Hz`;
  };
  const currentFrequency = frequencyForValue(reading.normalized, variation, pitchMode);
  const currentTone = currentFrequency === null
    ? "Silent · no matched data"
    : pitchMode === "pentatonic"
      ? `${noteNameForFrequency(currentFrequency)} · ${Math.round(currentFrequency)} Hz`
      : `${Math.round(currentFrequency)} Hz`;
  const timbre = styleId === "orchestra" || instrument === "strings"
    ? "sustained synthesized string ensemble"
    : instrument === "marimba"
      ? "sustained mallet resonance"
      : instrument === "woodblock"
        ? "sustained woody resonance"
        : layerTimbreFor(layer).label;
  const panPosition = Math.abs(pan) < 0.01 ? "center" : `${pan < 0 ? "left" : "right"} ${Math.round(Math.abs(pan) * 100)}%`;

  return (
    <details className="lv-audio-key">
      <summary>Audio Key</summary>
      <div className="lv-audio-key-body">
        <p className="lv-audio-key-context">
          {active?.value ?? "No matched data"} · {active?.detail ?? `${source.meta} · ${dateLabel(year)}`}
        </p>
        <div className="lv-audio-key-points" aria-label="Pitch mapping">
          {[0, 0.5, 1].map((value) => (
            <p className="lv-audio-key-point" key={value}>
              <span>{value * 100}%</span>
              <strong>{toneLabel(value)}</strong>
            </p>
          ))}
        </div>
        <p>Higher normalized values raise pitch and gently increase intensity. Current sound: {currentTone}. Mapping: {pitchMode === "pentatonic" ? "C-major pentatonic" : "continuous"}.</p>
        <p>Continuous, sustained sound with smooth pitch changes. Timbre: {timbre}. Motion: {Number(tempo.toFixed(1))}×. {ambience ? "The lower-octave bed and spacious reverb are on." : "The lower-octave bed is quiet and reverb is reduced."}</p>
        <p>Stereo position follows the probe within the visible area · {panPosition}. Zooming in brings nearby sound forward with clearer detail and less reverb; distant and offscreen points fade. Zooming out restores a wider, softer sound. Pitch continues to follow the selected data.</p>
        {source.kind === "map" ? <p>The regional scan uses example data, not live measurements.</p> : null}
      </div>
    </details>
  );
}

function Timeline({ year, onYear }: { readonly year: number; readonly onYear: (year: number) => void }) {
  const readoutId = useId();
  const ticksRef = useRef<HTMLDivElement>(null);
  const span = YEAR_END - YEAR_START;
  const ticks = Array.from({ length: span + 1 }, (_, index) => YEAR_START + index);
  const ratio = (year - YEAR_START) / span;
  const [sparse, setSparse] = useState(false);
  useLayoutEffect(() => {
    const root = ticksRef.current;
    if (!root) return;
    const measure = () => {
      const sample = root.querySelector("b");
      const trackWidth = root.getBoundingClientRect().width;
      if (!sample || trackWidth <= 0) return;
      const labelWidth = sample.getBoundingClientRect().width;
      const spacing = (10 / span) * trackWidth;
      const at = (value: number) => ((value - YEAR_START) / span) * trackWidth;
      const decades: number[] = [];
      for (let value = Math.ceil(YEAR_START / 10) * 10; value <= YEAR_END; value += 10) decades.push(value);
      const boxes = decades.map((value) => {
        const pos = at(value);
        if (value === 1960) return [pos, pos + labelWidth];
        if (value === 2020) return [pos - labelWidth, pos];
        return [pos - labelWidth / 2, pos + labelWidth / 2];
      });
      const crowded = spacing < labelWidth + 8 || boxes.some((box, index) => index > 0 && box[0] < boxes[index - 1][1] + 8);
      setSparse((current) => current === crowded ? current : crowded);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [span]);
  const setFromClient = (clientX: number, target: HTMLInputElement) => {
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) return;
    const next = YEAR_START + Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * span);
    onYear(next);
  };
  return (
    <div className="lv-timeline">
      <div className="lv-timeline-track lv-cut">
        <ChamferMark />
        <div className="lv-timeline-face">
          <div className="lv-ticks" ref={ticksRef}>
            {ticks.map((tick) => {
              const major = tick % 10 === 0;
              const left = `${((tick - YEAR_START) / span) * 100}%`;
              const edge = tick === 1960 ? "is-start" : tick === 2020 ? "is-end" : "";
              const showLabel = major && (!sparse || tick % 20 === 0);
              return (
                <span key={tick} aria-hidden="true">
                  <i style={{ left, height: major ? 9 : 4 }} />
                  {showLabel ? (
                    <b className={edge} data-year={tick} style={{ left }}>
                      {tick}
                    </b>
                  ) : null}
                </span>
              );
            })}
            <span className="lv-playhead" style={{ left: `calc(${ratio} * (100% - 7px))` }} aria-hidden="true">
              <i />
              <b />
            </span>
            <input
              className="lv-year"
              type="range"
              min={YEAR_START}
              max={YEAR_END}
              step={1}
              value={year}
              aria-label="Timeline"
              aria-valuemin={YEAR_START}
              aria-valuemax={YEAR_END}
              aria-valuenow={year}
              aria-valuetext={dateLabel(year)}
              aria-describedby={readoutId}
              onChange={(event) => onYear(Number(event.currentTarget.value))}
              onPointerDown={(event) => setFromClient(event.clientX, event.currentTarget)}
              onPointerMove={(event) => {
                if (event.buttons) setFromClient(event.clientX, event.currentTarget);
              }}
            />
          </div>
        </div>
      </div>
      <p className="lv-date lv-cut" id={readoutId}>
        <ChamferMark />
        <span>{dateLabel(year)}</span>
      </p>
    </div>
  );
}

const DEFAULT_EIC_SOURCE: ListenSource = {
  ...EIC_FRAME_SOURCE,
  preview: EIC_FRAME_IMAGE,
};

export function ListenV4({
  initialLayer,
  initialSourceId,
  initialLat,
  initialLng,
}: {
  readonly initialLayer: LayerId;
  readonly initialSourceId?: string;
  readonly initialLat?: number;
  readonly initialLng?: number;
}) {
  const { setSoundEnabled } = useSonifyPlayer();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadUrls = useRef(new Map<string, string>());
  const uploadRequest = useRef(0);
  const [sources, setSources] = useState<ListenSource[]>([DEFAULT_EIC_SOURCE, ...SEED_SOURCES]);
  const [searches, setSearches] = useState<SearchRecord[]>([...SEED_SEARCHES]);
  const resolveInitialSource = (): ListenSource => {
    if (initialSourceId === "map") return MAP_SOURCE;
    if (initialLayer === "air" || initialLayer === "wind" || initialLayer === "sea-ice" || initialLayer === "sea-temp" || initialLayer === "precip" || initialLayer === "elevation") return MAP_SOURCE;
    if (initialLayer === "co2") return SEED_SOURCES.find((s) => s.id === "oco2-example") ?? DEFAULT_EIC_SOURCE;
    if (initialLayer === "currents") return SEED_SOURCES.find((s) => s.id === "currents-example") ?? DEFAULT_EIC_SOURCE;
    return DEFAULT_EIC_SOURCE;
  };
  const [source, setSource] = useState<ListenSource>(resolveInitialSource);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NasaHit[]>([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [layer, setLayer] = useState<LayerId>(initialLayer);
  const [more, setMore] = useState(EXTRA_LAYERS.some((item) => item.id === initialLayer));
  const [lat, setLat] = useState(initialLat ?? 0);
  const [lng, setLng] = useState(initialLng ?? -145);
  const [year, setYear] = useState(YEAR_END);
  const [styleId, setStyleId] = useState<SoundStyle>("synth");
  const [instrument, setInstrument] = useState<InstrumentId>("soft-synth");
  const chooseInstrument = useCallback((id: InstrumentId) => {
    setInstrument(id === "strings" ? "soft-synth" : id);
  }, []);
  const [variation, setVariation] = useState<VariationId>("soft");
  const [pitchMode, setPitchMode] = useState<PitchMode>("pentatonic");
  const [ambience, setAmbience] = useState(false);
  const [volume, setVolume] = useState(80);
  const [tempo, setTempo] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [legend, setLegend] = useState<LegendModel>(legendFromMetadata(legendMetaFor(initialLayer, MAP_SOURCE)));
  const [measured, setMeasured] = useState<TaggedReading | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [readingError, setReadingError] = useState("");
  const [pixelColor, setPixelColor] = useState<string | null>(null);
  const [listeningFocus, setListeningFocus] = useState<ListeningFocus | null>(null);
  const soundToggleRef = useRef<HTMLButtonElement>(null);
  const mapScanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nasaSearchRequests = useRef(createLatestRequest());
  const nasaAssetRequests = useRef(createLatestRequest());
  const ready = useRef(false);
  const [phoneSearch, setPhoneSearch] = useState(false);
  useProbeAudioBinding();

  const stopMapScan = useCallback((message?: string) => {
    if (mapScanTimer.current) clearTimeout(mapScanTimer.current);
    mapScanTimer.current = null;
    setScanning(false);
    if (message) setStatus(message);
  }, []);

  useEffect(() => () => {
    if (mapScanTimer.current) clearTimeout(mapScanTimer.current);
    mapScanTimer.current = null;
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 699px)");
    const apply = () => setPhoneSearch(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("lv-lock");
    return () => document.documentElement.classList.remove("lv-lock");
  }, []);

  useEffect(() => () => {
    uploadRequest.current += 1;
    for (const url of uploadUrls.current.values()) URL.revokeObjectURL(url);
    uploadUrls.current.clear();
  }, []);

  useEffect(() => {
    fetch("/api/listen/eic")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { date?: string } | null) => {
        if (!data?.date) return;
        const updatedMeta = `NASA SVS 5101 · ${data.date}`;
        setSources((prev) =>
          prev.map((s) => (s.id === EIC_FRAME_SOURCE.id ? { ...s, meta: updatedMeta } : s))
        );
        setSource((curr) =>
          curr.id === EIC_FRAME_SOURCE.id ? { ...curr, meta: updatedMeta } : curr
        );
      })
      .catch(() => {});
  }, []);

  const onLegend = useCallback((next: LegendModel) => {
    setLegend((prev) => {
      const prevKey = `${prev.title}|${prev.source}|${prev.stops.map((stop) => stop.color + stop.label).join(",")}|${prev.noData?.label ?? ""}`;
      const nextKey = `${next.title}|${next.source}|${next.stops.map((stop) => stop.color + stop.label).join(",")}|${next.noData?.label ?? ""}`;
      return prevKey === nextKey ? prev : next;
    });
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "{}") as { searches?: unknown; sources?: unknown };
      const cleanedSearches = sanitizeSavedSearches(saved.searches);
      if (cleanedSearches.length) setSearches(cleanedSearches);
      setSources((current) => sanitizeSavedSources(saved.sources, current));
      const storedProfiles = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "[]") as SavedProfile[];
      if (Array.isArray(storedProfiles)) setProfiles(storedProfiles.slice(0, 24));
    } catch {
      // History is optional when storage is blocked.
    }
    ready.current = true;
  }, []);

  useEffect(() => {
    if (!ready.current) return;
    try {
      const userSourcesToSave = sources
        .filter((item) => item.id !== "reef-example" && !CURATED_SOURCE_IDS.has(item.id) && !item.preview.startsWith("blob:"))
        .slice(0, 16);
      localStorage.setItem(HISTORY_KEY, JSON.stringify({ searches, sources: userSourcesToSave }));
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
    } catch {
      // Ignore quota failures.
    }
  }, [searches, sources, profiles]);

  const handleClearHistory = useCallback(() => {
    setSearches([]);
    setSources((current) => current.filter((item) => CURATED_SOURCE_IDS.has(item.id)));
    setSource((current) => {
      if (CURATED_SOURCE_IDS.has(current.id)) return current;
      return DEFAULT_EIC_SOURCE;
    });
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {}
  }, []);

  const historyTabRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const drawerWasOpen = useRef(false);
  const sheetWasOpen = useRef(false);

  useEffect(() => {
    if (drawer) {
      drawerWasOpen.current = true;
      const close = drawerCloseRef.current;
      const frame = requestAnimationFrame(() => close?.focus());
      return () => cancelAnimationFrame(frame);
    }
    if (!drawerWasOpen.current) return;
    drawerWasOpen.current = false;
    const tab = historyTabRef.current;
    if (!tab || tab.offsetParent === null) return;
    const frame = requestAnimationFrame(() => tab.focus());
    return () => cancelAnimationFrame(frame);
  }, [drawer]);
  useEffect(() => {
    if (sheet) {
      sheetWasOpen.current = true;
      return;
    }
    if (!sheetWasOpen.current) return;
    sheetWasOpen.current = false;
    const toggle = soundToggleRef.current;
    const frame = requestAnimationFrame(() => toggle?.focus());
    return () => cancelAnimationFrame(frame);
  }, [sheet]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (sheet) setSheet(false);
      else if (drawer) setDrawer(false);
      else if (resultsOpen) setResultsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, drawer, resultsOpen]);

  useEffect(() => onPlaybackStopped(() => setPlaying(false)), []);

  useEffect(() => {
    const search = nasaSearchRequests.current;
    const asset = nasaAssetRequests.current;
    return () => {
      search.abort();
      asset.abort();
    };
  }, []);

  const reading = useMemo(
    () => readProbe({ layer, year, lat, lng, source, pixelColor, measured, measuring }),
    [layer, year, lat, lng, source, pixelColor, measured, measuring],
  );

  const hearing = useMemo<HearingParams>(
    () => ({
      style: styleId,
      instrument,
      variation,
      pitchMode,
      ambience,
      layer,
      pan: proximityMix(listeningFocus?.sourceId === source.id ? listeningFocus : null).pan,
      proximity: proximityMix(listeningFocus?.sourceId === source.id ? listeningFocus : null),
      volume,
      tempo,
      value: reading.normalized,
    }),
    [styleId, instrument, variation, pitchMode, ambience, layer, source.id, listeningFocus, volume, tempo, reading.normalized],
  );

  useEffect(() => {
    if (!playing) return;
    updateProbeAudio(hearing);
  }, [hearing, playing]);

  useEffect(() => {
    if (scanning && (source.kind !== "map" || layer !== "temperature")) {
      stopMapScan("Map scan stopped because the selected source or layer changed.");
    }
  }, [scanning, source.kind, layer, stopMapScan]);

  const readingContextRef = useRef<ReadingContext | null>(null);
  useEffect(() => {
    const context: ReadingContext = {
      source: source.id,
      layer,
      lat,
      lon: lng,
      time: probeInstant(year),
    };
    readingContextRef.current = context;
    setMeasured(null);
    setReadingError("");
    if (source.kind !== "map" || (layer !== "air" && layer !== "sea-temp" && layer !== "currents" && layer !== "wind" && layer !== "precip" && layer !== "elevation" && layer !== "temperature")) {
      setMeasuring(false);
      return;
    }
    const controller = new AbortController();
    setMeasured(null);
    setMeasuring(true);

    if (layer === "temperature") {
      const timer = window.setTimeout(() => {
        const when = formatUtcInstant(context.time) ?? context.time;
        void fetch("/api/listen/pc/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lon: lng, time: context.time }),
          signal: controller.signal,
        })
          .then(async (response) => {
            if (!readingContextsMatch(readingContextRef.current, context)) return;
            const body = (await response.json()) as {
              id?: string;
              status?: string;
              result?: { point: { celsius: number; kelvin: number }; cached?: boolean };
              error?: string;
            };
            if (response.status === 200 && body.result) {
              const c = body.result.point.celsius;
              setMeasured({
                context,
                status: "reading",
                value: `${c.toFixed(1)} °C`,
                detail: `${body.result.cached ? "Cached" : "MODIS"} · Azure · ${when}`,
              });
              setMeasuring(false);
              return;
            }
            if (response.status === 202 && body.id) {
              const jobId = body.id;
              const poll = (attempts = 0) => {
                if (attempts > 15 || controller.signal.aborted) {
                  if (readingContextsMatch(readingContextRef.current, context)) {
                    setMeasuring(false);
                  }
                  return;
                }
                window.setTimeout(() => {
                  if (controller.signal.aborted || !readingContextsMatch(readingContextRef.current, context)) return;
                  void fetch(`/api/listen/pc/jobs?id=${encodeURIComponent(jobId)}`, { signal: controller.signal })
                    .then(async (pollRes) => {
                      if (!readingContextsMatch(readingContextRef.current, context)) return;
                      const pollData = (await pollRes.json()) as {
                        status?: string;
                        result?: { point: { celsius: number; kelvin: number }; cached?: boolean };
                        error?: string;
                      };
                      if (pollData.status === "completed" && pollData.result) {
                        const c = pollData.result.point.celsius;
                        setMeasured({
                          context,
                          status: "reading",
                          value: `${c.toFixed(1)} °C`,
                          detail: `${pollData.result.cached ? "Cached" : "MODIS"} · Azure · ${when}`,
                        });
                        setMeasuring(false);
                        return;
                      }
                      if (pollData.status === "failed") {
                        const message = pollData.error || "No satellite scene for this date";
                        setMeasured({ context, status: "no-data", value: message, detail: when });
                        setReadingError(message);
                        setMeasuring(false);
                        return;
                      }
                      poll(attempts + 1);
                    })
                    .catch(() => {
                      if (readingContextsMatch(readingContextRef.current, context)) setMeasuring(false);
                    });
                }, 600);
              };
              poll();
              return;
            }
            const message = body.error || "No satellite scene available";
            setMeasured({ context, status: "no-data", value: message, detail: when });
            setReadingError(message);
            setMeasuring(false);
          })
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            if (!readingContextsMatch(readingContextRef.current, context)) return;
            const message = error instanceof Error && error.message ? error.message : "The satellite service could not be reached";
            setMeasured({ context, status: "no-data", value: message, detail: when });
            setReadingError(message);
            setMeasuring(false);
          });
      }, 350);

      return () => {
        controller.abort();
        window.clearTimeout(timer);
      };
    }

    const apiLayer = layer === "air" ? "air-temp" : layer;
    const timer = window.setTimeout(() => {
      const when = formatUtcInstant(context.time) ?? context.time;
      void fetch(
        `/api/listen/measurements?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}&time=${encodeURIComponent(context.time)}&layer=${apiLayer}`,
        { signal: controller.signal },
      )
        .then(async (response) => {
          const body = (await response.json()) as { value?: number; unit?: string; source?: string; time?: string; error?: string };
          if (!readingContextsMatch(readingContextRef.current, context)) return;
          if (isNoDataResponse(response.status, body.error)) {
            setMeasured({ context, status: "no-data", value: "No data for this date", detail: when });
            return;
          }
          if (!response.ok || typeof body.value !== "number" || !Number.isFinite(body.value)) {
            const message = body.error || "No reading";
            setMeasured({ context, status: "no-data", value: message, detail: when });
            setReadingError(message);
            return;
          }
          setReadingError("");
          const actualTime = formatUtcInstant(body.time ?? context.time) ?? when;
          setMeasured({
            context,
            status: "reading",
            value: layer === "elevation" ? elevationValueLabel(body.value) : layer === "precip" ? precipitationValueLabel(body.value) : `${body.value.toFixed(1)} ${body.unit ?? ""}`.trim(),
            detail: layer === "elevation" ? "Open-Meteo · Copernicus DEM" : layer === "precip" ? precipitationDetail(body.value) : `${body.source ?? "Matched"} · ${actualTime}`,
          });
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (!readingContextsMatch(readingContextRef.current, context)) return;
          const message = error instanceof Error && error.message ? error.message : "The data service could not be reached";
          setMeasured({ context, status: "no-data", value: message, detail: when });
          setReadingError(message);
        })
        .finally(() => {
          if (!readingContextsMatch(readingContextRef.current, context)) return;
          setMeasuring(false);
        });
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [source.id, source.kind, layer, lat, lng, year]);

  const chooseLayer = (id: LayerId) => {
    setLayer(id);
    if (EXTRA_LAYERS.some((item) => item.id === id)) setMore(true);
    if (id === "co2" && source.id !== "oco2-example") {
      const co2Source = sources.find((s) => s.id === "oco2-example") ?? SEED_SOURCES.find((s) => s.id === "oco2-example");
      if (co2Source) setSource(co2Source);
    } else if (id === "currents" && source.id !== "currents-example") {
      const curSource = sources.find((s) => s.id === "currents-example") ?? SEED_SOURCES.find((s) => s.id === "currents-example");
      if (curSource) setSource(curSource);
    } else if (source.kind !== "map" && (source.layer !== id || EXTRA_LAYERS.some((item) => item.id === id) || id === "temperature" || id === "sea-ice")) {
      setSource(MAP_SOURCE);
    }
    const url = new URL(window.location.href);
    url.searchParams.set("data", paramForLayer(id));
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const openSource = (item: ListenSource) => {
    const next = item.id === EIC_FRAME_SOURCE.id ? { ...item, preview: EIC_FRAME_IMAGE } : item;
    setUploadError("");
    setSource(next);
    setPixelColor(null);
    setSavedOpen(false);
    setDrawer(false);
    setResultsOpen(false);
    setStatus(next.id === EIC_FRAME_SOURCE.id ? EIC_FRAME_STATUS : "");
    if (next.layer) chooseLayer(next.layer);
    if (next.kind === "map") {
      setLat(0);
      setLng(-145);
    }
  };

  const searchNASA = async (term = query) => {
    const clean = term.trim();
    setUploadError("");
    setQuery(clean);
    const place = placeMatch(clean);
    if (place) {
      setSource(MAP_SOURCE);
      setLat(place.center[1]);
      setLng(place.center[0]);
      setStatus(`Probe moved to ${place.name}.`);
    }
    if (clean.length < 2) {
      nasaSearchRequests.current.abort();
      setStatus("Enter at least two characters to search NASA media.");
      return;
    }
    const ticket = nasaSearchRequests.current.start();
    setResultsOpen(true);
    setStatus("");
    try {
      const response = await fetch(`/api/listen/nasa?q=${encodeURIComponent(clean)}&type=image,video`, { signal: ticket.signal });
      const body = (await response.json()) as { items?: NasaHit[]; error?: string };
      if (!nasaSearchRequests.current.isCurrent(ticket.id)) return;
      if (!response.ok) throw new Error(body.error ?? "Search failed.");
      const items = body.items ?? [];
      setResults(items);
      if (!items.length) {
        setResultsOpen(false);
        setStatus(`No NASA media for “${clean}”.`);
      } else {
        setSearches((previous) => [{ id: clean, term: clean, detail: `${items.length} NASA MEDIA RESULTS` }, ...previous.filter((item) => item.term !== clean)].slice(0, 12));
      }
    } catch (error) {
      if (isAbortError(error) || !nasaSearchRequests.current.isCurrent(ticket.id)) return;
      setResults([]);
      setStatus(error instanceof Error ? error.message : "NASA search failed.");
    }
  };

  const chooseHit = async (item: NasaHit) => {
    setUploadError("");
    const ticket = nasaAssetRequests.current.start();
    setStatus("Loading NASA media…");
    try {
      const response = await fetch(`/api/listen/nasa/asset?id=${encodeURIComponent(item.id)}`, { signal: ticket.signal });
      const body = (await response.json()) as { image?: string | null; video?: string | null; error?: string };
      if (!nasaAssetRequests.current.isCurrent(ticket.id)) return;
      if (!response.ok) throw new Error(body.error ?? "NASA media could not be opened.");
      const next: ListenSource = {
        id: item.id,
        title: item.title,
        kind: item.mediaType,
        eyebrow: item.mediaType === "video" ? "VID" : "IMG",
        meta: `NASA ${item.center} · ${(item.date ?? "").slice(0, 10) || "UNDATED"}`,
        preview: body.image ?? item.preview,
        video: body.video ?? undefined,
        legend: null,
      };
      if (!nasaAssetRequests.current.isCurrent(ticket.id)) return;
      setSources((previous) => [next, ...previous.filter((old) => old.id !== next.id)].slice(0, 20));
      openSource(next);
      setStatus("");
    } catch (error) {
      if (isAbortError(error) || !nasaAssetRequests.current.isCurrent(ticket.id)) return;
      setResultsOpen(false);
      openSource(MAP_SOURCE);
      setStatus(error instanceof Error ? error.message : "NASA media could not be opened.");
    }
  };

  const onUpload = async (file?: File) => {
    if (!file) return;
    const requestId = ++uploadRequest.current;
    setUploadError("");
    setStatus(`Checking ${file.name}…`);
    try {
      const { kind } = await validateListenUpload(file);
      if (requestId !== uploadRequest.current) return;
      let evictedId: string | null = null;
      if (uploadUrls.current.size >= 3) {
        const oldest = uploadUrls.current.entries().next().value as [string, string] | undefined;
        if (oldest) {
          evictedId = oldest[0];
          URL.revokeObjectURL(oldest[1]);
          uploadUrls.current.delete(oldest[0]);
        }
      }
      const id = `upload-${Date.now()}-${requestId}`;
      const url = URL.createObjectURL(file);
      const next: ListenSource = {
        id,
        title: file.name,
        kind,
        eyebrow: kind === "video" ? "VID" : "IMG",
        meta: "YOUR UPLOAD · THIS SESSION",
        preview: url,
        video: kind === "video" ? url : undefined,
        legend: null,
      };
      uploadUrls.current.set(id, url);
      setSources((previous) => [next, ...previous.filter((old) => old.id !== next.id && old.id !== evictedId)].slice(0, 20));
      openSource(next);
      setStatus(`${kind === "image" ? "Image" : "Video"} ready. It stays in this browser session.`);
    } catch (error) {
      if (requestId !== uploadRequest.current) return;
      setStatus("");
      setUploadError(error instanceof Error ? error.message : "The file could not be opened. Choose a supported image or video.");
    }
  };

  const togglePlay = async () => {
    if (playing) {
      stopMapScan();
      stopProbeAudio();
      setPlaying(false);
      setStatus("");
      return;
    }
    if (hearing.value === null) {
      setStatus("No matched data at this point. Move the probe or choose a data layer with coverage.");
      return;
    }
    setSoundEnabled(true);
    const started = await startProbeAudio(hearing);
    setPlaying(started);
    setStatus(started ? `Playing ${instrument.replace("-", " ")}.` : "Audio could not start on this device.");
  };

  const canScanMap = source.kind === "map" && layer === "temperature";
  const toggleMapScan = async () => {
    if (scanning) {
      stopMapScan("Map scan stopped. Playback stays at the current point.");
      return;
    }
    if (!canScanMap || MAP_SCAN_POINTS.length === 0) return;

    const first = MAP_SCAN_POINTS[0];
    const firstReading = readProbe({
      layer,
      year,
      lat: first.lat,
      lng: first.lng,
      source,
      pixelColor: null,
      measured: null,
      measuring: false,
    });

    if (!playing) {
      setSoundEnabled(true);
      const started = await startProbeAudio({
        ...hearing,
        value: firstReading.normalized,
        pan: Math.max(-1, Math.min(1, first.lng / 180)),
      });
      if (!started) {
        setStatus("Audio could not start on this device.");
        return;
      }
      setPlaying(true);
    }

    setLat(first.lat);
    setLng(first.lng);
    setScanning(true);
    setStatus(`Map scan 1/${MAP_SCAN_POINTS.length} · ${first.name}.`);
    let index = 1;
    const advance = () => {
      const point = MAP_SCAN_POINTS[index];
      if (!point) {
        mapScanTimer.current = null;
        setScanning(false);
        setStatus("Map scan complete. Playback continues at the last point.");
        return;
      }
      setLat(point.lat);
      setLng(point.lng);
      setStatus(`Map scan ${index + 1}/${MAP_SCAN_POINTS.length} · ${point.name}.`);
      index += 1;
      mapScanTimer.current = setTimeout(advance, 1500);
    };
    mapScanTimer.current = setTimeout(advance, 1500);
  };

  const saveProfile = () => {
    const profile: SavedProfile = {
      id: `${Date.now()}`,
      name: `${hearTitle(layer)} · ${instrument.replace("-", " ")}`,
      layer,
      style: styleId,
      instrument,
      variation,
      pitchMode,
      ambience,
      volume,
      tempo,
      year,
    };
    setProfiles((previous) => [profile, ...previous].slice(0, 24));
    setStatus("Profile saved.");
  };

  const applyProfile = (profile: SavedProfile) => {
    chooseLayer(profile.layer);
    setStyleId(profile.style);
    chooseInstrument(profile.instrument);
    setVariation(profile.variation);
    setPitchMode(profile.pitchMode ?? "continuous");
    setAmbience(profile.ambience ?? false);
    setVolume(profile.volume);
    setTempo(profile.tempo);
    setYear(profile.year);
    setSavedOpen(false);
    setStatus(`Loaded ${profile.name}.`);
  };

  const coord = formatCoord(lat, lng);
  const when = formatUtcInstant(probeInstant(year)) ?? dateLabel(year);
  const announced =
    layer === "air" || layer === "currents" || layer === "wind" || layer === "precip" || layer === "elevation"
      ? reading.cards.find((card) => card.id === layer)
      : undefined;
  const layers = more ? [...PRIMARY_LAYERS, ...EXTRA_LAYERS] : PRIMARY_LAYERS;
  const summary = `${reading.matched} MATCHED · ${reading.imageDerived} IMAGE-DERIVED · ${reading.empty} NO DATA`;

  return (
    <main id="main-content" tabIndex={-1} className="lv-page">
      <h1 className="sr-only">Listen</h1>
      <a className="lv-skip" href="#nasa-search">Skip to search</a>
      <div className="lv-main">
        <div className="lv-fold">
        <div className="lv-search-stack">
        <p className="lv-mono lv-eyebrow m-0 whitespace-normal">
          NASA Image and Video Library search returns media, not measurements. Map figures are example data. Meteomatics readings load only when that server is configured.
        </p>
        <form
          className="lv-search lv-cut"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            void searchNASA();
          }}
        >
          <ChamferMark />
          <div className="lv-search-face">
            <SearchIcon />
            <label className="sr-only" htmlFor="nasa-search">
              Search NASA images, videos or a place
            </label>
            <input
              id="nasa-search"
              type="search"
              value={query}
              placeholder={phoneSearch ? "Search NASA media…" : "Search NASA images, videos or a place..."}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </form>
        {resultsOpen ? (
          <div className="lv-results lv-cut" role="region" aria-label="NASA search results">
            <ChamferMark />
            <div className="lv-layer-head">
              <p className="lv-mono lv-eyebrow">{results.length} RESULTS</p>
              <button type="button" className="lv-results-close lv-cut" aria-label="Close results" onClick={() => setResultsOpen(false)}>
                <ChamferMark />
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M2.4 2.4 L9.6 9.6 M9.6 2.4 L2.4 9.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
            </div>
            <div className="lv-results-list">
              {results.map((item) => (
                <button type="button" key={item.id} className="lv-result lv-cut" onClick={() => void chooseHit(item)}>
                  <ChamferMark />
                  <img src={item.preview} alt="" />
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.mediaType} · {item.center}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        </div>
        <div>
          <div className="lv-layer-head">
            <p className="lv-mono lv-eyebrow">
              DATA LAYER · <span className="lv-layer-long">PICK ONE TO DRIVE THE SOUND</span>
              <span className="lv-layer-short">PICK ONE</span>
            </p>
            <p className="lv-mono lv-eyebrow lv-swipe">6 LAYERS · SWIPE →</p>
          </div>
          <div className="lv-chips" role="group" aria-label="Data layer">
            {layers.map((item) => (
              <Chip key={item.id} pressed={layer === item.id} label={item.name} holdScroll onClick={() => chooseLayer(item.id)}>
                {item.label}
              </Chip>
            ))}
            <button type="button" className="lv-chip lv-cut is-more" aria-expanded={more} onClick={() => setMore((value) => !value)}>
              <ChamferMark />
              MORE +
            </button>
            <button type="button" className="lv-chip lv-cut lv-more-icon" aria-label="More data layers" aria-expanded={more} onClick={() => setMore((value) => !value)}>
              <ChamferMark />
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M1.5 2.5 H12.5 L8.4 7.1 V11.1 L5.6 12.2 V7.1 Z" fill="none" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
          </div>
        </div>
        {savedOpen ? (
          <section className="lv-saved lv-cut" aria-labelledby="saved-title">
            <ChamferMark />
            <div className="lv-saved-face">
              <p className="lv-mono lv-eyebrow">SAVED</p>
              <h2 id="saved-title">Saved profiles</h2>
              <p>The Saved screen is not in the Listen v4 frames yet. Profiles you save from the sound panel are listed here.</p>
              {profiles.length === 0 ? <p>No saved profiles yet.</p> : null}
              {profiles.map((profile) => (
                <button type="button" key={profile.id} className="lv-profile lv-cut" onClick={() => applyProfile(profile)}>
                  <ChamferMark />
                  <strong>{profile.name}</strong>
                  <small>
                    {layerLabel(profile.layer)} · {Math.round(profile.volume)}% · {profile.tempo}×
                  </small>
                </button>
              ))}
              <p className="lv-note">Placeholder until a designed Saved view is added.</p>
            </div>
          </section>
        ) : (
          <ListenMap
            source={source}
            layer={layer}
            lat={lat}
            lng={lng}
            legend={legend}
            onLegend={onLegend}
            tip={reading.tip}
            coord={coord}
            onPixel={setPixelColor}
            onFocus={setListeningFocus}
            onProbe={(nextLat, nextLng) => {
              if (scanning) stopMapScan("Map scan stopped at the selected point.");
              setLat(Math.max(-85, Math.min(85, nextLat)));
              setLng(Math.max(-180, Math.min(180, nextLng)));
            }}
          />
        )}
        <p className="lv-status" role="status">{status}</p>
        {uploadError ? <p className="lv-status lv-upload-error" role="alert">{uploadError}</p> : null}
        </div>
        {savedOpen ? null : (
          <section aria-label="Readings at probe">
            <div className="lv-read-head">
              <p className="lv-mono lv-eyebrow">
                READINGS AT {source.kind === "map" ? "PROBE" : "MEDIA"} · {source.kind === "map" ? <span className="lv-coord-inline">{coord} · </span> : null}
                <span className="lv-utc">{when}</span>
              </p>
              <p className="lv-mono lv-eyebrow">
                <span className="lv-count-long">{summary}</span>
                <span className="lv-count-short">{reading.cards.length} · SWIPE →</span>
              </p>
            </div>
            <div className="lv-cards" data-count={reading.cards.length}>
              {reading.cards.map((card) => (
                <article key={card.id} className={`lv-card lv-cut is-${card.state}`} data-id={card.id}>
                  <ChamferMark />
                  <p className="lv-mono lv-card-label">
                    <i className="lv-swatch" style={{ background: card.swatch }} />
                    {card.label}
                  </p>
                  <strong>{card.value}</strong>
                  <small className="lv-utc">{card.detail}</small>
                </article>
              ))}
            </div>
          </section>
        )}
        <div className="lv-mobile-sound">
          {sheet ? (
            <div className="lv-sheet lv-cut" id="sound-controls">
              <ChamferMark />
              <div className="lv-sheet-face">
                <button type="button" className="lv-grab" aria-expanded="true" aria-controls="sound-controls" onClick={() => setSheet(false)}>
                  <i />
                  <span>
                    SOUND PROFILE
                    <small>{layerLabel(layer)} · {instrument.replace("-", " ")}</small>
                  </span>
                  <Chevron />
                </button>
                <SoundFields
                  compact
                  styleId={styleId}
                  instrument={instrument}
                  variation={variation}
                  pitchMode={pitchMode}
                  ambience={ambience}
                  scanAvailable={canScanMap}
                  scanning={scanning}
                  volume={volume}
                  tempo={tempo}
                  onStyle={setStyleId}
                  onInstrument={chooseInstrument}
                  onVariation={setVariation}
                  onPitchMode={setPitchMode}
                  onAmbience={() => setAmbience((value) => !value)}
                  onScan={() => void toggleMapScan()}
                  onVolume={setVolume}
                  onTempo={setTempo}
                />
                <AudioKey
                  layer={layer}
                  year={year}
                  source={source}
                  reading={reading}
                  styleId={styleId}
                  instrument={instrument}
                  variation={variation}
                  pitchMode={pitchMode}
                  ambience={ambience}
                  pan={hearing.pan}
                  tempo={tempo}
                />
                <div className="lv-sheet-actions">
                  <button type="button" className="lv-play lv-cut" onClick={() => void togglePlay()}>
                    <ChamferMark />
                    <PlayGlyph stop={playing} />
                    {playing ? "Stop" : "Play sound"}
                  </button>
                  <button type="button" className="lv-save lv-cut" onClick={saveProfile}>
                    <ChamferMark />
                    SAVE PROFILE
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="lv-sound-row">
              <button ref={soundToggleRef} type="button" className="lv-collapse lv-cut" aria-expanded="false" aria-controls="sound-controls" onClick={() => setSheet(true)}>
                <ChamferMark />
                SOUND PROFILE
                <Chevron up />
              </button>
              <button type="button" className="lv-play lv-play-pill lv-cut" onClick={() => void togglePlay()}>
                <ChamferMark />
                <PlayGlyph stop={playing} />
                {playing ? "Stop" : "Play sound"}
              </button>
            </div>
          )}
        </div>
      </div>
      <aside className={`lv-history lv-cut ${drawer ? "is-open" : ""}`} aria-label="History">
        <ChamferMark />
        <div className="lv-history-face">
          <HistoryList
            sources={sources}
            searches={searches}
            activeId={source.id}
            drawer={drawer}
            closeRef={drawerCloseRef}
            onClose={() => setDrawer(false)}
            onOpen={openSource}
            onSearch={(term) => void searchNASA(term)}
            onNew={() => fileRef.current?.click()}
            onClearHistory={handleClearHistory}
          />
        </div>
      </aside>
      <button type="button" className={`lv-scrim ${drawer ? "is-open" : ""}`} aria-label="Close history" tabIndex={drawer ? 0 : -1} onClick={() => setDrawer(false)} />
      <aside className="lv-sound lv-cut" aria-label="Sound profile">
        <ChamferMark />
        <div className="lv-sound-face">
          <div>
            <p className="lv-mono lv-eyebrow">SOUND PROFILE</p>
            <p className="lv-title">{hearTitle(layer)}</p>
          </div>
          <SoundFields
            compact={false}
            styleId={styleId}
            instrument={instrument}
            variation={variation}
            pitchMode={pitchMode}
            ambience={ambience}
            scanAvailable={canScanMap}
            scanning={scanning}
            volume={volume}
            tempo={tempo}
            onStyle={setStyleId}
            onInstrument={chooseInstrument}
            onVariation={setVariation}
            onPitchMode={setPitchMode}
            onAmbience={() => setAmbience((value) => !value)}
            onScan={() => void toggleMapScan()}
            onVolume={setVolume}
            onTempo={setTempo}
          />
          <button type="button" className="lv-play lv-cut" onClick={() => void togglePlay()}>
            <ChamferMark />
            <PlayGlyph stop={playing} />
            {playing ? "Stop" : "Play sound"}
          </button>
          <div className="lv-values">
            <p className="lv-value lv-mono">
              <span>SELECTED LAYER</span>
              <strong>{layerLabel(layer)}</strong>
            </p>
            <p className="lv-value lv-mono">
              <span>DATA AT PROBE</span>
              <strong>{reading.dataAtProbe}</strong>
            </p>
            <p className="lv-value lv-mono">
              <span>PITCH FOLLOWS</span>
              <strong>{reading.pitch}</strong>
            </p>
          </div>
          <AudioKey
            layer={layer}
            year={year}
            source={source}
            reading={reading}
            styleId={styleId}
            instrument={instrument}
            variation={variation}
            pitchMode={pitchMode}
            ambience={ambience}
            pan={hearing.pan}
            tempo={tempo}
          />
          <button type="button" className="lv-save lv-cut" onClick={saveProfile}>
            <ChamferMark />
            SAVE PROFILE
          </button>
          {profiles.length > 0 ? (
            <button type="button" className="lv-saved-link" onClick={() => setSavedOpen(true)}>
              View {profiles.length} saved {profiles.length === 1 ? "profile" : "profiles"}
            </button>
          ) : null}
        </div>
      </aside>
      <Timeline year={year} onYear={setYear} />
      <div className="lv-tabs" role="navigation" aria-label="Listen views">
        <button
          ref={historyTabRef}
          type="button"
          className="lv-tab lv-cut"
          aria-current={drawer ? "page" : undefined}
          onClick={() => {
            setDrawer((open) => !open);
            setSavedOpen(false);
          }}
        >
          <ChamferMark />
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <circle cx="9" cy="9" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M9 5.5 V9 L11.5 11" fill="none" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          HISTORY
        </button>
        <button
          type="button"
          className="lv-tab lv-cut"
          aria-current={savedOpen ? "page" : undefined}
          onClick={() => {
            setSavedOpen((open) => !open);
            setDrawer(false);
          }}
        >
          <ChamferMark />
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M5 3.5 H13 V15 L9 12.2 L5 15 Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          SAVED
        </button>
        {false && <span className="lv-home-indicator" aria-hidden="true" />}
      </div>
      <input
        ref={fileRef}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept={LISTEN_UPLOAD_ACCEPT}
        aria-label="Upload image or video"
        aria-describedby="lv-upload-note"
        onChange={(event) => {
          void onUpload(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <p className="sr-only" aria-live="polite">
        {playing ? `Hearing ${layerLabel(layer).toLowerCase()} as ${instrument.replaceAll("-", " ")}, volume ${Math.round(volume)} percent.` : "Sound is stopped."}
      </p>
      <p className="sr-only" aria-live="polite">
        {announced ? `${announced.label}: ${announced.value}. ${announced.detail}` : ""}
      </p>
      <p className="sr-only" aria-live="assertive">{readingError}</p>
    </main>
  );
}
