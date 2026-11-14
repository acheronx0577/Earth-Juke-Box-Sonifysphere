"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./ListenWorkspace.module.css";

type MediaType = "image" | "video";
type Source = {
  id: string;
  title: string;
  kind: "example" | "upload" | "nasa";
  mediaType: MediaType;
  preview: string;
  video?: string;
  date?: string | null;
  center?: string;
  description?: string;
};
type SearchItem = { id: string; title: string; mediaType: MediaType; preview: string; date: string | null; center: string; description: string };
type Layer = "visual" | "co2" | "air-temp" | "sea-temp" | "currents" | "wind";
type Instrument = "glass" | "strings" | "mallet" | "pulse";
type Variation = "soft" | "bright" | "deep";
type Reading = { value: number; unit: string; time: string; source: string };
type Visual = { label: string; rgb: string; brightness: number; x: number; y: number };

const EXAMPLE: Source = { id: "ocean-example", title: "Ocean current map · example", kind: "example", mediaType: "image", preview: "/design/assets/ocean-current-reference.png", center: "User supplied reference" };
const LAYERS: Array<{ id: Layer; label: string; hint: string }> = [
  { id: "visual", label: "Visual", hint: "Image color and brightness" },
  { id: "co2", label: "CO₂", hint: "NASA OCO-2 layer" },
  { id: "air-temp", label: "Air temp", hint: "Meteomatics · °C" },
  { id: "sea-temp", label: "Sea temp", hint: "Meteomatics · °C" },
  { id: "currents", label: "Currents", hint: "Meteomatics · m/s" },
  { id: "wind", label: "Wind", hint: "Meteomatics · m/s" },
];
const MEASURED: Exclude<Layer, "visual" | "co2">[] = ["air-temp", "sea-temp", "currents", "wind"];
const INSTRUMENTS: Array<{ id: Instrument; label: string }> = [
  { id: "glass", label: "Glass keys" }, { id: "strings", label: "Ocean strings" }, { id: "mallet", label: "Wood mallet" }, { id: "pulse", label: "Deep pulse" },
];
const VARIATIONS: Array<{ id: Variation; label: string }> = [
  { id: "soft", label: "Soft" }, { id: "bright", label: "Bright" }, { id: "deep", label: "Deep" },
];
const NASA_CO2_URL = "https://worldview.earthdata.nasa.gov/?l=OCO-2_Carbon_Dioxide_Total_Column_Average";

function asMessage(error: unknown, fallback: string): string { return error instanceof Error ? error.message : fallback; }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function activeValue(layer: Layer, visual: Visual | null, readings: Partial<Record<Layer, Reading>>) {
  if (layer === "visual") return visual ? visual.brightness / 255 : null;
  const value = readings[layer]?.value;
  if (value === undefined) return null;
  const [min, max] = layer === "air-temp" ? [-30, 50] : layer === "sea-temp" ? [-2, 35] : layer === "currents" ? [0, 2.5] : [0, 30];
  return clamp((value - min) / (max - min), 0, 1);
}

