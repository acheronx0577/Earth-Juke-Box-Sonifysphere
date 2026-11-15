"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChamferMark } from "@/components/listen/ChamferMark";
import styles from "@/components/listen/colormap/colormap.module.css";

const DATE = "2024-06-01";
const TILE = { z: 1, x: 0, y: 0 };

interface Reading {
  value?: number;
  unit?: string;
  range?: string;
  label?: string;
  r?: number;
  g?: number;
  b?: number;
  error?: string;
}

export function ColorMapReading() {
  const imageRef = useRef<HTMLImageElement>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [status, setStatus] = useState("Choose a pixel on the MERRA-2 colour map.");
  const [error, setError] = useState("");
  const src = `/api/listen/gibs-colormap/tile?date=${DATE}&z=${TILE.z}&x=${TILE.x}&y=${TILE.y}`;

  const read = async (px: number, py: number) => {
    setStatus("Reading the colour…");
    setError("");
    try {
      const response = await fetch(`/api/listen/gibs-colormap?date=${DATE}&z=${TILE.z}&x=${TILE.x}&y=${TILE.y}&px=${px}&py=${py}`);
      const body = await response.json() as Reading;
      if (!response.ok || typeof body.value !== "number") {
        setReading(null);
        setError(body.error ?? "No reading for this place and time");
        setStatus("");
        return;
      }
      setReading(body);
      setStatus(`${body.value} ${body.unit}. ${body.range}. image-derived.`);
    } catch {
      setError("The data service could not be reached");
      setStatus("");
    }
  };

  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <div className={styles.stack}>
        <p className={styles.kicker}>NASA GIBS · MERRA-2</p>
        <h1 className={styles.title}>Colour map to a value</h1>
        <p className={styles.lede}>
          One monthly layer, MERRA-2 2 m air temperature. A pixel colour is matched to the GIBS colour map and shown in kelvin. This is image-derived, not a measurement.
        </p>
        <div className={styles.columns}>
          <section className={`${styles.frame} lv-cut`} aria-label="GIBS colour tile">
            <ChamferMark />
            <img
              ref={imageRef}
              src={src}
              alt="MERRA-2 2 m air temperature colour tile for June 2024. image-derived, not a measurement."
              onClick={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                const px = Math.min(
                  event.currentTarget.naturalWidth - 1,
                  Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * event.currentTarget.naturalWidth)),
                );
                const py = Math.min(
                  event.currentTarget.naturalHeight - 1,
                  Math.max(0, Math.floor(((event.clientY - box.top) / box.height) * event.currentTarget.naturalHeight)),
                );
                void read(px, py);
              }}
            />
          </section>
          <section className="lv-cut" aria-label="Image-derived reading">
            <ChamferMark />
            <div className={styles.face}>
              <p className={styles.quiet}>MERRA-2 2 m air temperature · June 2024</p>
              {reading ? (
                <>
                  <p className={styles.value}>{reading.value} {reading.unit}</p>
                  <p className={styles.lede}>{reading.range}</p>
                  <p className={styles.lede}>
                    <i className={`${styles.swatch} lv-cut`} style={{ background: `rgb(${reading.r}, ${reading.g}, ${reading.b})` }} aria-hidden="true">
                      <ChamferMark />
                    </i>
                    {" "}image-derived
                  </p>
                </>
              ) : <p className={styles.lede}>No pixel read yet.</p>}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.button} lv-cut`}
                  onClick={() => {
                    const image = imageRef.current;
                    if (!image?.naturalWidth) return;
                    void read(Math.floor(image.naturalWidth / 2), Math.floor(image.naturalHeight / 2));
                  }}
                >
                  <ChamferMark />
                  <span className={styles.buttonText}>Read center pixel</span>
                </button>
              </div>
              <Link href="/listen">Back to Listen</Link>
            </div>
          </section>
        </div>
        <p className={styles.status} role="status" aria-live="polite">{status}</p>
        {error ? <p className={styles.status} role="alert">{error}</p> : null}
      </div>
    </main>
  );
}
