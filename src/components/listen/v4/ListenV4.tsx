"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useSonifyPlayer } from "@/context/SonifyPlayerContext";
import { onPlaybackStopped } from "@/lib/playbackGate";
import { legendFromMetadata, type LegendModel } from "@/components/listen/v4/legend";
import { ListenMap } from "@/components/listen/v4/ListenMap";
import {
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
  type SearchRecord,
  type SoundStyle,
  type VariationId,
} from "@/components/listen/v4/model";
import { startProbeAudio, stopProbeAudio, updateProbeAudio, useProbeAudioBinding, type HearingParams } from "@/components/listen/v4/probeAudio";
import { WakeSlider } from "@/components/listen/v4/WakeSlider";
import { ChamferMark } from "@/components/listen/ChamferMark";
import "./listen-v4.css";

const HISTORY_KEY = "sonifysphere-listen-v4";
const PROFILE_KEY = "sonifysphere-listen-v4-profiles";

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
}: {
  readonly pressed: boolean;
  readonly children: string;
  readonly onClick: () => void;
  readonly dashed?: boolean;
}) {
  return (
    <button type="button" className={`lv-chip lv-cut ${pressed ? "is-on" : ""} ${dashed ? "is-more" : ""}`} aria-pressed={pressed} onClick={onClick}>
      <ChamferMark />
      {children}
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
  readonly drawer?: boolean;
  readonly onClose?: () => void;
  readonly closeRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <>
      {drawer ? (
        <div className="lv-drawer-head lv-drawer-only">
          <div>
            <p className="lv-mono lv-eyebrow">HISTORY · {sources.length + searches.length} ITEMS</p>
            <p className="lv-title">Your sources</p>
          </div>
          <button ref={closeRef} type="button" className="lv-icon-btn lv-cut" aria-label="Close history" onClick={onClose}>
            ×
          </button>
        </div>
      ) : (
        <p className="lv-mono lv-eyebrow">HISTORY</p>
      )}
      <button type="button" className="lv-new lv-cut" onClick={onNew}>
        <ChamferMark />
        + New source
      </button>
      <p className="lv-mono lv-eyebrow lv-section">RECENT SOURCES</p>
      <div className="lv-list">
        {sources.map((item) => (
          <button
            type="button"
            key={item.id}
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
        ))}
      </div>
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
  );
}

