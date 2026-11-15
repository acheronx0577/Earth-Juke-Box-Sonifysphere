"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_REGIONS } from "@/data/exploreMap";
import { REGION_SHAPES } from "@/components/listen/regionGeometry";
import { CENTRAL_MERIDIAN, MAP_VIEW, project, ringPath, unproject } from "@/components/listen/v4/equalEarth";
import { legendFromMetadata, legendFromPixels, legendGradient, type LegendModel } from "@/components/listen/v4/legend";
import { legendMetaFor, type LayerId, type ListenSource } from "@/components/listen/v4/model";

function landFill(layer: LayerId, anomaly: number, seaIce: boolean, id: string): string {
  if (layer === "sea-ice") return seaIce || id === "antarctica" ? "#d5e6ee" : "#2a2a2a";
  if (layer === "co2" || layer === "methane" || layer === "air" || layer === "currents" || layer === "wind") return "#3a3a3a";
  if (id === "oceania" || anomaly <= -0.7) return "#5c547c";
  if (id === "antarctica") return "#2e2926";
  return "#463c34";
}

const LAND_IDS = new Set(["north-america", "south-america", "europe", "africa", "asia", "oceania", "antarctica"]);

function pathsForLand() {
  return REGION_SHAPES.filter((shape) => LAND_IDS.has(shape.id)).map((shape) => {
    const region = MAP_REGIONS.find((item) => item.id === shape.id);
    const stride = shape.rings[0] && shape.rings[0].length > 240 ? 2 : 1;
    return {
      id: shape.id,
      anomaly: region?.anomaly ?? 0,
      seaIce: region?.seaIce ?? false,
      d: shape.rings.map((ring) => ringPath(ring, stride)).join(" "),
    };
  });
}

let landPaths: ReturnType<typeof pathsForLand> | null = null;
function getLandPaths() {
  landPaths ??= pathsForLand();
  return landPaths;
}