export function ListenWorkspace() {
  const [source, setSource] = useState<Source>(EXAMPLE);
  const [history, setHistory] = useState<Source[]>([EXAMPLE]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"image,video" | MediaType>("image,video");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [message, setMessage] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [layer, setLayer] = useState<Layer>("visual");
  const [instrument, setInstrument] = useState<Instrument>("glass");
  const [variation, setVariation] = useState<Variation>("soft");
  const [visual, setVisual] = useState<Visual | null>(null);
  const [readings, setReadings] = useState<Partial<Record<Layer, Reading>>>({});
  const [measurementStatus, setMeasurementStatus] = useState("Add a place and UTC time to load measured layers.");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [time, setTime] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [soundStatus, setSoundStatus] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<{ context: AudioContext; oscillator: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null>(null);
  const generatedAudioRef = useRef<HTMLAudioElement>(null);
  const uploadUrls = useRef<string[]>([]);
  const generatedUrls = useRef<string[]>([]);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const uploadList = uploadUrls.current;
    const generatedList = generatedUrls.current;
    try {
      const saved = JSON.parse(localStorage.getItem("sonifysphere-listen-history-v1") ?? "{}") as { sources?: Source[]; searches?: string[] };
      if (Array.isArray(saved.sources)) setHistory([EXAMPLE, ...saved.sources.filter((item) => item.kind === "nasa").slice(0, 12)]);
      if (Array.isArray(saved.searches)) setSearchHistory(saved.searches.filter((item) => typeof item === "string").slice(0, 12));
    } catch { /* An invalid browser record should not block Listen. */ }
    return () => {
      uploadList.forEach(URL.revokeObjectURL);
      generatedList.forEach(URL.revokeObjectURL);
      void audioRef.current?.context.close();
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem("sonifysphere-listen-history-v1", JSON.stringify({ sources: history.filter((item) => item.kind === "nasa").slice(0, 12), searches: searchHistory.slice(0, 12) })); }
    catch { /* History is optional when storage is unavailable. */ }
  }, [history, searchHistory]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.oscillator.type = instrument === "strings" ? "sawtooth" : instrument === "pulse" ? "square" : "sine";
    audioRef.current.filter.frequency.setTargetAtTime(variation === "bright" ? 3200 : variation === "deep" ? 650 : 1500, audioRef.current.context.currentTime, 0.08);
  }, [instrument, variation]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const value = activeValue(layer, visual, readings);
    const now = audio.context.currentTime;
    audio.oscillator.frequency.setTargetAtTime(value === null ? 180 : 150 + value * (variation === "deep" ? 250 : 630), now, 0.05);
    audio.gain.gain.setTargetAtTime(soundOn && value !== null ? (instrument === "pulse" ? 0.025 : 0.055) : 0, now, 0.04);
    if (generatedAudioRef.current) {
      generatedAudioRef.current.volume = soundOn && value !== null ? 0.12 + value * 0.18 : 0;
      generatedAudioRef.current.playbackRate = value === null ? 1 : 0.85 + value * 0.3;
    }
  }, [layer, visual, readings, soundOn, instrument, variation]);

  const addHistory = useCallback((item: Source) => {
    setHistory((previous) => [item, ...previous.filter((old) => old.id !== item.id)].slice(0, 20));
  }, []);

  const selectSource = useCallback((item: Source) => {
    setSource(item);
    setVisual(null);
    setReadings({});
    setMeasurementStatus("Add a place and UTC time to load measured layers.");
    setShowResults(false);
    setHistoryOpen(false);
    setMessage("");
    addHistory(item);
  }, [addHistory]);

  const onUpload = (file?: File) => {
    if (!file) return;
    const mediaType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
    if (!mediaType) { setMessage("Choose an image or video file."); return; }
    if (file.size > 100 * 1024 * 1024) { setMessage("Choose a file smaller than 100 MB."); return; }
    const url = URL.createObjectURL(file);
    uploadUrls.current.push(url);
    selectSource({ id: `upload-${Date.now()}`, title: file.name, kind: "upload", mediaType, preview: url, video: mediaType === "video" ? url : undefined, center: "Your upload" });
  };

  const searchNASA = useCallback(async (term = query) => {
    const clean = term.trim();
    if (clean.length < 2) { setMessage("Enter at least two characters to search NASA media."); return; }
    setQuery(clean); setSearching(true); setShowResults(true); setMessage("");
    try {
      const response = await fetch(`/api/listen/nasa?q=${encodeURIComponent(clean)}&type=${encodeURIComponent(filter)}`);
      const body = await response.json() as { items?: SearchItem[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Search failed.");
      setResults(body.items ?? []);
      setSearchHistory((previous) => [clean, ...previous.filter((old) => old !== clean)].slice(0, 12));
    } catch (error) { setResults([]); setMessage(asMessage(error, "NASA search failed.")); }
    finally { setSearching(false); setHistoryOpen(false); }
  }, [query, filter]);

  const chooseNASA = async (item: SearchItem) => {
    setMessage("Loading NASA media…");
    try {
      const response = await fetch(`/api/listen/nasa/asset?id=${encodeURIComponent(item.id)}`);
      const body = await response.json() as { image?: string | null; video?: string | null; error?: string };
      if (!response.ok) throw new Error(body.error ?? "NASA media could not be opened.");
      if (item.mediaType === "video" && !body.video) throw new Error("This NASA record has no playable video file.");
      selectSource({ id: item.id, title: item.title, kind: "nasa", mediaType: item.mediaType, preview: body.image ?? item.preview, video: item.mediaType === "video" ? body.video ?? undefined : undefined, date: item.date, center: item.center, description: item.description });
    } catch (error) { setMessage(asMessage(error, "NASA media could not be opened.")); }
  };

  const sample = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const media = source.mediaType === "video" ? videoRef.current : imageRef.current;
    if (!stage || !canvas || !media) return;
    const width = source.mediaType === "video" ? (media as HTMLVideoElement).videoWidth : (media as HTMLImageElement).naturalWidth;
    const height = source.mediaType === "video" ? (media as HTMLVideoElement).videoHeight : (media as HTMLImageElement).naturalHeight;
    if (!width || !height) return;
    const rect = stage.getBoundingClientRect();
    const scale = Math.min(rect.width / width, rect.height / height);
    const drawnWidth = width * scale;
    const drawnHeight = height * scale;
    const x = (clientX - rect.left - (rect.width - drawnWidth) / 2) / drawnWidth;
    const y = (clientY - rect.top - (rect.height - drawnHeight) / 2) / drawnHeight;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    lastPointer.current = { x: clientX, y: clientY };
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    canvas.width = 256; canvas.height = Math.max(1, Math.round(256 * height / width));
    try {
      context.drawImage(media, 0, 0, canvas.width, canvas.height);
      const pixel = context.getImageData(clamp(Math.floor(x * canvas.width), 0, canvas.width - 1), clamp(Math.floor(y * canvas.height), 0, canvas.height - 1), 1, 1).data;
      const [r, g, b] = pixel;
      const brightness = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
      const label = g > r * 1.25 && g > b * 1.1 ? "Green flow" : r > g * 1.25 && r > b * 1.25 ? "Warm band" : b > r * 1.25 && b > g * 1.15 ? "Blue band" : brightness < 35 ? "Quiet area" : "Visual texture";
      setVisual({ label, rgb: `${r}, ${g}, ${b}`, brightness, x, y });
      setSoundStatus("");
    } catch { setSoundStatus("This NASA asset cannot be sampled in this browser. Uploaded media still works."); }
  }, [source.mediaType]);

  const loadMeasurements = async () => {
    const latitude = Number(lat), longitude = Number(lon);
    const parsed = time ? new Date(`${time}:00Z`) : null;
    if (!lat.trim() || !lon.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || !parsed || Number.isNaN(parsed.getTime())) {
      setMeasurementStatus("Enter a valid latitude, longitude, and UTC date/time."); return;
    }
    setLoadingData(true); setMeasurementStatus("Loading matched measurements…");
    const iso = parsed.toISOString();
    const responses = await Promise.allSettled(MEASURED.map(async (id) => {
      const response = await fetch(`/api/listen/measurements?lat=${latitude}&lon=${longitude}&time=${encodeURIComponent(iso)}&layer=${id}`);
      const body = await response.json() as Reading & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No reading");
      return [id, { value: body.value, unit: body.unit, time: body.time, source: body.source }] as const;
    }));
    const available = Object.fromEntries(responses.flatMap((result) => result.status === "fulfilled" ? [result.value] : [])) as Partial<Record<Layer, Reading>>;
    setReadings(available);
    setMeasurementStatus(`${Object.keys(available).length} of ${MEASURED.length} measured layers available at this place and time.`);
    setLoadingData(false);
  };

  const toggleSound = async () => {
    if (soundOn) { setSoundOn(false); generatedAudioRef.current?.pause(); return; }
    try {
      let audio = audioRef.current;
      if (!audio) {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        filter.type = "lowpass";
        gain.gain.value = 0;
        oscillator.connect(filter).connect(gain).connect(context.destination);
        oscillator.start();
        audio = { context, oscillator, filter, gain };
        audioRef.current = audio;
      }
      await audio.context.resume();
      setSoundOn(true);
      if (generatedAudioRef.current && generatedUrl) void generatedAudioRef.current.play().catch(() => undefined);
    } catch { setSoundStatus("Audio could not start on this device."); }
  };

  const generateVariation = async () => {
    setGenerating(true); setSoundStatus("Generating one five-second loop with ElevenLabs…");
    try {
      const response = await fetch("/api/listen/sound-variation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instrument }) });
      if (!response.ok) { const body = await response.json() as { error?: string }; throw new Error(body.error ?? "Generation failed."); }
      const url = URL.createObjectURL(await response.blob());
      generatedUrls.current.push(url);
      setGeneratedUrl(url);
      setSoundStatus("New loop ready. Move over the media to change its volume and speed.");
      if (soundOn && generatedAudioRef.current) { generatedAudioRef.current.load(); void generatedAudioRef.current.play().catch(() => undefined); }
    } catch (error) { setSoundStatus(asMessage(error, "Generation failed.")); }
    finally { setGenerating(false); }
  };

  const currentValue = activeValue(layer, visual, readings);
  const selectedLabel = LAYERS.find((item) => item.id === layer)?.label ?? "Visual";

  return <main id="main-content" tabIndex={-1} className={styles.page}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>Earth Information Jukebox / Listen</p><h1>Search or upload. Choose the data. Hear the place.</h1><p>Explore one image or video. The data chips show what is available; the selected chip controls the sound.</p></div><div className={styles.headingLinks}><Link href="/listen/classic">Classic map</Link><Link href="/design/listen-redesign-report.html">Design report</Link></div></div>

    <div className={styles.workspace}>
      <aside className={`${styles.sidebar} ${historyOpen ? styles.sidebarOpen : ""}`} aria-label="Recent uploads and searches">
        <div className={styles.sidebarTop}><strong>History</strong><button type="button" className={styles.closeHistory} onClick={() => setHistoryOpen(false)}>Close</button></div>
        <button type="button" className={styles.newSource} onClick={() => inputRef.current?.click()}>+ Upload image or video</button>
        <p className={styles.sectionLabel}>Recent sources</p>
        <div className={styles.historyList}>{history.map((item) => <button type="button" key={item.id} className={`${styles.historyItem} ${source.id === item.id ? styles.historyActive : ""}`} onClick={() => selectSource(item)}><span>{item.mediaType === "video" ? "▣" : "▧"} {item.title}</span><small>{item.kind === "nasa" ? `NASA · ${item.center ?? "media"}` : item.kind === "upload" ? "Your upload · this session" : "Example image"}</small></button>)}</div>
        <p className={styles.sectionLabel}>Recent searches</p>
        <div className={styles.historyList}>{searchHistory.length ? searchHistory.map((term) => <button key={term} type="button" className={styles.searchHistory} onClick={() => void searchNASA(term)}>⌕ {term}</button>) : <span className={styles.emptyHistory}>Search NASA media to start a history.</span>}</div>
        <p className={styles.historyNote}>NASA picks and search terms stay in this browser. Uploaded files stay in this session.</p>
      </aside>

      <section className={styles.mainPanel} aria-label="Media exploration">
        <div className={styles.searchRow}><button className={styles.historyToggle} type="button" onClick={() => setHistoryOpen(true)}>☰ <span>History</span></button><form onSubmit={(event) => { event.preventDefault(); void searchNASA(); }} className={styles.searchForm}><label className="sr-only" htmlFor="nasa-search">Search NASA images and videos</label><input id="nasa-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search NASA images and videos" /><select aria-label="Media type" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="image,video">All media</option><option value="image">Images</option><option value="video">Videos</option></select><button type="submit" disabled={searching}>{searching ? "Searching…" : "Search"}</button></form><button className={styles.uploadButton} type="button" onClick={() => inputRef.current?.click()}>↑ <span>Upload</span></button><input ref={inputRef} type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => { onUpload(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></div>
        <div className={styles.layerChips} role="group" aria-label="Data layer to hear">{LAYERS.map((item) => <button key={item.id} type="button" aria-pressed={layer === item.id} title={item.hint} className={`${styles.chip} ${layer === item.id ? styles.chipActive : ""}`} onClick={() => setLayer(item.id)}>{item.label}</button>)}</div>
        {message && <p className={styles.message} role="status">{message}</p>}
        {showResults ? <div className={styles.results}><div className={styles.resultsHeader}><div><p className={styles.sectionLabel}>NASA Image and Video Library</p><h2>{searching ? "Searching NASA…" : `${results.length} results for “${query}”`}</h2></div><button type="button" onClick={() => setShowResults(false)}>Back to media</button></div><div className={styles.resultGrid}>{results.map((item) => <button type="button" className={styles.resultCard} key={item.id} onClick={() => void chooseNASA(item)}><img src={item.preview} alt="" loading="lazy" /><span>{item.mediaType === "video" ? "VIDEO" : "IMAGE"} · {item.center}</span><strong>{item.title}</strong><small>{item.date?.slice(0, 10) ?? "Date unavailable"}</small></button>)}</div>{!searching && !results.length && <p>No results. Try “ocean currents,” “carbon dioxide,” or another Earth topic.</p>}</div> : <>
          <div className={styles.mediaHeading}><div><p className={styles.sectionLabel}>{source.kind === "nasa" ? "NASA media" : source.kind === "upload" ? "Your upload" : "Example source"}</p><h2>{source.title}</h2></div><span>{source.mediaType === "video" ? "Video" : "Image"}</span></div>
          <div className={styles.mediaStage} ref={stageRef} onPointerMove={(event) => { if (event.pointerType === "mouse" || event.buttons) sample(event.clientX, event.clientY); }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); sample(event.clientX, event.clientY); }} onKeyDown={(event) => { if (!stageRef.current || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); const rect = stageRef.current.getBoundingClientRect(); const x = visual?.x ?? 0.5, y = visual?.y ?? 0.5; sample(rect.left + clamp(x + (event.key === "ArrowRight" ? 0.05 : event.key === "ArrowLeft" ? -0.05 : 0), 0.01, 0.99) * rect.width, rect.top + clamp(y + (event.key === "ArrowDown" ? 0.05 : event.key === "ArrowUp" ? -0.05 : 0), 0.01, 0.99) * rect.height); }} tabIndex={0} role="img" aria-label="Media probe. Move, drag, or use arrow keys to inspect the image or video.">
            {source.mediaType === "video" ? <video key={source.id} ref={videoRef} src={source.video ?? source.preview} poster={source.preview} controls playsInline crossOrigin="anonymous" onTimeUpdate={() => { if (lastPointer.current) sample(lastPointer.current.x, lastPointer.current.y); }} /> : <img key={source.id} ref={imageRef} src={source.preview} alt={source.title} crossOrigin="anonymous" />}
            {visual && <span className={styles.probe} style={{ left: `${visual.x * 100}%`, top: `${visual.y * 100}%` }} aria-hidden="true" />}
            <span className={styles.probeHint}>{source.mediaType === "video" ? "Play, then drag or hover to hear the frame" : "Drag, hover, or use arrow keys to hear the image"}</span>
          </div><canvas ref={canvasRef} hidden />
          <div className={styles.readings}><div className={styles.readingsTop}><strong>Live readings</strong><span>{source.kind === "nasa" ? `NASA ID ${source.id}` : source.center}</span></div><div className={styles.readingGrid}><div className={`${styles.readingCard} ${layer === "visual" ? styles.readingSelected : ""}`}><small>Visual pattern · image-derived</small><strong>{visual?.label ?? "Move over the media"}</strong><span>{visual ? `RGB ${visual.rgb}` : "No pixel sampled yet"}</span></div>{LAYERS.filter((item) => item.id !== "visual").map((item) => <div key={item.id} className={`${styles.readingCard} ${layer === item.id ? styles.readingSelected : ""}`}><small>{item.label} · {item.id === "co2" ? "NASA OCO-2" : "Meteomatics"}</small><strong>{readings[item.id] ? `${readings[item.id]?.value.toFixed(1)} ${readings[item.id]?.unit}` : "—"}</strong><span>{readings[item.id] ? `${readings[item.id]?.time.slice(0, 16)} UTC` : item.id === "co2" ? "Open NASA CO₂ visualization" : "Needs matched place + time"}</span></div>)}</div></div>

        </>}
      </section>

      <aside className={styles.soundPanel} aria-label="Sound controls"><p className={styles.sectionLabel}>Sound profile</p><h2>Hear this region as</h2><p className={styles.soundCopy}>One source, several voices. The selected data chip controls the live sound.</p><p className={styles.sectionLabel}>Instrument</p><div className={styles.soundChips}>{INSTRUMENTS.map((item) => <button type="button" key={item.id} aria-pressed={instrument === item.id} className={`${styles.chip} ${instrument === item.id ? styles.chipActive : ""}`} onClick={() => setInstrument(item.id)}>{item.label}</button>)}</div><p className={styles.sectionLabel}>Variation</p><div className={styles.soundChips}>{VARIATIONS.map((item) => <button type="button" key={item.id} aria-pressed={variation === item.id} className={`${styles.chip} ${variation === item.id ? styles.chipActive : ""}`} onClick={() => setVariation(item.id)}>{item.label}</button>)}</div><button type="button" className={styles.playButton} onClick={() => void toggleSound()}>{soundOn ? "■ Stop sound" : "▶ Play sound"}</button><div className={styles.soundReadout}><span>Listening to</span><strong>{selectedLabel}</strong><span>Current value</span><strong>{currentValue === null ? "No matched value" : layer === "visual" ? visual?.label ?? "Move over media" : `${readings[layer]?.value.toFixed(1)} ${readings[layer]?.unit}`}</strong></div><button type="button" className={styles.generateButton} onClick={() => void generateVariation()} disabled={generating}>{generating ? "Generating…" : "Generate a new texture with ElevenLabs"}</button><p className={styles.soundFine}>This requests one five-second loop and may use ElevenLabs credits. The browser keeps the live probe responsive.</p>{soundStatus && <p className={styles.soundStatus} role="status">{soundStatus}</p>}{generatedUrl && <audio ref={generatedAudioRef} src={generatedUrl} loop controls preload="none" className={styles.generatedAudio} aria-label="Generated ElevenLabs sound loop" />}<div className={styles.sourceCredit}><strong>Source</strong><span>{source.center ?? "Unknown"}</span>{source.date && <span>{source.date.slice(0, 10)}</span>}{source.kind === "nasa" && <a href={`https://images.nasa.gov/details/${encodeURIComponent(source.id)}`} target="_blank" rel="noopener noreferrer">View NASA record ↗</a>}</div></aside>
          <div className={styles.context}><div><p className={styles.sectionLabel}>Add context for measurements</p><p>Uploads and NASA media usually do not include a usable pixel-to-coordinate map. Enter the place and UTC time you want measured, then load matching data.</p></div><div className={styles.contextInputs}><label>Latitude<input type="number" min="-90" max="90" step="any" value={lat} onChange={(event) => setLat(event.target.value)} placeholder="30" /></label><label>Longitude<input type="number" min="-180" max="180" step="any" value={lon} onChange={(event) => setLon(event.target.value)} placeholder="-40" /></label><label>UTC time<input type="datetime-local" value={time} onChange={(event) => setTime(event.target.value)} /></label><button type="button" disabled={loadingData} onClick={() => void loadMeasurements()}>{loadingData ? "Loading…" : "Load data"}</button></div><p className={styles.contextStatus} role="status">{measurementStatus} <a href={NASA_CO2_URL} target="_blank" rel="noopener noreferrer">Explore NASA OCO-2 CO₂ ↗</a></p></div>
    </div>
  </main>;
}