function SoundFields({
  compact,
  styleId,
  instrument,
  variation,
  volume,
  tempo,
  onStyle,
  onInstrument,
  onVariation,
  onVolume,
  onTempo,
}: {
  readonly compact: boolean;
  readonly styleId: SoundStyle;
  readonly instrument: InstrumentId;
  readonly variation: VariationId;
  readonly volume: number;
  readonly tempo: number;
  readonly onStyle: (id: SoundStyle) => void;
  readonly onInstrument: (id: InstrumentId) => void;
  readonly onVariation: (id: VariationId) => void;
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
      <WakeSlider label="VOLUME" min={0} max={100} step={1} value={volume} text={`${Math.round(volume)}%`} compact={compact} onChange={onVolume} />
      <WakeSlider
        label="TEMPO"
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

export function ListenV4({ initialLayer }: { readonly initialLayer: LayerId }) {
  const { setSoundEnabled } = useSonifyPlayer();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sources, setSources] = useState<ListenSource[]>([...SEED_SOURCES]);
  const [searches, setSearches] = useState<SearchRecord[]>([...SEED_SEARCHES]);
  const [source, setSource] = useState<ListenSource>(MAP_SOURCE);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NasaHit[]>([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [layer, setLayer] = useState<LayerId>(initialLayer);
  const [more, setMore] = useState(EXTRA_LAYERS.some((item) => item.id === initialLayer));
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(-145);
  const [year, setYear] = useState(YEAR_END);
  const [styleId, setStyleId] = useState<SoundStyle>("synth");
  const [instrument, setInstrument] = useState<InstrumentId>("soft-synth");
  const chooseInstrument = useCallback((id: InstrumentId) => {
    setInstrument(id === "strings" ? "soft-synth" : id);
  }, []);
  const [variation, setVariation] = useState<VariationId>("soft");
  const [volume, setVolume] = useState(80);
  const [tempo, setTempo] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [legend, setLegend] = useState<LegendModel>(legendFromMetadata(legendMetaFor(initialLayer, MAP_SOURCE)));
  const [measured, setMeasured] = useState<{ value: string; detail: string } | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [pixelColor, setPixelColor] = useState<string | null>(null);
  const soundToggleRef = useRef<HTMLButtonElement>(null);
  const ready = useRef(false);
  const [phoneSearch, setPhoneSearch] = useState(false);
  useProbeAudioBinding();

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

  const onLegend = useCallback((next: LegendModel) => {
    setLegend((prev) => {
      const prevKey = `${prev.title}|${prev.source}|${prev.stops.map((stop) => stop.color + stop.label).join(",")}|${prev.noData?.label ?? ""}`;
      const nextKey = `${next.title}|${next.source}|${next.stops.map((stop) => stop.color + stop.label).join(",")}|${next.noData?.label ?? ""}`;
      return prevKey === nextKey ? prev : next;
    });
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "{}") as { searches?: SearchRecord[]; sources?: ListenSource[] };
      if (Array.isArray(saved.searches) && saved.searches.length) setSearches(saved.searches);
      if (Array.isArray(saved.sources) && saved.sources.length) {
        setSources((current) => {
          const extras = saved.sources?.filter((item) => item && !current.some((seed) => seed.id === item.id)) ?? [];
          return [...extras, ...current].slice(0, 20);
        });
      }
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
      localStorage.setItem(HISTORY_KEY, JSON.stringify({ searches, sources: sources.filter((item) => !item.preview.startsWith("blob:")).slice(0, 16) }));
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
    } catch {
      // Ignore quota failures.
    }
  }, [searches, sources, profiles]);

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

  const reading = useMemo(
    () => readProbe({ layer, year, lat, lng, source, pixelColor, measured, measuring }),
    [layer, year, lat, lng, source, pixelColor, measured, measuring],
  );

  const hearing = useMemo<HearingParams>(
    () => ({ style: styleId, instrument, variation, volume, tempo, value: reading.normalized }),
    [styleId, instrument, variation, volume, tempo, reading.normalized],
  );

  useEffect(() => {
    if (!playing) return;
    updateProbeAudio(hearing);
  }, [hearing, playing]);

  useEffect(() => {
    if (layer !== "air" && layer !== "currents" && layer !== "wind") {
      setMeasured(null);
      setMeasuring(false);
      return;
    }
    const controller = new AbortController();
    const time = `${year}-09-15T12:00:00.000Z`;
    const apiLayer = layer === "air" ? "air-temp" : layer;
    setMeasuring(true);
    const timer = window.setTimeout(() => {
      void fetch(`/api/listen/measurements?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}&time=${encodeURIComponent(time)}&layer=${apiLayer}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = (await response.json()) as { value?: number; unit?: string; source?: string; error?: string };
          if (!response.ok || typeof body.value !== "number") throw new Error(body.error ?? "No reading");
          setMeasured({ value: `${body.value.toFixed(1)} ${body.unit ?? ""}`.trim(), detail: `${body.source ?? "Matched"} · ${dateLabel(year)}` });
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setMeasured(null);
        })
        .finally(() => setMeasuring(false));
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [layer, lat, lng, year]);

  const chooseLayer = (id: LayerId) => {
    setLayer(id);
    if (EXTRA_LAYERS.some((item) => item.id === id)) setMore(true);
    const url = new URL(window.location.href);
    url.searchParams.set("data", paramForLayer(id));
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const openSource = (item: ListenSource) => {
    setSource(item);
    setPixelColor(null);
    setSavedOpen(false);
    setDrawer(false);
    setResultsOpen(false);
    if (item.layer) chooseLayer(item.layer);
    if (item.kind === "map") {
      setLat(0);
      setLng(-145);
    }
  };

  const searchNASA = async (term = query) => {
    const clean = term.trim();
    setQuery(clean);
    const place = placeMatch(clean);
    if (place) {
      setSource(MAP_SOURCE);
      setLat(place.center[1]);
      setLng(place.center[0]);
      setStatus(`Probe moved to ${place.name}.`);
    }
    if (clean.length < 2) {
      setStatus("Enter at least two characters to search NASA media.");
      return;
    }
    setResultsOpen(true);
    setStatus("");
    try {
      const response = await fetch(`/api/listen/nasa?q=${encodeURIComponent(clean)}&type=image,video`);
      const body = (await response.json()) as { items?: NasaHit[]; error?: string };
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
      setResults([]);
      setStatus(error instanceof Error ? error.message : "NASA search failed.");
    }
  };

  const chooseHit = async (item: NasaHit) => {
    setStatus("Loading NASA media…");
    try {
      const response = await fetch(`/api/listen/nasa/asset?id=${encodeURIComponent(item.id)}`);
      const body = (await response.json()) as { image?: string | null; video?: string | null; error?: string };
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
      setSources((previous) => [next, ...previous.filter((old) => old.id !== next.id)].slice(0, 20));
      openSource(next);
      setStatus("");
    } catch (error) {
      setResultsOpen(false);
      openSource(MAP_SOURCE);
      setStatus(error instanceof Error ? error.message : "NASA media could not be opened.");
    }
  };

  const onUpload = (file?: File) => {
    if (!file) return;
    const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
    if (!kind) {
      setStatus("Choose an image or video file.");
      return;
    }
    const url = URL.createObjectURL(file);
    const next: ListenSource = {
      id: `upload-${file.name}-${file.size}`,
      title: file.name,
      kind,
      eyebrow: kind === "video" ? "VID" : "IMG",
      meta: "YOUR UPLOAD · THIS SESSION",
      preview: url,
      video: kind === "video" ? url : undefined,
      legend: null,
    };
    setSources((previous) => [next, ...previous.filter((old) => old.id !== next.id)].slice(0, 20));
    openSource(next);
  };

  const togglePlay = async () => {
    if (playing) {
      stopProbeAudio();
      setPlaying(false);
      setStatus("");
      return;
    }
    setSoundEnabled(true);
    const started = await startProbeAudio(hearing);
    setPlaying(started);
    setStatus(started ? `Playing ${instrument.replace("-", " ")}.` : "Audio could not start on this device.");
  };

  const saveProfile = () => {
    const profile: SavedProfile = {
      id: `${Date.now()}`,
      name: `${hearTitle(layer)} · ${instrument.replace("-", " ")}`,
      layer,
      style: styleId,
      instrument,
      variation,
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
    setVolume(profile.volume);
    setTempo(profile.tempo);
    setYear(profile.year);
    setSavedOpen(false);
    setStatus(`Loaded ${profile.name}.`);
  };

  const coord = formatCoord(lat, lng);
  const when = dateLabel(year);
  const layers = more ? [...PRIMARY_LAYERS, ...EXTRA_LAYERS] : PRIMARY_LAYERS;
  const summary = `${reading.matched} MATCHED · ${reading.imageDerived} IMAGE-DERIVED · ${reading.empty} NO DATA`;

  return (
    <main id="main-content" tabIndex={-1} className="lv-page">
      <h1 className="sr-only">Listen</h1>
      <a className="lv-skip" href="#nasa-search">Skip to search</a>
      <div className="lv-main">
        <div className="lv-fold">
        <div className="lv-search-stack">
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
              <Chip key={item.id} pressed={layer === item.id} onClick={() => chooseLayer(item.id)}>
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
            onProbe={(nextLat, nextLng) => {
              setLat(Math.max(-85, Math.min(85, nextLat)));
              setLng(Math.max(-180, Math.min(180, nextLng)));
            }}
          />
        )}
        <p className="lv-status" role="status">{status}</p>
        </div>
        {savedOpen ? null : (
          <section aria-label="Readings at probe">
            <div className="lv-read-head">
              <p className="lv-mono lv-eyebrow">
                READINGS AT {source.kind === "map" ? "PROBE" : "MEDIA"} · {source.kind === "map" ? <span className="lv-coord-inline">{coord} · </span> : null}
                {when}
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
                  <small>{card.detail}</small>
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
                  volume={volume}
                  tempo={tempo}
                  onStyle={setStyleId}
                  onInstrument={chooseInstrument}
                  onVariation={setVariation}
                  onVolume={setVolume}
                  onTempo={setTempo}
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
            volume={volume}
            tempo={tempo}
            onStyle={setStyleId}
            onInstrument={chooseInstrument}
            onVariation={setVariation}
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
        accept="image/*,video/*"
        aria-label="Upload image or video"
        onChange={(event) => {
          onUpload(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <p className="sr-only" aria-live="polite">
        {playing ? `Hearing ${layerLabel(layer).toLowerCase()} as ${instrument.replaceAll("-", " ")}, volume ${Math.round(volume)} percent.` : "Sound is stopped."}
      </p>
    </main>
  );
}
