"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MAP_REGIONS } from "@/data/exploreMap";
import { ChamferMark } from "@/components/listen/ChamferMark";
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

function earthOval(): string {
  const pts: string[] = [];
  for (let lat = -88; lat <= 88; lat += 4) {
    const [x, y] = project(CENTRAL_MERIDIAN + 180, lat);
    pts.push(`${pts.length ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  for (let lat = 88; lat >= -88; lat -= 4) {
    const [x, y] = project(CENTRAL_MERIDIAN - 180, lat);
    pts.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `${pts.join("")}Z`;
}

const OVAL = earthOval();
const NINO_WEST = project(-170, 0)[0];
const NINO_EAST = project(-120, 0)[0];
const NINO_PROBE = project(-145, 0);
const NINO_BOX_H = 36;
const NINO_GAP = 20;
const NINO_BOTTOM = NINO_PROBE[1] - NINO_GAP;
const NINO_TOP = NINO_BOTTOM - NINO_BOX_H;
const NINO_LABEL_Y = NINO_TOP - 8;

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
  readonly onPixel: (color: string | null) => void;
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

export function ListenMap({ source, layer, lat, lng, onProbe, legend, onLegend, tip, coord, onPixel }: ListenMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [tipPos, setTipPos] = useState({ x: 180, y: 120 });
  const [frame, setFrame] = useState(0);
  const land = useMemo(() => getLandPaths(), []);
  const [px, py] = project(lng, lat);
  const mapMode = source.kind === "map";
  const [ring, setRing] = useState<{ x: number; y: number } | null>(null);
  const [probeRadius, setProbeRadius] = useState(14);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapCenter, setMapCenter] = useState({ x: MAP_VIEW.width / 2, y: MAP_VIEW.height / 2 });
  const [pixel, setPixel] = useState({ x: 0.5, y: 0.5 });
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipShift, setTipShift] = useState({ x: 26, y: -18 });
  const tipAnchor = mapMode ? tipPos : ring;
  const mapWidth = MAP_VIEW.width / mapZoom;
  const mapHeight = MAP_VIEW.height / mapZoom;
  const mapViewBox = `${mapCenter.x - mapWidth / 2} ${mapCenter.y - mapHeight / 2} ${mapWidth} ${mapHeight}`;

  const resizeProbe = (amount: number) => {
    setProbeRadius((size) => Math.min(30, Math.max(6, size + amount)));
  };

  const changeZoom = (amount: number) => {
    setMapCenter({ x: px, y: py });
    setMapZoom((zoom) => Math.min(4, Math.max(1, Number((zoom + amount).toFixed(1)))));
  };

  useLayoutEffect(() => {
    const tip = tipRef.current;
    const stage = stageRef.current;
    if (!tip || !stage || !tipAnchor) return;

    const place = () => {
      const width = tip.offsetWidth;
      const height = tip.offsetHeight;
      const stageWidth = stage.clientWidth;
      const stageHeight = stage.clientHeight;
      if (width < 8 || height < 8 || stageWidth < 16 || stageHeight < 16) return;
      const gap = 16;
      const edge = 8;
      const stageBox = stage.getBoundingClientRect();
      const obstacles = [".lv-tag", ".lv-legend", ".lv-hint", ".lv-nino-label", ".lv-nino-box", ".lv-probe-dot"]
        .map((selector) => stage.querySelector(selector))
        .filter((node): node is Element => node instanceof Element)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            left: rect.left - stageBox.left,
            top: rect.top - stageBox.top,
            right: rect.right - stageBox.left,
            bottom: rect.bottom - stageBox.top,
          };
        });

      const clearance = (x: number, y: number) => {
        const rect = {
          left: tipAnchor.x + x,
          top: tipAnchor.y + y,
          right: tipAnchor.x + x + width,
          bottom: tipAnchor.y + y + height,
        };
        const inside = Math.min(rect.left - edge, rect.top - edge, stageWidth - edge - rect.right, stageHeight - edge - rect.bottom);
        if (inside < 0) return inside;
        let room = Number.POSITIVE_INFINITY;
        for (const obstacle of obstacles) {
          const dx = Math.max(obstacle.left - rect.right, rect.left - obstacle.right);
          const dy = Math.max(obstacle.top - rect.bottom, rect.top - obstacle.bottom);
          const apart = dx > 0 && dy > 0 ? Math.min(dx, dy) : Math.max(dx, dy);
          room = Math.min(room, apart);
        }
        return room;
      };

      const candidates = [
        { x: 14, y: 12 },
        { x: 14, y: -height - gap },
        { x: -width - 14, y: 12 },
        { x: -width - 14, y: -height - gap },
      ];
      const topBand = obstacles.reduce((bottom, obstacle) => obstacle.top < stageHeight / 2 ? Math.max(bottom, obstacle.bottom) : bottom, 0);
      const bottomBand = obstacles.reduce((top, obstacle) => obstacle.bottom > stageHeight / 2 ? Math.min(top, obstacle.top) : top, stageHeight);
      if (bottomBand - topBand >= height + gap * 2) {
        candidates.unshift({ x: edge - tipAnchor.x, y: topBand + gap - tipAnchor.y });
      }
      for (const obstacle of obstacles) {
        candidates.push(
          { x: obstacle.left - gap - width - tipAnchor.x, y: obstacle.top - tipAnchor.y },
          { x: obstacle.right + gap - tipAnchor.x, y: obstacle.top - tipAnchor.y },
          { x: obstacle.left - tipAnchor.x, y: obstacle.top - gap - height - tipAnchor.y },
          { x: obstacle.left - tipAnchor.x, y: obstacle.bottom + gap - tipAnchor.y },
        );
      }
      for (const left of [gap, Math.round((stageWidth - width) / 2), stageWidth - width - gap]) {
        for (const top of [gap, Math.round((stageHeight - height) / 2), stageHeight - height - gap]) {
          candidates.push({ x: left - tipAnchor.x, y: top - tipAnchor.y });
        }
      }

      let best = candidates[0] ?? { x: gap - tipAnchor.x, y: gap - tipAnchor.y };
      let bestRoom = Number.NEGATIVE_INFINITY;
      for (const candidate of candidates) {
        const room = clearance(candidate.x, candidate.y);
        if (room > bestRoom) {
          best = candidate;
          bestRoom = room;
        }
      }

      const minX = edge - tipAnchor.x;
      const maxX = stageWidth - edge - width - tipAnchor.x;
      const minY = edge - tipAnchor.y;
      const maxY = stageHeight - edge - height - tipAnchor.y;
      const x = minX <= maxX ? Math.min(Math.max(best.x, minX), maxX) : best.x;
      const y = minY <= maxY ? Math.min(Math.max(best.y, minY), maxY) : best.y;
      setTipShift((previous) => (previous.x === x && previous.y === y ? previous : { x, y }));
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(stage);
    stage.querySelectorAll(".lv-tag, .lv-legend, .lv-hint, .lv-nino-label, .lv-nino-box, .lv-probe-dot").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [tipAnchor, tip, legend]);

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

  const sampleMedia = (clientX: number, clientY: number) => {
    const stage = stageRef.current;
    const media = source.kind === "video" && source.id !== "currents-example" ? videoRef.current : source.id === "currents-example" ? null : imageRef.current;
    const canvasMedia = source.id === "currents-example" ? stage?.querySelector("canvas") : null;
    const node = media ?? canvasMedia;
    if (!stage || !node) return;
    const stageRect = stage.getBoundingClientRect();
    const naturalWidth = node instanceof HTMLVideoElement ? node.videoWidth : node instanceof HTMLImageElement ? node.naturalWidth : node.width;
    const naturalHeight = node instanceof HTMLVideoElement ? node.videoHeight : node instanceof HTMLImageElement ? node.naturalHeight : node.height;
    if (!naturalWidth || !naturalHeight) return;
    const scale = Math.min(stageRect.width / naturalWidth, stageRect.height / naturalHeight);
    const drawnWidth = naturalWidth * scale;
    const drawnHeight = naturalHeight * scale;
    const left = (stageRect.width - drawnWidth) / 2;
    const top = (stageRect.height - drawnHeight) / 2;
    const x = (clientX - stageRect.left - left) / drawnWidth;
    const y = (clientY - stageRect.top - top) / drawnHeight;
    setRing({ x: clientX - stageRect.left, y: clientY - stageRect.top });
    setPixel({
      x: Math.min(1, Math.max(0, (clientX - stageRect.left) / stageRect.width)),
      y: Math.min(1, Math.max(0, (clientY - stageRect.top) / stageRect.height)),
    });
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      onPixel(null);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    try {
      context.drawImage(node, Math.floor(x * naturalWidth), Math.floor(y * naturalHeight), 1, 1, 0, 0, 1, 1);
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
      const hex = [r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("");
      onPixel(`#${hex}`);
    } catch {
      onPixel(null);
    }
  };

  const move = (clientX: number, clientY: number, release: boolean) => {
    const svg = svgRef.current;
    if (!mapMode) {
      sampleMedia(clientX, clientY);
      return;
    }
    if (!svg) return;
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
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    if (!mapMode) {
      const stage = stageRef.current;
      if (!stage) return;
      const step = event.shiftKey ? 0.08 : 0.03;
      const next = {
        x: Math.min(1, Math.max(0, pixel.x + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0))),
        y: Math.min(1, Math.max(0, pixel.y + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0))),
      };
      const rect = stage.getBoundingClientRect();
      sampleMedia(rect.left + next.x * rect.width, rect.top + next.y * rect.height);
      return;
    }
    const step = event.shiftKey ? 5 : 2;
    if (event.key === "ArrowLeft") onProbe(lat, lng - step, true);
    else if (event.key === "ArrowRight") onProbe(lat, lng + step, true);
    else if (event.key === "ArrowUp") onProbe(Math.min(85, lat + step), lng, true);
    else onProbe(Math.max(-85, lat - step), lng, true);
  };

  return (
    <div
      className="lv-stage lv-cut"
      data-kind={source.kind}
      ref={stageRef}
      tabIndex={0}
      role="group"
      aria-label={mapMode
        ? `Map probe at ${coord}. ${tip}. Arrow keys move the probe.`
        : `Pixel probe at ${Math.round(pixel.x * 100)} percent across and ${Math.round(pixel.y * 100)} percent down. ${tip}. Arrow keys move the probe.`}
      onKeyDown={nudge}
      onPointerDown={(event) => {
        if (event.target instanceof Element && event.target.closest(".lv-map-controls")) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event.clientX, event.clientY, false);
      }}
      onPointerMove={(event) => {
        if (event.target instanceof Element && event.target.closest(".lv-map-controls")) return;
        if (event.pointerType === "mouse" || event.buttons) move(event.clientX, event.clientY, false);
      }}
      onPointerUp={(event) => {
        if (event.target instanceof Element && event.target.closest(".lv-map-controls")) return;
        move(event.clientX, event.clientY, true);
      }}
    >
      <ChamferMark />
      {mapMode ? (
        <svg
          ref={svgRef}
          className="lv-map"
          data-hide-target-cursor="true"
          viewBox={mapViewBox}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Equal Earth map, NOAA CPC example, zoom ${mapZoom.toFixed(1)} times`}
        >
          <rect width={MAP_VIEW.width} height={MAP_VIEW.height} fill="#100e0c" />
          <path d={OVAL} fill="none" stroke="rgba(255,243,234,0.16)" strokeWidth="1.25" />
          {GRID.map((d, index) => (
            <path key={index} d={d} fill="none" stroke="rgba(255,243,234,0.07)" strokeWidth="1" />
          ))}
          {land.map((shape) => (
            <path key={shape.id} d={shape.d} fill={landFill(layer, shape.anomaly, shape.seaIce, shape.id)} />
          ))}
          {(layer === "temperature" || layer === "all") && (
            <g aria-hidden="true">
              <text
                className="lv-nino-label"
                x={(NINO_WEST + NINO_EAST) / 2}
                y={NINO_LABEL_Y}
                textAnchor="middle"
                fill="rgba(255,243,234,0.72)"
                fontSize="10"
                fontFamily="var(--font-geist-mono), monospace"
              >
                NIÑO 3.4 · 5°N–5°S · 170°W–120°W
              </text>
              <rect className="lv-nino-box" x={NINO_WEST} y={NINO_TOP} width={NINO_EAST - NINO_WEST} height={NINO_BOX_H} fill="#c56a32" />
            </g>
          )}
          <g className="lv-probe-dot" transform={`translate(${px} ${py})`} aria-hidden="true">
            <circle r={(probeRadius + 8) / mapZoom} fill="#e08a3c" opacity="0.28" />
            <circle r={probeRadius / mapZoom} fill="none" stroke="#fff3ea" strokeWidth={1.75 / mapZoom} />
            <circle r={Math.max(2.5, probeRadius * 0.32) / mapZoom} fill="#e08a3c" />
          </g>
        </svg>
      ) : source.kind === "video" && source.video ? (
        <video ref={videoRef} className="lv-media" src={source.video} poster={source.preview} controls playsInline crossOrigin="anonymous" aria-label={source.title} />
      ) : (
        <img ref={imageRef} className="lv-media" src={source.preview} alt={source.title} />
      )}
      {mapMode ? (
        <div className="lv-map-controls" role="group" aria-label="Map and probe controls">
          <div className="lv-map-control-group" role="group" aria-label="Probe circle size">
            <span className="lv-map-control-label" aria-hidden="true">CIRCLE</span>
            <button
              type="button"
              className="lv-map-control-btn"
              aria-label="Make probe circle smaller"
              disabled={probeRadius <= 6}
              onClick={() => resizeProbe(-2)}
            >
              −
            </button>
            <button
              type="button"
              className="lv-map-control-btn"
              aria-label="Make probe circle larger"
              disabled={probeRadius >= 30}
              onClick={() => resizeProbe(2)}
            >
              +
            </button>
          </div>
          <div className="lv-map-control-group" role="group" aria-label="Map zoom">
            <span className="lv-map-control-label" aria-hidden="true">ZOOM {mapZoom.toFixed(1)}×</span>
            <button
              type="button"
              className="lv-map-control-btn"
              aria-label="Zoom out map"
              disabled={mapZoom <= 1}
              onClick={() => changeZoom(-0.5)}
            >
              −
            </button>
            <button
              type="button"
              className="lv-map-control-btn"
              aria-label="Zoom in map"
              disabled={mapZoom >= 4}
              onClick={() => changeZoom(0.5)}
            >
              +
            </button>
          </div>
        </div>
      ) : null}
      {!mapMode && ring ? <span className="lv-ring" style={{ left: ring.x, top: ring.y }} aria-hidden="true" /> : null}
      {source.id === "currents-example" ? (
        <ExampleClip
          frame={frame}
          onSample={(pixels) => onLegend(legendFromPixels(pixels.data, pixels.width, pixels.height, "FRAME COLORS"))}
        />
      ) : null}
      {false && mapMode ? <div className="lv-glass lv-cut lv-tag">
        <ChamferMark />
        <div className="lv-glass-face">
          <span className="lv-tag-long">MAP · EQUAL EARTH · NOAA CPC</span>
          <span className="lv-tag-short">MAP · NOAA CPC</span>
        </div>
      </div> : null}
      {false && mapMode ? <div className="lv-glass lv-cut lv-hint">
        <ChamferMark />
        <div className="lv-glass-face">
          <span className="lv-hint-long">MOVE OVER THE MAP TO HEAR LOCAL CHANGE</span>
          <span className="lv-hint-short">DRAG ON THE MAP TO HEAR CHANGE</span>
        </div>
      </div> : null}
      {false && mapMode ? (
        <div ref={tipRef} className="lv-glass lv-cut lv-tip" style={{ left: tipPos.x, top: tipPos.y, transform: `translate(${tipShift.x}px, ${tipShift.y}px)` }}>
          <ChamferMark />
          <div className="lv-glass-face">
            <p>PROBE · {coord}</p>
            <p className={tip.includes("COOLER") ? "is-cool" : "is-warm"}>{tip}</p>
          </div>
        </div>
      ) : null}
      {mapMode ? (
        <div className="lv-glass lv-tip lv-plain">
          <p>
            {coord} · <span className={tip.includes("COOLER") ? "is-cool" : "is-warm"}>{probePhrase(tip)}</span>
          </p>
        </div>
      ) : ring ? (
        <div ref={tipRef} className="lv-glass lv-cut lv-tip" style={{ left: ring.x, top: ring.y, transform: `translate(${tipShift.x}px, ${tipShift.y}px)` }}>
          <ChamferMark />
          <div className="lv-glass-face">
            <p>{tip}</p>
          </div>
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

function probePhrase(tip: string): string {
  return tip
    .replace(/[↑↓]/g, "")
    .replace(/\s*·\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace("niño", "Niño");
}

function LegendPanel({ legend }: { readonly legend: LegendModel }) {
  const ends = legend.stops.filter((stop) => stop.label);
  const noData = legend.noData;
  return (
    <>
      {false && (
        <div className="lv-glass lv-cut lv-legend">
          <ChamferMark />
          <div className="lv-glass-face">
            <p className="lv-legend-title">{legend.title}</p>
            {legend.stops.length > 0 ? (
              <div className="lv-legend-scale">
                <span>{ends[0]?.label ?? ""}</span>
                <i style={{ background: legendGradient(legend.stops) }} />
                <span>{ends.at(-1)?.label ?? ""}</span>
              </div>
            ) : (
              <p className="lv-legend-missing">NO SCALE DETECTED</p>
            )}
            {noData ? (
              <p className="lv-legend-none">
                <i style={{ background: noData?.color }} />
                {noData?.label}
              </p>
            ) : null}
            <p className="lv-legend-source lv-cut">
              <ChamferMark />
              {legend.source.toUpperCase()}
            </p>
          </div>
        </div>
      )}
      <div className="lv-glass lv-legend lv-plain">
        {legend.stops.length > 0 ? (
          <div className="lv-legend-scale">
            <span>{(ends[0]?.label ?? "colder").toLowerCase()}</span>
            <i style={{ background: legendGradient(legend.stops) }} />
            <span>{(ends.at(-1)?.label ?? "warmer").toLowerCase()}</span>
          </div>
        ) : (
          <p className="lv-legend-missing">no scale</p>
        )}
        {noData ? (
          <p className="lv-legend-none">
            <i style={{ background: noData.color }} />
            no data
          </p>
        ) : null}
      </div>
    </>
  );
}
