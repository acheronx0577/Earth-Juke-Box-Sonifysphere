"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { LAYERS, MAP_REGIONS, layerLit, regionById, type LayerId, type MapRegion } from "@/data/exploreMap";
import { regionFeatures, regionIdAt, regionOutlineFeatures, type RegionFeatureCollection } from "@/components/listen/regionGeometry";
import { loadGlobeRenderer } from "@/lib/listenAssets";

/** A lng/lat box the listener drew on the map (west > east when it crosses the dateline). */
export interface CustomArea {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

interface ExploreMapProps {
  readonly id?: string;
  readonly fit: "exact" | "fluid";
  readonly layer: LayerId;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  /** The drawn area to outline (null = none). */
  readonly customArea?: CustomArea | null;
  /** Called when the listener finishes drawing an area (Draw button, or shift + drag). */
  readonly onSelectArea?: (area: CustomArea) => void;
}

const GIBS_BLUE_MARBLE =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";

const LAND_IDS = new Set(["north-america", "south-america", "europe", "africa", "asia", "oceania", "antarctica"]);

/** Dark blue ocean and green land under the imagery, so a missed tile never reads as gray or brown. */
function fallbackEarth(regions: RegionFeatureCollection) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        id: 0,
        properties: { kind: "ocean" },
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [-180, -85],
              [180, -85],
              [180, 85],
              [-180, 85],
              [-180, -85],
            ],
          ],
        },
      },
      ...regions.features
        .filter((feature) => LAND_IDS.has(feature.properties.regionId))
        .map((feature) => ({
          type: "Feature" as const,
          id: feature.id,
          properties: { kind: "land" },
          geometry: feature.geometry,
        })),
    ],
  };
}

/** Whole globe, with the disk clear of the theme column. Diameter tracks 512 × 2^zoom / π. */
function defaultGlobeZoom(width: number): number {
  if (width < 1000) return 1.2;
  if (width < 1280) return 2.2;
  return 1.86;
}

const GLOBE_FLATTEN_ZOOM = 3.6;

function buildPolarCapBand(southLat: number, northLat: number, color: string, opacity: number) {
  const ring: [number, number][] = [];
  for (let lng = -180; lng <= 180; lng += 5) {
    ring.push([lng, northLat]);
  }
  for (let lng = 180; lng >= -180; lng -= 5) {
    ring.push([lng, southLat]);
  }
  ring.push([-180, northLat]);
  return {
    type: "Feature" as const,
    properties: { color, opacity },
    geometry: {
      type: "Polygon" as const,
      coordinates: [ring],
    },
  };
}

const POLAR_CAP_SNOW = "#F5F6FA";

const POLAR_CAPS_GEOJSON = {
  type: "FeatureCollection" as const,
  features: [
    buildPolarCapBand(-86, -84.9, POLAR_CAP_SNOW, 0.995),
    buildPolarCapBand(-84.9, -84.4, POLAR_CAP_SNOW, 0.85),
    buildPolarCapBand(-84.4, -83.9, POLAR_CAP_SNOW, 0.65),
    buildPolarCapBand(-83.9, -83.3, POLAR_CAP_SNOW, 0.42),
    buildPolarCapBand(-83.3, -82.6, POLAR_CAP_SNOW, 0.22),
    buildPolarCapBand(-82.6, -81.8, POLAR_CAP_SNOW, 0.1),
  ],
};

function isFrontHemisphere(
  centerLng: number,
  centerLat: number,
  targetLng: number,
  targetLat: number,
  zoom: number,
): boolean {
  if (zoom >= GLOBE_FLATTEN_ZOOM) return true;
  const toRad = Math.PI / 180;
  const phi1 = centerLat * toRad;
  const phi2 = targetLat * toRad;
  const dLambda = (targetLng - centerLng) * toRad;
  const cosAngle =
    Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return cosAngle > 0.12;
}

