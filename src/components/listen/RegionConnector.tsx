"use client";

import { useLayoutEffect, useRef, useState } from "react";

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Line {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

interface Marker {
  readonly line: Line;
  readonly brackets: readonly string[] | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function inside(rect: Box, point: Point): boolean {
  return point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;
}

function nearestEdge(rect: Box, point: Point): Point {
  const candidates = [
    { x: clamp(point.x, rect.left, rect.right), y: rect.top },
    { x: clamp(point.x, rect.left, rect.right), y: rect.bottom },
    { x: rect.left, y: clamp(point.y, rect.top, rect.bottom) },
    { x: rect.right, y: clamp(point.y, rect.top, rect.bottom) },
  ];
  return candidates.reduce((best, candidate) => (distance(candidate, point) < distance(best, point) ? candidate : best));
}

function justOutside(rect: Box, edge: Point): Point {
  const centerX = (rect.left + rect.right) / 2;
  const centerY = (rect.top + rect.bottom) / 2;
  const dx = edge.x - centerX;
  const dy = edge.y - centerY;
  const length = Math.hypot(dx, dy) || 1;
  return { x: edge.x + (dx / length) * 6, y: edge.y + (dy / length) * 6 };
}

function edgeToward(rect: Box, toward: Point): Point {
  const centerX = (rect.left + rect.right) / 2;
  const centerY = (rect.top + rect.bottom) / 2;
  const dx = toward.x - centerX;
  const dy = toward.y - centerY;
  if (Math.abs(dx) * rect.height > Math.abs(dy) * rect.width) {
    return {
      x: dx >= 0 ? rect.right : rect.left,
      y: clamp(toward.y, rect.top, rect.bottom),
    };
  }
  return {
    x: clamp(toward.x, rect.left, rect.right),
    y: dy >= 0 ? rect.bottom : rect.top,
  };
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function cornerBrackets(box: Box): readonly string[] {
  const pad = 5;
  const arm = 12;
  const left = box.left - pad;
  const top = box.top - pad;
  const right = box.right + pad;
  const bottom = box.bottom + pad;
  return [
    `M ${left} ${top + arm} L ${left} ${top} L ${left + arm} ${top}`,
    `M ${right - arm} ${top} L ${right} ${top} L ${right} ${top + arm}`,
    `M ${right} ${bottom - arm} L ${right} ${bottom} L ${right - arm} ${bottom}`,
    `M ${left + arm} ${bottom} L ${left} ${bottom} L ${left} ${bottom - arm}`,
  ];
}

function connectorLine(regionBox: Box, cardBox: Box): Line {
  const center = {
    x: (regionBox.left + regionBox.right) / 2,
    y: (regionBox.top + regionBox.bottom) / 2,
  };
  const facing = edgeToward(regionBox, nearestEdge(cardBox, center));
  const anchors = [
    facing,
    { x: regionBox.left, y: center.y },
    { x: regionBox.right, y: center.y },
    { x: center.x, y: regionBox.top },
    { x: center.x, y: regionBox.bottom },
  ];
  const outside = anchors.find((point) => !inside(cardBox, point));
  if (!outside) {
    const edge = nearestEdge(cardBox, center);
    const marker = justOutside(cardBox, edge);
    return { x1: marker.x, y1: marker.y, x2: edge.x, y2: edge.y };
  }
  const edge = nearestEdge(cardBox, outside);
  return { x1: outside.x, y1: outside.y, x2: edge.x, y2: edge.y };
}

export function RegionConnector({ regionId }: { readonly regionId: string }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [marker, setMarker] = useState<Marker | null>(null);
  const [view, setView] = useState({ width: 1440, height: 900 });

  useLayoutEffect(() => {
    const root = anchorRef.current?.parentElement;
    if (!root) return;

    const measure = () => {
      const region = root.querySelector<HTMLElement>('#listen-regions button[aria-pressed="true"]');
      const card = root.querySelector<HTMLElement>("[data-region-card]");
      if (!region || !card) {
        setMarker(null);
        return;
      }
      const rootRect = root.getBoundingClientRect();
      if (rootRect.width === 0 || rootRect.height === 0) return;
      setView((current) =>
        current.width === root.offsetWidth && current.height === root.offsetHeight
          ? current
          : { width: root.offsetWidth, height: root.offsetHeight },
      );
      const scaleX = root.offsetWidth / rootRect.width;
      const scaleY = root.offsetHeight / rootRect.height;
      const boxOf = (element: HTMLElement): Box => {
        const rect = element.getBoundingClientRect();
        const left = (rect.left - rootRect.left) * scaleX;
        const top = (rect.top - rootRect.top) * scaleY;
        const width = rect.width * scaleX;
        const height = rect.height * scaleY;
        return { left, top, right: left + width, bottom: top + height, width, height };
      };
      const regionBox = boxOf(region);
      const cardBox = boxOf(card);
      setMarker({
        line: connectorLine(regionBox, cardBox),
        brackets: overlaps(regionBox, cardBox) ? cornerBrackets(regionBox) : null,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener("sonify-map-move", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("sonify-map-move", measure);
    };
  }, [regionId]);

  return (
    <div ref={anchorRef} className="pointer-events-none absolute inset-0 z-[32]" aria-hidden="true">
      {marker ? (
        <svg className="block h-full w-full" viewBox={`0 0 ${view.width} ${view.height}`}>
          {marker.brackets?.map((path) => (
            <path key={path} d={path} fill="none" stroke="#f2f2f0" strokeWidth="1.5" data-selection-bracket="" />
          ))}
          <line x1={marker.line.x1} y1={marker.line.y1} x2={marker.line.x2} y2={marker.line.y2} stroke="#f2f2f0" strokeWidth="1" />
          <circle cx={marker.line.x1} cy={marker.line.y1} r="3.5" fill="#f2f2f0" />
        </svg>
      ) : null}
    </div>
  );
}
