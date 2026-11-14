"use client";

import { useEffect, useId, useRef, useState } from "react";

const POINTS = [
  { id: "A", t: 1958 + 2 / 12, ppm: 315.71, date: "Mar 1958", note: "First reading" },
  { id: "B", t: 2026 + 4 / 12, ppm: 432.34, date: "May 2026", note: "Record high" },
  { id: "C", t: 2026 + 8 / 12, ppm: 426.07, date: "Sep 2026", note: "Latest reading" },
] as const;

const MONTHS = 823;

export function RecordChart() {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const [width, setWidth] = useState(960);
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const measure = () => {
      setWidth(node.clientWidth);
      setPhone(window.innerWidth <= 1000);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const height = phone ? 560 : 468;
  const plot = phone
    ? { x0: 44, x1: Math.max(120, width - 8), y0: 24, y1: 280 }
    : { x0: 72, x1: width * 0.74, y0: 28, y1: 372 };
  const t0 = 1956;
  const t1 = 2027;
  const v0 = 300;
  const v1 = 440;
  const xOf = (t: number) => plot.x0 + ((t - t0) / (t1 - t0)) * (plot.x1 - plot.x0);
  const yOf = (v: number) => plot.y1 - ((v - v0) / (v1 - v0)) * (plot.y1 - plot.y0);
  const [first, record, latest] = POINTS;
  const drop = (record.ppm - latest.ppm).toFixed(2);
  const zoom = phone
    ? { x0: 44, x1: Math.max(160, width - 24), y0: 420, y1: 512 }
    : { x0: width * 0.8, x1: width - 16, y0: 64, y1: 300 };
  const it0 = 2026 + 3 / 12;
  const it1 = 2026 + 9 / 12;
  const ix = (t: number) => zoom.x0 + ((t - it0) / (it1 - it0)) * (zoom.x1 - zoom.x0);
  const iy = (v: number) => zoom.y1 - ((v - 424) / (434 - 424)) * (zoom.y1 - zoom.y0);
  const barY = plot.y1 + 14;

  return (
    <section className="record" aria-labelledby={labelId}>
      <div className="record-title">
        <h2 id={labelId}>The</h2>
        <h2>
          Mauna Loa CO<span className="sub2">2</span>
        </h2>
        <h2>Record as music</h2>
      </div>
      <div className="record-chart" ref={hostRef}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Mauna Loa CO₂: 315.71 ppm in March 1958, a 432.34 ppm record in May 2026, and 426.07 ppm in September 2026. 823 monthly readings, 163 record highs.">
          {[320, 360, 400, 440].map((value) => (
            <g key={value}>
              <line x1={plot.x0} x2={plot.x1} y1={yOf(value)} y2={yOf(value)} stroke="#f2f2f0" strokeOpacity="0.08" />
              <text x={plot.x0 - 8} y={yOf(value) + 4} textAnchor="end" fill="#aaaaaa" fontSize="12" fontFamily="Geist Mono, monospace">
                {value}
              </text>
            </g>
          ))}
          <text x={plot.x0 - 8} y={plot.y0 - 8} textAnchor="end" fill="#aaaaaa" fontSize="12" fontFamily="Geist Mono, monospace">
            PPM
          </text>
          {Array.from({ length: MONTHS }, (_, index) => {
            const t = 1958 + (2 + index) / 12;
            const january = (2 + index) % 12 === 0;
            return (
              <rect
                key={t}
                x={xOf(t)}
                y={january ? barY - 4 : barY}
                width="0.6"
                height={january ? 22 : 18}
                fill="#f2f2f0"
                fillOpacity={january ? 0.55 : 0.2}
              />
            );
          })}
          {[1960, 1970, 1980, 2000, 2010, 2020].map((year) => (
            <text key={year} x={xOf(year)} y={barY + 36} textAnchor="middle" fill="#aaaaaa" fontSize="12" fontFamily="Geist Mono, monospace">
              {year}
            </text>
          ))}
          <polyline
            points={`${xOf(first.t)},${yOf(first.ppm)} ${xOf(record.t)},${yOf(record.ppm)}`}
            fill="none"
            stroke="#f2f2f0"
            strokeOpacity="0.5"
            strokeDasharray="2 5"
          />
          <text x={xOf(phone ? 1962 : 1972)} y={yOf(316) + (phone ? 17 : 14)} fill="#aaaaaa" fontSize="12" fontFamily="Geist Mono, monospace">
            Straight line between published points, not the monthly curve
          </text>
          <g>
            <line x1={xOf(first.t)} x2={xOf(first.t)} y1={yOf(first.ppm)} y2={barY - 6} stroke="#f2f2f0" strokeOpacity="0.22" strokeDasharray="1 3" />
            <rect x={xOf(first.t) - 6} y={yOf(first.ppm) - 6} width="12" height="12" fill="#f2f2f0" />
            <rect x={xOf(first.t) + 9} y={yOf(first.ppm) - 24} width="18" height="18" fill="#f2f2f0" />
            <text x={xOf(first.t) + 18} y={yOf(first.ppm) - 11} textAnchor="middle" fill="#141414" fontSize="11" fontFamily="Geist Mono, monospace" fontWeight="700">
              A
            </text>
          </g>
          <rect
            x={xOf(2026.5) - 9}
            y={yOf(record.ppm) - 9}
            width="18"
            height={yOf(latest.ppm) - yOf(record.ppm) + 18}
            fill="none"
            stroke="#f2f2f0"
          />
          <rect x={zoom.x0 - 12} y={zoom.y0 - 34} width={zoom.x1 - zoom.x0 + 24} height={zoom.y1 - zoom.y0 + 64} fill="#262626" stroke="#f2f2f0" strokeOpacity="0.45" />
          <text x={zoom.x0} y={zoom.y0 - 14} fill="#aaaaaa" fontSize="12" fontFamily="Geist Mono, monospace">
            2026 · ZOOM
          </text>
          <line x1={ix(record.t)} x2={ix(latest.t)} y1={iy(record.ppm)} y2={iy(latest.ppm)} stroke="#f2f2f0" strokeOpacity="0.5" strokeDasharray="2 5" />
          {[record, latest].map((point) => (
            <g key={`z-${point.id}`}>
              <rect x={ix(point.t) - 6} y={iy(point.ppm) - 6} width="12" height="12" fill="#f2f2f0" />
              <rect x={ix(point.t) + 9} y={iy(point.ppm) - 24} width="18" height="18" fill="#f2f2f0" />
              <text x={ix(point.t) + 18} y={iy(point.ppm) - 11} textAnchor="middle" fill="#141414" fontSize="11" fontFamily="Geist Mono, monospace" fontWeight="700">
                {point.id}
              </text>
            </g>
          ))}
          <text x={(ix(record.t) + ix(latest.t)) / 2} y={(iy(record.ppm) + iy(latest.ppm)) / 2 + 28} textAnchor="middle" fill="#f2f2f0" fontSize="12" fontFamily="Geist Mono, monospace">
            −{drop} PPM
          </text>
        </svg>
      </div>
      <ol className="record-notes">
        {POINTS.map((point) => (
          <li key={point.id}>
            <p className="am-label">{point.date}</p>
            <strong>
              {point.ppm} <small>ppm</small>
            </strong>
            <p className="am-label">{point.note}</p>
          </li>
        ))}
      </ol>
      <div className="record-cap">
        <p className="am-label">823 months · 163 record highs · May → Sep 2026 −{drop} ppm (seasonal swing ~6 ppm; 2025: 6.14)</p>
        <p className="am-label">Only the readings SonifySphere publishes are plotted. Data: NOAA GML Mauna Loa.</p>
      </div>
    </section>
  );
}