interface GlobeMapHandle {
  project: (lngLat: [number, number]) => { x: number; y: number };
  setFeatureState: (feature: { source: string; id: number }, state: { selected?: boolean }) => void;
  getCanvas: () => HTMLCanvasElement;
  getCenter: () => { lng: number; lat: number };
  getZoom: () => number;
  isStyleLoaded: () => boolean;
  setProjection: (projection: { type: "globe" | "mercator" }) => void;
  easeTo: (options: { center: [number, number]; duration?: number }) => void;
  resize: () => void;
  remove: () => void;
}

const GLOBE_STYLE = {
  version: 8 as const,
  projection: { type: "globe" as const },
  transition: { duration: 0, delay: 0 },
  sources: {
    "gibs-base": {
      type: "raster" as const,
      tiles: [GIBS_BLUE_MARBLE],
      tileSize: 256,
      maxzoom: 8,
      attribution: "NASA GIBS",
    },
    "polar-caps": {
      type: "geojson" as const,
      maxzoom: 0,
      buffer: 0,
      data: POLAR_CAPS_GEOJSON,
    },
  },
  layers: [
    {
      id: "bg",
      type: "background" as const,
      paint: { "background-color": "#141414" },
    },
    {
      id: "gibs-base",
      type: "raster" as const,
      source: "gibs-base",
      paint: {
        "raster-opacity": 1,
        "raster-saturation": 0,
        "raster-contrast": 0.05,
        "raster-brightness-min": 0,
        "raster-brightness-max": 1,
        "raster-fade-duration": 0,
      },
    },
    {
      id: "polar-cap-fill",
      type: "fill" as const,
      source: "polar-caps",
      paint: {
        "fill-color": ["get", "color"] as unknown as string,
        "fill-opacity": ["get", "opacity"] as unknown as number,
        "fill-antialias": false,
      },
    },
  ],
};

const REGION_FEATURES = regionFeatures();
const REGION_OUTLINES = regionOutlineFeatures();

type ScreenPoint = { x: number; y: number };
type ProjectVisible = (coordinate: [number, number]) => ScreenPoint | null;

function projectOutlineLine(line: readonly [number, number][], projectVisible: ProjectVisible, width: number): string {
  const commands: string[] = [];
  let previous: ScreenPoint | null = null;
  for (const coordinate of line) {
    const point = projectVisible(coordinate);
    if (!point) {
      previous = null;
      continue;
    }
    const connected = previous && Math.abs(point.x - previous.x) < width / 2;
    commands.push(`${connected ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`);
    previous = point;
  }
  return commands.join("");
}

function projectHoverOutline(id: string, projectVisible: ProjectVisible, width: number): string {
  const feature = REGION_OUTLINES.features.find((item) => item.properties.regionId === id);
  return (feature?.geometry.coordinates ?? []).map((line) => projectOutlineLine(line, projectVisible, width)).join("");
}

/** Feature ids (region index) of one region in the outline source. */
function regionFeatureIds(regionId: string | null): number[] {
  if (!regionId) return [];
  return REGION_FEATURES.features.filter((feature) => feature.properties.regionId === regionId).map((feature) => feature.id);
}

const STATE_TRUE = ["boolean", ["feature-state", "selected"], false] as const;

/** Selection stays on the map; lightweight SVG handles hover without repainting the globe. */
const REGION_LAYERS = [
  {
    id: "regions-glow",
    type: "line",
    source: "region-lines",
    paint: {
      "line-color": "#f2f2f0",
      "line-width": ["case", STATE_TRUE, 7, 0],
      "line-blur": ["case", STATE_TRUE, 3.5, 0],
      "line-opacity": ["case", STATE_TRUE, 0.45, 0],
    },
  },
  {
    id: "regions-line",
    type: "line",
    source: "region-lines",
    paint: {
      "line-color": "#f2f2f0",
      "line-opacity": ["case", STATE_TRUE, 0.95, 0],
      "line-width": 1,
    },
  },
] as const;

/** True when the screen point is on the globe itself (not in space beside it). */
function pointerOnGlobe(map: GlobeMapHandle, point: { x: number; y: number }, lngLat: { lng: number; lat: number }): boolean {
  const back = map.project([lngLat.lng, lngLat.lat]);
  return Math.hypot(back.x - point.x, back.y - point.y) < 3;
}

const EMPTY_AREA = { type: "FeatureCollection" as const, features: [] };

