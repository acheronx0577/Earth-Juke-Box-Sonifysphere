"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChamferMark } from "@/components/listen/ChamferMark";
import type { EpicFrame } from "@/lib/nasa/epicTypes";
import { onPlaybackStopped, playbackAllowed } from "@/lib/playbackGate";
import { loadTone } from "@/lib/toneLoader";
import styles from "@/components/listen/epic/epic.module.css";

interface FramePayload {
  date?: string;
  quality?: string;
  cached?: boolean;
  stale?: boolean;
  attribution?: string;
  frames?: EpicFrame[];
  error?: string;
}

export function EpicSource() {
  const dateId = useId();
  const imageRef = useRef<HTMLImageElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [frames, setFrames] = useState<EpicFrame[]>([]);
  const [index, setIndex] = useState(0);
  const [cached, setCached] = useState(false);
  const [attribution, setAttribution] = useState("NASA EPIC (DSCOVR)");
  const [status, setStatus] = useState("Loading EPIC frames…");
  const [error, setError] = useState("");
  const [hearing, setHearing] = useState("");

  useEffect(() => onPlaybackStopped(() => stopRef.current?.()), []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/listen/epic?dates=14", { signal: controller.signal });
        const body = await response.json() as { dates?: string[]; error?: string };
        if (!response.ok || !body.dates?.length) {
          setError(body.error ?? "No EPIC frames for this date.");
          setStatus("");
          return;
        }
        setDates(body.dates);
        setDate((current) => current || body.dates?.[body.dates.length - 1] || "");
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("The data service could not be reached");
        setStatus("");
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    setStatus("Loading EPIC frames…");
    setError("");
    void (async () => {
      try {
        const response = await fetch(`/api/listen/epic?date=${encodeURIComponent(date)}`, { signal: controller.signal });
        const body = await response.json() as FramePayload;
        if (!response.ok || !body.frames?.length) {
          setFrames([]);
          setError(body.error ?? "No EPIC frames for this date.");
          setStatus("");
          return;
        }
        setFrames(body.frames);
        setIndex(0);
        setCached(Boolean(body.cached));
        setAttribution(body.attribution ?? "NASA EPIC (DSCOVR)");
        setError("");
        setStatus(`${body.frames.length} whole-Earth ${body.frames.length === 1 ? "frame" : "frames"} for ${body.date}. Image-derived, not a measurement.${body.cached ? " Cached." : ""}`);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("The data service could not be reached");
        setStatus("");
      }
    })();
    return () => controller.abort();
  }, [date]);

  const frame = frames[index] ?? null;

  const play = async () => {
    stopRef.current?.();
    stopRef.current = null;
    if (!playbackAllowed()) {
      setHearing("Sound is stopped.");
      return;
    }
    const image = imageRef.current;
    const brightness = image ? averageLuminance(image) : null;
    if (brightness === null) {
      setHearing("No pixel sampled yet.");
      return;
    }
    const Tone = await loadTone();
    if (!playbackAllowed()) return;
    await Tone.start();
    const synth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.02, decay: 0.18, sustain: 0.12, release: 0.25 },
    }).toDestination();
    const frequency = Math.round(180 + brightness * 440);
    synth.triggerAttackRelease(frequency, "2n");
    const timer = setTimeout(() => synth.dispose(), 2200);
    stopRef.current = () => {
      clearTimeout(timer);
      synth.dispose();
    };
    setHearing(`Image-derived brightness ${Math.round(brightness * 100)} of 100, about ${frequency} hertz. Not a measurement.`);
  };

  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <div className={styles.stack}>
        <p className={styles.kicker}>NASA EPIC · DSCOVR</p>
        <h1 className={styles.title}>Whole-Earth frames</h1>
        <p className={styles.lede}>
          Natural-color frames from the EPIC camera. The sound follows image brightness and is labeled image-derived. It is not a measurement.
        </p>
        <div className={styles.columns}>
          <section className={`${styles.shell} lv-cut`} aria-label="Choose a date">
            <ChamferMark />
            <div className={styles.face}>
              <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
                <label className={styles.field} htmlFor={dateId}>
                  Date
                  <span className={`${styles.inset} lv-cut`}>
                    <ChamferMark />
                    <select id={dateId} className={styles.control} value={date} onChange={(event) => setDate(event.target.value)}>
                      {dates.length === 0 ? <option value="">Loading dates…</option> : null}
                      {dates.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </span>
                </label>
              </form>
              <p className={styles.quiet}>{attribution}</p>
              <Link className={styles.link} href="/listen">Back to Listen</Link>
            </div>
          </section>
          <section className={`${styles.shell} lv-cut`} aria-label="EPIC frame">
            <ChamferMark />
            <div className={styles.face}>
              <div className={`${styles.frame} lv-cut`}>
                <ChamferMark />
                {frame ? (
                  <img ref={imageRef} src={frame.image} alt={`${frame.caption}. ${frame.time} UTC. Image-derived NASA EPIC frame, not a measurement.`} />
                ) : (
                  <p className={styles.lede}>No frame loaded.</p>
                )}
              </div>
              {frame ? (
                <dl className={styles.facts}>
                  <div>
                    <dt>Time</dt>
                    <dd>{frame.time.replace(".000Z", " UTC").replace("T", " ")}</dd>
                  </div>
                  <div>
                    <dt>Centroid</dt>
                    <dd>{frame.centroid ? `${frame.centroid.lat.toFixed(2)}°, ${frame.centroid.lon.toFixed(2)}°` : "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Quality</dt>
                    <dd>image-derived</dd>
                  </div>
                  <div>
                    <dt>Cache</dt>
                    <dd>{cached ? "Cached" : "Live"}</dd>
                  </div>
                </dl>
              ) : null}
              <p className={styles.lede}>{frame?.caption}</p>
              <div className={styles.actions}>
                <button type="button" className={`${styles.button} lv-cut`} onClick={() => void play()} disabled={!frame}>
                  <ChamferMark />
                  <span className={styles.buttonText}>Play image-derived tone</span>
                </button>
              </div>
              {hearing ? <p className={styles.quiet}>{hearing}</p> : null}
            </div>
          </section>
        </div>
        {frames.length > 1 ? (
          <div className={styles.frames} role="group" aria-label="Frames on this date">
            {frames.map((item, itemIndex) => (
              <button
                type="button"
                key={item.id}
                className={`${styles.button} lv-cut`}
                aria-pressed={itemIndex === index}
                onClick={() => setIndex(itemIndex)}
              >
                <ChamferMark />
                <span className={styles.buttonText}>Frame {itemIndex + 1}</span>
              </button>
            ))}
          </div>
        ) : null}
        <p className={styles.status} role="status" aria-live="polite">{status}</p>
        {error ? <p className={styles.status} role="alert">{error}</p> : null}
      </div>
    </main>
  );
}

function averageLuminance(image: HTMLImageElement): number | null {
  if (!image.complete || image.naturalWidth < 1) return null;
  const canvas = document.createElement("canvas");
  const size = 24;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, size, size);
  let sum = 0;
  let count = 0;
  const pixels = context.getImageData(0, 0, size, size).data;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] < 10) continue;
    sum += (0.2126 * pixels[offset] + 0.7152 * pixels[offset + 1] + 0.0722 * pixels[offset + 2]) / 255;
    count += 1;
  }
  if (count === 0) return null;
  return sum / count;
}