function graticule(): string[] {
  const lines: string[] = [];
  for (let lng = -180; lng <= 180; lng += 30) {
    const pts: string[] = [];
    for (let lat = -80; lat <= 80; lat += 8) {
      const [x, y] = project(lng, lat);
      pts.push(`${lat === -80 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    lines.push(pts.join(""));
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts: string[] = [];
    for (let shifted = -180; shifted <= 180; shifted += 8) {
      const [x, y] = project(shifted + CENTRAL_MERIDIAN, lat);
      pts.push(`${shifted === -180 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    lines.push(pts.join(""));
  }
  return lines;
}

const GRID = graticule();
const NINO = [
  project(-170, 5),
  project(-120, 5),
  project(-120, -5),
  project(-170, -5),
];
const NINO_LABEL = project(-170, 8.2);

interface ListenMapProps {
  readonly source: ListenSource;
  readonly layer: LayerId;
  readonly lat: number;
  readonly lng: number;
  readonly onProbe: (lat: number, lng: number, release: boolean) => void;
  readonly legend: LegendModel;
  readonly onLegend: (legend: LegendModel) => void;
  readonly tip: string;
  readonly coord: string;
}

async function sampleImage(img: CanvasImageSource, width: number, height: number): Promise<ImageData | null> {
  const canvas = document.createElement("canvas");
  const max = 96;
  const scale = Math.min(1, max / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

export function ListenMap({ source, layer, lat, lng, onProbe, legend, onLegend, tip, coord }: ListenMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [tipPos, setTipPos] = useState({ x: 180, y: 120 });
  const [frame, setFrame] = useState(0);
  const land = useMemo(() => getLandPaths(), []);
  const [px, py] = project(lng, lat);
  const mapMode = source.kind === "map";

  useEffect(() => {
    const stage = stageRef.current;
    const svg = svgRef.current;
    if (!stage || !svg || !mapMode) return;
    const point = svg.createSVGPoint();
    point.x = px;
    point.y = py;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const screen = point.matrixTransform(ctm);
    const box = stage.getBoundingClientRect();
    setTipPos({ x: screen.x - box.left, y: screen.y - box.top });
  }, [px, py, mapMode, lat, lng]);

  useEffect(() => {
    if (mapMode) {
      onLegend(legendFromMetadata(legendMetaFor(layer, source)));
      return;
    }
    let cancelled = false;
    let timer = 0;
    const publish = async () => {
      const media = source.kind === "video" ? videoRef.current : imageRef.current;
      if (!media) return;
      const width = source.kind === "video" ? videoRef.current?.videoWidth || 320 : imageRef.current?.naturalWidth || 320;
      const height = source.kind === "video" ? videoRef.current?.videoHeight || 180 : imageRef.current?.naturalHeight || 180;
      if (!width || !height) return;
      try {
        const pixels = await sampleImage(media, width, height);
        if (!pixels || cancelled) return;
        onLegend(legendFromPixels(pixels.data, pixels.width, pixels.height, source.kind === "video" ? "FRAME COLORS" : "IMAGE COLORS"));
      } catch {
        if (!cancelled) onLegend(legendFromMetadata(null));
      }
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void publish(), 480);
    };
    if (source.kind === "video") {
      const node = videoRef.current;
      node?.addEventListener("timeupdate", schedule);
      schedule();
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
        node?.removeEventListener("timeupdate", schedule);
      };
    }
    const node = imageRef.current;
    if (node?.complete) void publish();
    else node?.addEventListener("load", schedule, { once: true });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [layer, mapMode, onLegend, source]);

  useEffect(() => {
    if (source.id !== "currents-example") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last > 700) {
        last = now;
        setFrame((value) => value + 1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [source.id]);

  const move = (clientX: number, clientY: number, release: boolean) => {
    const svg = svgRef.current;
    if (!svg || !mapMode) {
      onProbe(lat, lng, release);
      return;
    }
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const local = point.matrixTransform(ctm.inverse());
    const geo = unproject(local.x, local.y);
    if (!geo) return;
    onProbe(geo[1], geo[0], release);
  };

  const nudge = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 5 : 2;
    if (event.key === "ArrowLeft") onProbe(lat, lng - step, true);
    else if (event.key === "ArrowRight") onProbe(lat, lng + step, true);
    else if (event.key === "ArrowUp") onProbe(Math.min(85, lat + step), lng, true);
    else if (event.key === "ArrowDown") onProbe(Math.max(-85, lat - step), lng, true);
    else return;
    event.preventDefault();
  };

  return (
    <div
      className="lv-stage"
      ref={stageRef}
      tabIndex={0}
      role="group"
      aria-label={`Map probe at ${coord}. ${tip}. Arrow keys move the probe.`}
      onKeyDown={nudge}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event.clientX, event.clientY, false);
      }}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse" || event.buttons) move(event.clientX, event.clientY, false);
      }}
      onPointerUp={(event) => move(event.clientX, event.clientY, true)}
    >
      {mapMode ? (
        <svg ref={svgRef} className="lv-map" viewBox={`0 0 ${MAP_VIEW.width} ${MAP_VIEW.height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Equal Earth map, NOAA CPC example">
          <rect width={MAP_VIEW.width} height={MAP_VIEW.height} fill="#100e0c" />
          {GRID.map((d, index) => (
            <path key={index} d={d} fill="none" stroke="rgba(255,243,234,0.07)" strokeWidth="1" />
          ))}
          {land.map((shape) => (
            <path key={shape.id} d={shape.d} fill={landFill(layer, shape.anomaly, shape.seaIce, shape.id)} />
          ))}
          {(layer === "temperature" || layer === "all") && (
            <polygon points={NINO.map(([x, y]) => `${x},${y}`).join(" ")} fill="#c56a32" />
          )}
          {(layer === "temperature" || layer === "all") && (
            <text x={NINO_LABEL[0]} y={NINO_LABEL[1]} fill="rgba(255,243,234,0.72)" fontSize="11" fontFamily="var(--font-geist-mono), monospace">
              NIÑO 3.4 · 5°N–5°S · 170°W–120°W
            </text>
          )}
          <g transform={`translate(${px} ${py})`} aria-hidden="true">
            <circle r="14" fill="none" stroke="#e08a3c" strokeWidth="2" />
            <circle r="5" fill="#e08a3c" />
            <circle r="2" fill="#fff3ea" />
          </g>
        </svg>
      ) : source.kind === "video" && source.video ? (
        <video ref={videoRef} className="lv-media" src={source.video} poster={source.preview} controls playsInline crossOrigin="anonymous" aria-label={source.title} />
      ) : (
        <img ref={imageRef} className="lv-media" src={source.preview} alt={source.title} />
      )}
      {source.id === "currents-example" ? (
        <ExampleClip
          frame={frame}
          onSample={(pixels) => onLegend(legendFromPixels(pixels.data, pixels.width, pixels.height, "FRAME COLORS"))}
        />
      ) : null}
      <p className="lv-glass lv-tag">
        <span className="lv-tag-long">MAP · EQUAL EARTH · NOAA CPC</span>
        <span className="lv-tag-short">MAP · NOAA CPC</span>
      </p>
      <p className="lv-glass lv-hint">
        <span className="lv-hint-long">MOVE OVER THE MAP TO HEAR LOCAL CHANGE</span>
        <span className="lv-hint-short">DRAG ON THE MAP TO HEAR CHANGE</span>
      </p>
      {mapMode ? (
        <div className="lv-glass lv-tip" style={{ left: tipPos.x, top: tipPos.y }}>
          <p>PROBE · {coord}</p>
          <p className={tip.includes("COOLER") ? "is-cool" : "is-warm"}>{tip}</p>
        </div>
      ) : null}
      <LegendPanel legend={legend} />
    </div>
  );
}

function ExampleClip({ frame, onSample }: { readonly frame: number; readonly onSample: (pixels: ImageData) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !context) return;
    const shift = (frame % 6) * 24;
    context.fillStyle = "#102033";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = frame % 2 === 0 ? "#1d4e89" : "#123";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#e08a3c";
    context.beginPath();
    context.ellipse(80 + shift, 90, 70, 36, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#7f66cc";
    context.fillRect(180, 40, 90, 100);
    onSample(context.getImageData(0, 0, canvas.width, canvas.height));
  }, [frame, onSample]);
  return <canvas ref={ref} className="lv-media" width={320} height={180} aria-label="Ocean currents animation" />;
}

function LegendPanel({ legend }: { readonly legend: LegendModel }) {
  const ends = legend.stops.filter((stop) => stop.label);
  return (
    <div className="lv-glass lv-legend">
      <p className="lv-legend-title">{legend.title}</p>
      {legend.stops.length > 0 ? (
        <div className="lv-legend-scale">
          <span>{ends[0]?.label ?? ""}</span>
          <i style={{ background: legendGradient(legend.stops) }} />
          <span>{ends[ends.length - 1]?.label ?? ""}</span>
        </div>
      ) : (
        <p className="lv-legend-missing">NO SCALE DETECTED</p>
      )}
      {legend.noData ? (
        <p className="lv-legend-none">
          <i style={{ background: legend.noData.color }} />
          {legend.noData.label}
        </p>
      ) : null}
      <p className="lv-legend-source">{legend.source.toUpperCase()}</p>
    </div>
  );
}