function areaCollection(area: CustomArea | null) {
  if (!area) return EMPTY_AREA;
  const ring = (west: number, east: number): [number, number][] => [
    [west, area.north],
    [east, area.north],
    [east, area.south],
    [west, area.south],
    [west, area.north],
  ];
  const geometry =
    area.west <= area.east
      ? { type: "Polygon" as const, coordinates: [ring(area.west, area.east)] }
      : { type: "MultiPolygon" as const, coordinates: [[ring(area.west, 180)], [ring(-180, area.east)]] };
  return { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, properties: {}, geometry }] };
}

const AREA_LAYERS = [
  { id: "custom-area-fill", type: "fill", source: "custom-area", paint: { "fill-color": "#f2f2f0", "fill-opacity": 0.16 } },
  {
    id: "custom-area-glow",
    type: "line",
    source: "custom-area",
    paint: { "line-color": "#f2f2f0", "line-width": 7, "line-blur": 3.5, "line-opacity": 0.45 },
  },
  { id: "custom-area-line", type: "line", source: "custom-area", paint: { "line-color": "#f2f2f0", "line-width": 2.2 } },
] as const;

/** Screen rectangle → lng/lat box. Null when the box is too small to be a deliberate drag. */
function areaFromScreen(
  unproject: (point: [number, number]) => { lng: number; lat: number },
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): CustomArea | null {
  if (Math.abs(x2 - x1) < 22 || Math.abs(y2 - y1) < 22) return null;
  const points = [unproject([x1, y1]), unproject([x2, y1]), unproject([x2, y2]), unproject([x1, y2])];
  let west = Math.min(...points.map((point) => point.lng));
  let east = Math.max(...points.map((point) => point.lng));
  const south = Math.max(-85, Math.min(...points.map((point) => point.lat)));
  const north = Math.min(85, Math.max(...points.map((point) => point.lat)));
  if (east - west > 180) {
    const swap = west;
    west = east;
    east = swap;
  }
  if (north - south < 0.05) return null;
  return { west, south, east, north };
}

function patchRasterTileAbort(mod: typeof import("maplibre-gl")) {
  for (const sourceClass of [mod.RasterTileSource, mod.RasterDEMTileSource]) {
    if (sourceClass?.prototype) {
      sourceClass.prototype.abortTile = async function abortTile(tile: {
        abortController?: AbortController;
      }) {
        tile.abortController?.abort();
      };
    }
  }
}

function patchZeroZoomClipping(map: unknown) {
  const painter = (
    map as {
      painter?: {
        stencilModeForClipping: (coord: { canonical: { z: number } }) => unknown;
      };
    }
  ).painter;
  if (!painter) return;
  const origStencil = painter.stencilModeForClipping.bind(painter);
  const disabledStencil = {
    test: { func: 0x0207, mask: 0 },
    ref: 0,
    mask: 0,
    fail: 0x1e00,
    depthFail: 0x1e00,
    pass: 0x1e00,
  };
  painter.stencilModeForClipping = (coord) =>
    coord.canonical.z === 0 ? disabledStencil : origStencil(coord);
}

function positionRegionButton(
  btn: HTMLButtonElement,
  region: MapRegion,
  map: GlobeMapHandle,
  center: { lng: number; lat: number },
  zoom: number,
  activeLayer: LayerId,
) {
  const pt = map.project([region.center[0], region.center[1]]);
  btn.style.left = `${pt.x}px`;
  btn.style.top = `${pt.y}px`;
  btn.style.width = "auto";
  btn.style.height = "auto";
  btn.style.transform = "translate(-50%, -50%)";

  const facing = isFrontHemisphere(center.lng, center.lat, region.center[0], region.center[1], zoom);
  if (!facing) {
    btn.style.opacity = "0";
    btn.style.pointerEvents = "none";
    return;
  }

  const dim = activeLayer === "sea-ice" && !layerLit(region, activeLayer);
  btn.style.opacity = dim ? "0.35" : "1";
  btn.style.pointerEvents = "auto";
}

