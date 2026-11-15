"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChamferMark } from "@/components/listen/ChamferMark";
import { pulsesForEvents } from "@/lib/nasa/eventPulse";
import type { EonetEvent } from "@/lib/nasa/eonet";
import { onPlaybackStopped, playbackAllowed } from "@/lib/playbackGate";
import styles from "@/components/listen/events/events.module.css";

const DEFAULT_VIEW = { west: "-130", south: "24", east: "-66", north: "50", days: "30", category: "" };

export function EventPulses() {
  const formId = useId();
  const stopRef = useRef<(() => void) | null>(null);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [events, setEvents] = useState<EonetEvent[]>([]);
  const [status, setStatus] = useState("Loading open events…");
  const [error, setError] = useState("");
  const [cached, setCached] = useState(false);

  useEffect(() => onPlaybackStopped(() => stopRef.current?.()), []);

  useEffect(() => {
    const controller = new AbortController();
    void load(DEFAULT_VIEW, controller.signal);
    return () => controller.abort();
    async function load(next: typeof DEFAULT_VIEW, signal: AbortSignal) {
      setStatus("Loading open events…");
      setError("");
      const params = new URLSearchParams({
        bbox: `${next.west},${next.south},${next.east},${next.north}`,
        days: next.days,
        status: "open",
      });
      if (next.category) params.set("category", next.category);
      try {
        const response = await fetch(`/api/listen/events?${params}`, { signal });
        const body = await response.json() as { events?: EonetEvent[]; error?: string; cached?: boolean };
        if (!response.ok || !body.events) {
          setEvents([]);
          setError(body.error ?? "The data service could not be reached");
          setStatus("");
          return;
        }
        setEvents(body.events);
        setCached(Boolean(body.cached));
        setError("");
        setStatus(body.events.length
          ? `${body.events.length} open ${body.events.length === 1 ? "event" : "events"} in this view.${body.cached ? " Cached." : ""}`
          : "No open events in this view.");
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("The data service could not be reached");
        setStatus("");
      }
    }
  }, []);

  const show = async (next = view) => {
    setStatus("Loading open events…");
    setError("");
    const params = new URLSearchParams({
      bbox: `${next.west},${next.south},${next.east},${next.north}`,
      days: next.days,
      status: "open",
    });
    if (next.category) params.set("category", next.category);
    try {
      const response = await fetch(`/api/listen/events?${params}`);
      const body = await response.json() as { events?: EonetEvent[]; error?: string; cached?: boolean };
      if (!response.ok || !body.events) {
        setEvents([]);
        setError(body.error ?? "The data service could not be reached");
        setStatus("");
        return;
      }
      setEvents(body.events);
      setCached(Boolean(body.cached));
      setStatus(body.events.length
        ? `${body.events.length} open ${body.events.length === 1 ? "event" : "events"} in this view.${body.cached ? " Cached." : ""}`
        : "No open events in this view.");
    } catch {
      setError("The data service could not be reached");
      setStatus("");
    }
  };

  const play = async () => {
    stopRef.current?.();
    stopRef.current = null;
    if (!playbackAllowed()) {
      setStatus("Sound is stopped.");
      return;
    }
    const pulses = pulsesForEvents(events);
    if (pulses.length === 0) {
      setStatus("No open events in this view.");
      return;
    }
    const Tone = await import("tone");
    if (!playbackAllowed()) return;
    await Tone.start();
    const voices = {
      sine: new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.08 } }).toDestination(),
      membrane: new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.04 } }).toDestination(),
      fm: new Tone.FMSynth({ harmonicity: 2, modulationIndex: 4, envelope: { attack: 0.01, decay: 0.16, sustain: 0, release: 0.1 } }).toDestination(),
      noise: new Tone.NoiseSynth({ noise: { type: "brown" }, envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.04 } }).toDestination(),
    };
    let time = Tone.now() + 0.05;
    for (const pulse of pulses) {
      if (pulse.instrument === "noise") voices.noise.triggerAttackRelease(pulse.duration, time, pulse.gain);
      else voices[pulse.instrument].triggerAttackRelease(pulse.frequency, pulse.duration, time, pulse.gain);
      time += 0.28;
    }
    const timer = setTimeout(() => {
      Object.values(voices).forEach((voice) => voice.dispose());
    }, pulses.length * 280 + 1000);
    stopRef.current = () => {
      clearTimeout(timer);
      Object.values(voices).forEach((voice) => voice.dispose());
    };
    setStatus(`Playing ${pulses.length} open ${pulses.length === 1 ? "event" : "events"} as pulses. The list below is the same sequence.`);
  };

  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <div className={styles.stack}>
        <p className={styles.kicker}>NASA EONET · v3</p>
        <h1 className={styles.title}>Open events in view</h1>
        <p className={styles.lede}>
          Each open event plays as one pulse. The category chooses the instrument. Magnitude, when EONET provides it, sets the loudness. Closed events would be longer and quieter. Nothing plays until you press play.
        </p>
        <div className={styles.columns}>
          <section className="lv-cut" aria-label="Choose a view">
            <ChamferMark />
            <form
              className={styles.face}
              onSubmit={(event) => {
                event.preventDefault();
                void show();
              }}
            >
              <div className={styles.fields}>
                <NumberField label="West" value={view.west} onChange={(west) => setView({ ...view, west })} />
                <NumberField label="South" value={view.south} onChange={(south) => setView({ ...view, south })} />
                <NumberField label="East" value={view.east} onChange={(east) => setView({ ...view, east })} />
                <NumberField label="North" value={view.north} onChange={(north) => setView({ ...view, north })} />
                <NumberField label="Days" value={view.days} onChange={(days) => setView({ ...view, days })} />
                <label className={styles.field} htmlFor={`${formId}-category`}>
                  Category
                  <span className={`${styles.inset} lv-cut`}>
                    <ChamferMark />
                    <select id={`${formId}-category`} className={styles.control} value={view.category} onChange={(event) => setView({ ...view, category: event.target.value })}>
                      <option value="">All</option>
                      {CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                  </span>
                </label>
              </div>
              <div className={styles.actions}>
                <button type="submit" className={`${styles.button} lv-cut`}>
                  <ChamferMark />
                  <span className={styles.buttonText}>Show events</span>
                </button>
                <button
                  type="button"
                  className={`${styles.button} lv-cut`}
                  onClick={() => {
                    const next = { ...view, west: "-180", south: "-90", east: "180", north: "90" };
                    setView(next);
                    void show(next);
                  }}
                >
                  <ChamferMark />
                  <span className={styles.buttonText}>Whole Earth</span>
                </button>
                <button type="button" className={`${styles.button} lv-cut`} onClick={() => void play()} disabled={events.length === 0}>
                  <ChamferMark />
                  <span className={styles.buttonText}>Play pulses</span>
                </button>
              </div>
              <p className={styles.quiet}>{cached ? "Cached EONET events" : "NASA EONET"}</p>
              <Link href="/listen">Back to Listen</Link>
            </form>
          </section>
          <section aria-label="Open events">
            {events.length === 0 ? <p className={styles.lede}>No open events in this view.</p> : null}
            <ul className={styles.list}>
              {events.map((event) => (
                <li key={event.id} className={`${styles.item} lv-cut`}>
                  <ChamferMark />
                  <div className={styles.face}>
                    <p className={styles.quiet}>{event.categoryTitle} · {event.open ? "Open" : "Closed"}</p>
                    <h2>{event.title}</h2>
                    <p className={styles.lede}>
                      {event.lat.toFixed(2)}°, {event.lon.toFixed(2)}°
                      {event.time ? ` · ${event.time.replace(".000Z", " UTC").replace("T", " ")}` : ""}
                    </p>
                    <p className={styles.lede}>{event.magnitude === null ? "Magnitude not provided" : `${event.magnitude} ${event.magnitudeUnit ?? ""}`.trim()}</p>
                    <a href={event.link} target="_blank" rel="noreferrer">EONET record</a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <p className={styles.status} role="status" aria-live="polite">{status}</p>
        {error ? <p className={styles.status} role="alert">{error}</p> : null}
      </div>
    </main>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <label className={styles.field} htmlFor={id}>
      {label}
      <span className={`${styles.inset} lv-cut`}>
        <ChamferMark />
        <input id={id} className={styles.control} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  );
}

const CATEGORIES = [
  { id: "wildfires", label: "Wildfires" },
  { id: "severeStorms", label: "Severe storms" },
  { id: "volcanoes", label: "Volcanoes" },
  { id: "floods", label: "Floods" },
  { id: "earthquakes", label: "Earthquakes" },
  { id: "seaLakeIce", label: "Sea and lake ice" },
  { id: "drought", label: "Drought" },
  { id: "dustHaze", label: "Dust and haze" },
  { id: "landslides", label: "Landslides" },
  { id: "snow", label: "Snow" },
  { id: "tempExtremes", label: "Temperature extremes" },
  { id: "waterColor", label: "Water color" },
  { id: "manmade", label: "Manmade" },
] as const;