function easeToIfOccluded(map: GlobeMapHandle | null, region: MapRegion) {
  if (!map) return false;
  const center = map.getCenter();
  if (isFrontHemisphere(center.lng, center.lat, region.center[0], region.center[1], map.getZoom())) {
    return false;
  }
  map.easeTo({
    center: [region.center[0], region.center[1]],
    duration: 650,
  });
  return true;
}

interface RegionMarkerButtonProps {
  readonly region: MapRegion;
  readonly active: boolean;
  readonly selected: boolean;
  readonly onHover: (id: string | null) => void;
  readonly onClick: (region: MapRegion) => void;
  readonly setRef: (node: HTMLButtonElement | null) => void;
}

function RegionMarkerButton({
  region,
  active,
  selected,
  onHover,
  onClick,
  setRef,
}: RegionMarkerButtonProps) {
  return (
    <button
      ref={setRef}
      type="button"
      aria-label={region.name}
      aria-pressed={selected}
      onMouseEnter={() => onHover(region.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(region.id)}
      onBlur={() => onHover(null)}
      onClick={() => onClick(region)}
      data-active={active ? "true" : "false"}
      className="sonify-region pointer-events-none absolute z-30 cursor-pointer border-0 bg-transparent p-1 text-left font-mono text-[8px] tracking-[0.28px] text-[rgba(242,242,240,0.9)] [text-shadow:0_1px_2px_#141414] min-[1000px]:text-[9px] min-[1000px]:tracking-[0.36px]"
      style={{ left: "-9999px", top: "0px", opacity: 0 }}
    >
      {region.box ? "NIÑO 3.4" : region.label}
    </button>
  );
}

export function ExploreMap({
  id,
  fit,
  layer,
  selectedId,
  onSelect,
  customArea = null,
  onSelectArea,
}: ExploreMapProps) {
  // Hover is local to the map; it must not rerender the theme rail and place sheets.
  const [hoverId, onHover] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const hoverPathRef = useRef<SVGPathElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mapRef = useRef<GlobeMapHandle | null>(null);
  const syncRef = useRef<() => void>(() => {});
  const outlineRef = useRef<() => void>(() => {});
  const areaRef = useRef<() => void>(() => {});
  const customAreaRef = useRef(customArea);
  const onSelectAreaRef = useRef(onSelectArea);
  const drawModeRef = useRef(false);
  const setDrawModeRef = useRef<(on: boolean) => void>(() => {});
  const [drawMode, setDrawMode] = useState(false);
  customAreaRef.current = customArea;
  onSelectAreaRef.current = onSelectArea;
  const layerRef = useRef(layer);
  const hoverRef = useRef(hoverId);
  const selectedRef = useRef(selectedId);
  const onHoverRef = useRef(onHover);
  layerRef.current = layer;
  hoverRef.current = hoverId;
  selectedRef.current = selectedId;
  onHoverRef.current = onHover;

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    let cancelled = false;
    let booted = false;
    let positionsFrame = 0;
    let hoverFrame = 0;

    const boot = async () => {
      if (booted || cancelled || container.clientWidth === 0 || container.clientHeight === 0) return;
      booted = true;

      const mod = await loadGlobeRenderer();
      if (cancelled || !mapContainerRef.current) return;
      patchRasterTileAbort(mod);

      let currentProjection: "globe" | "mercator" = "globe";
      const rawMap = new mod.Map({
        container: mapContainerRef.current,
        style: GLOBE_STYLE,
        center: [-95, 14],
        zoom: defaultGlobeZoom(container.clientWidth),
        minZoom: 0.4,
        maxZoom: 8,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });

      rawMap.dragRotate.disable();
      rawMap.touchZoomRotate.disableRotation();
      rawMap.keyboard.disableRotation();
      patchZeroZoomClipping(rawMap);

      const map = rawMap as unknown as GlobeMapHandle;
      const hoverPaths = new Map<string, string>();
      const projectVisible: ProjectVisible = ([lng, lat]) => {
        const location = new mod.LngLat(lng, lat);
        return rawMap.transform.isLocationOccluded(location) ? null : rawMap.project(location);
      };
      const paintHover = () => {
        const path = hoverPathRef.current;
        if (!path) return;
        const id = hoverRef.current;
        if (!id || id === selectedRef.current) {
          path.setAttribute("d", "");
          path.removeAttribute("data-hover-region");
          return;
        }
        if (!hoverPaths.has(id)) {
          hoverPaths.set(id, projectHoverOutline(id, projectVisible, container.clientWidth));
        }
        path.setAttribute("d", hoverPaths.get(id) ?? "");
        path.setAttribute("data-hover-region", id);
      };
      const syncPositions = () => {
        hoverPaths.clear();
        paintHover();
        const center = map.getCenter();
        const zoom = map.getZoom();
        const targetProjection: "globe" | "mercator" = zoom >= GLOBE_FLATTEN_ZOOM ? "mercator" : "globe";
        if (targetProjection !== currentProjection && map.isStyleLoaded()) {
          currentProjection = targetProjection;
          map.setProjection({ type: targetProjection });
        }

        for (const region of MAP_REGIONS) {
          const btn = buttonRefs.current[region.id];
          if (!btn) continue;
          positionRegionButton(btn, region, map, center, zoom, layerRef.current);
        }
        window.dispatchEvent(new Event("sonify-map-move"));
      };

      const schedulePositions = () => {
        if (positionsFrame || cancelled) return;
        positionsFrame = requestAnimationFrame(() => {
          positionsFrame = 0;
          if (!cancelled) syncPositions();
        });
      };
      syncRef.current = schedulePositions;
      mapRef.current = map;

      let outlinesReady = false;
      let paintedSelected: number[] = [];
      const paintOutlines = () => {
        paintHover();
        if (!outlinesReady) return;
        const nextSelected = regionFeatureIds(selectedRef.current);
        // Only the line source uses feature state. Leave an unchanged selection alone.
        for (const id of paintedSelected) if (!nextSelected.includes(id)) map.setFeatureState({ source: "region-lines", id }, { selected: false });
        for (const id of nextSelected) if (!paintedSelected.includes(id)) map.setFeatureState({ source: "region-lines", id }, { selected: true });
        paintedSelected = nextSelected;
      };
      outlineRef.current = paintOutlines;

      rawMap.on("load", () => {
        if (cancelled) return;
        rawMap.setSky({
          "sky-color": "#141414",
          "horizon-color": "#141414",
          "fog-color": "#141414",
          "sky-horizon-blend": 0,
          "horizon-fog-blend": 0,
          "fog-ground-blend": 0,
          "atmosphere-blend": 0,
        });
        rawMap.addSource("fallback-earth", {
          type: "geojson",
          data: fallbackEarth(regionFeatures()) as unknown as GeoJSON.FeatureCollection,
        });
        rawMap.addLayer(
          {
            id: "fallback-earth",
            type: "fill",
            source: "fallback-earth",
            paint: {
              "fill-color": ["match", ["get", "kind"], "ocean", "#0c3d66", "#24543a"],
              "fill-opacity": 1,
            },
          },
          "gibs-base",
        );
        rawMap.addSource("region-lines", { type: "geojson", data: REGION_OUTLINES as unknown as GeoJSON.FeatureCollection });
        for (const layerSpec of REGION_LAYERS) {
          rawMap.addLayer(layerSpec as unknown as Parameters<typeof rawMap.addLayer>[0]);
        }
        outlinesReady = true;
        paintOutlines();

        rawMap.addSource("custom-area", { type: "geojson", data: areaCollection(customAreaRef.current) });
        for (const layerSpec of AREA_LAYERS) {
          rawMap.addLayer(layerSpec as unknown as Parameters<typeof rawMap.addLayer>[0]);
        }
        areaRef.current = () => {
          const source = rawMap.getSource("custom-area") as { setData?: (data: unknown) => void } | undefined;
          source?.setData?.(areaCollection(customAreaRef.current));
        };
        container.dataset.listenMapReady = "true";
        window.dispatchEvent(new Event("sonify-map-ready"));
      });

      // Draw an area: Draw button (draw mode) or shift + drag paints a rubber box, released into a lng/lat box.
      const canvas = rawMap.getCanvas();
      const rubber = document.createElement("div");
      rubber.className = "listen-draw-box";
      rubber.hidden = true;
      container.appendChild(rubber);
      let drawing: { x: number; y: number; id: number } | null = null;
      const pointOnMap = (event: PointerEvent) => {
        const bounds = canvas.getBoundingClientRect();
        return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      };
      const paintRubber = (from: { x: number; y: number }, to: { x: number; y: number }) => {
        rubber.hidden = false;
        rubber.style.left = `${Math.min(from.x, to.x)}px`;
        rubber.style.top = `${Math.min(from.y, to.y)}px`;
        rubber.style.width = `${Math.abs(to.x - from.x)}px`;
        rubber.style.height = `${Math.abs(to.y - from.y)}px`;
      };
      setDrawModeRef.current = (on: boolean) => {
        drawModeRef.current = on;
        if (on) rawMap.dragPan.disable();
        else rawMap.dragPan.enable();
        canvas.style.cursor = on ? "crosshair" : "";
      };
      const finishDraw = (event: PointerEvent) => {
        if (!drawing || drawing.id !== event.pointerId) return;
        const end = pointOnMap(event);
        const start = drawing;
        drawing = null;
        rubber.hidden = true;
        try {
          canvas.releasePointerCapture(event.pointerId);
        } catch {
          // already released
        }
        const area = areaFromScreen((point) => rawMap.unproject(point), start.x, start.y, end.x, end.y);
        if (area) {
          onSelectAreaRef.current?.(area);
          setDrawModeRef.current(false);
          setDrawMode(false);
          return;
        }
        // Too small to be a deliberate drag: leave draw mode as it was.
        if (!drawModeRef.current) rawMap.dragPan.enable();
      };
      canvas.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || !onSelectAreaRef.current) return;
        if (!drawModeRef.current && !event.shiftKey) return;
        event.preventDefault();
        rawMap.dragPan.disable();
        onHoverRef.current(null);
        const start = pointOnMap(event);
        drawing = { ...start, id: event.pointerId };
        paintRubber(start, start);
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // capture is optional
        }
      });
      canvas.addEventListener("pointermove", (event) => {
        if (drawing && drawing.id === event.pointerId) paintRubber(drawing, pointOnMap(event));
      });
      canvas.addEventListener("pointerup", finishDraw);
      canvas.addEventListener("pointercancel", finishDraw);

      let dragging = false;
      rawMap.on("dragstart", () => {
        dragging = true;
      });
      rawMap.on("movestart", () => {
        hoverRef.current = null;
        onHoverRef.current(null);
        paintHover();
      });
      rawMap.on("dragend", () => {
        dragging = false;
      });
      let pendingHover: { lng: number; lat: number; point: { x: number; y: number } } | null = null;
      rawMap.on("mousemove", (event) => {
        if (dragging || drawing || drawModeRef.current) return;
        const { lngLat, point } = event;
        pendingHover = { lng: lngLat.lng, lat: lngLat.lat, point };
        if (hoverFrame) return;
        hoverFrame = requestAnimationFrame(() => {
          hoverFrame = 0;
          if (cancelled || dragging || drawing || drawModeRef.current || !pendingHover) return;
          const { lng, lat, point } = pendingHover;
          pendingHover = null;
          const next = pointerOnGlobe(map, point, { lng, lat }) ? regionIdAt(lng, lat) : null;
          if (next === hoverRef.current) return;
          hoverRef.current = next;
          onHoverRef.current(next);
          map.getCanvas().style.cursor = next ? "pointer" : "";
        });
      });
      // Clear the outline when the pointer leaves the globe (e.g. onto the card) so it never sticks.
      rawMap.on("mouseout", () => {
        pendingHover = null;
        cancelAnimationFrame(hoverFrame);
        hoverFrame = 0;
        if (!drawModeRef.current) map.getCanvas().style.cursor = "";
        if (hoverRef.current !== null) {
          hoverRef.current = null;
          onHoverRef.current(null);
        }
      });

      rawMap.on("load", syncPositions);
      rawMap.on("move", schedulePositions);
      rawMap.on("resize", schedulePositions);
      syncPositions();
    };

    void boot();

    const observer = new ResizeObserver(() => {
      if (!booted) {
        void boot();
        return;
      }
      mapRef.current?.resize();
      syncRef.current();
    });
    observer.observe(container);

    return () => {
      cancelled = true;
      cancelAnimationFrame(positionsFrame);
      cancelAnimationFrame(hoverFrame);
      outlineRef.current = () => {};
      areaRef.current = () => {};
      setDrawModeRef.current = () => {};
      observer.disconnect();
      const map = mapRef.current;
      delete container.dataset.listenMapReady;
      mapRef.current = null;
      map?.remove();
      syncRef.current = () => {};
    };
  }, [fit]);

  useEffect(() => {
    syncRef.current();
  }, [layer]);

  useEffect(() => {
    outlineRef.current();
  }, [hoverId, selectedId]);


  useEffect(() => {
    areaRef.current();
  }, [customArea]);

  const toggleDraw = () => {
    const next = !drawModeRef.current;
    setDrawModeRef.current(next);
    setDrawMode(next);
  };

  useEffect(() => {
    if (!selectedId || !easeToIfOccluded(mapRef.current, regionById(selectedId))) {
      syncRef.current();
    }
  }, [selectedId]);

  const handleRegionClick = (region: MapRegion) => {
    onSelect(region.id);
    easeToIfOccluded(mapRef.current, region);
  };

  return (
    <div
      id={id}
      className={
        fit === "exact"
          ? "pointer-events-auto absolute inset-0 overflow-hidden"
          : "relative h-[380px] w-full max-w-full overflow-hidden"
      }
    >
      <div
        ref={mapContainerRef}
        aria-label="Interactive 3D Earth globe with twelve climate regions"
        className="absolute inset-0 h-full w-full"
      />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <path ref={hoverPathRef} fill="none" stroke="#f2f2f0" strokeOpacity="0.85" strokeWidth="1" />
      </svg>
      {MAP_REGIONS.map((region) => (
        <RegionMarkerButton
          key={region.id}
          region={region}
          active={region.id === selectedId || region.id === hoverId}
          selected={region.id === selectedId}
          onHover={onHover}
          onClick={handleRegionClick}
          setRef={(node) => {
            buttonRefs.current[region.id] = node;
          }}
        />
      ))}
      {onSelectArea ? (
        <button
          type="button"
          className="listen-draw-btn"
          aria-label="Draw an area"
          aria-pressed={drawMode}
          data-active={drawMode ? "true" : "false"}
          title="Draw an area to hear a smaller range (or shift + drag)"
          onClick={toggleDraw}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="3" y="3" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.4 1.6" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export function LayerChips({
  layer,
  onLayer,
}: Readonly<{
  layer: LayerId;
  onLayer: (id: LayerId) => void;
}>) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const measure = () => setCanScroll(node.scrollWidth > node.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 max-w-full font-mono text-[11px] tracking-[0.44px] text-[rgba(242,242,240,0.6)]">
        EXPLORE / MAP
        <span className="mt-1 block text-[9px] tracking-[0.36px] text-[rgba(242,242,240,0.45)] min-[1000px]:ml-3 min-[1000px]:mt-0 min-[1000px]:inline">
          · HOVER A REGION TO PREVIEW · CLICK TO OPEN
        </span>
      </p>
      <div className="relative max-w-full">
        <div
          ref={scrollerRef}
          className="pointer-events-none flex w-max max-w-full flex-wrap gap-2 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] max-[999px]:flex-nowrap [&::-webkit-scrollbar]:hidden"
          role="radiogroup"
          aria-label="Data layer"
        >
          {LAYERS.map((item) => {
            const active = item.id === layer;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onLayer(item.id)}
                data-active={active ? "true" : "false"}
                className="sonify-chip pointer-events-auto shrink-0 cursor-pointer rounded-none border-0 font-mono text-[11px] font-bold tracking-[0.44px]"
              >
                <span className="sonify-chip-face px-3.5 py-2">{item.label}</span>
              </button>
            );
          })}
        </div>
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#141414] to-transparent min-[1000px]:hidden ${canScroll ? "" : "max-[999px]:hidden"}`}
        />
      </div>
    </div>
  );
}
