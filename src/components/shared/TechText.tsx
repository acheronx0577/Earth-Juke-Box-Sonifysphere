'use client';

import React, { useEffect, useRef } from 'react';
import './TechText.css';

const LABEL_FONT = '600 13px "Geist Mono", Consolas, SFMono-Regular, Menlo, monospace';
const FALLOFF_STEPS = 8;
const SPRING = 320;
const INHERIT = /^(currentcolor|inherit)$/i;
const INTRO_DELAY = 0.15;
const KICK_DECAY = 0.62;

const resolveBleedOffset = (specific?: number, fallback = 0): number => {
  if (typeof specific === 'number' && Number.isFinite(specific)) {
    return Math.max(0, specific);
  }
  return Math.max(0, fallback);
};

const approach = (current: number, target: number, dt: number, seconds: number) =>
  current + (target - current) * (1 - Math.exp(-dt / seconds));

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number(value) || 0));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const noise = (...values: number[]) => {
  let h = 2166136261;
  for (const value of values) {
    h = Math.imul(h ^ Math.trunc(value), 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};

const signed = (value: number) => {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${-value}`;
  return '0';
};

const getSpeckSize = (pick: number): number => {
  if (pick < 0.46) return 2;
  if (pick < 0.7) return 3;
  if (pick < 0.84) return 5;
  if (pick < 0.94) return 8;
  return 11;
};

export interface TechTextProps {
  text?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: number;
  letterSpacing?: number;
  color?: string;
  accentColor?: string;
  align?: 'left' | 'center' | 'right';
  reach?: number;
  softness?: number;
  dashLength?: number;
  dashGap?: number;
  strokeWidth?: number;
  lineStyle?: 'dashed' | 'solid';
  reveal?: 'area' | 'letter' | 'off';
  specks?: number;
  selection?: boolean;
  labels?: boolean;
  draggable?: boolean;
  bounce?: number;
  sweep?: boolean;
  speed?: number;
  clickKick?: boolean;
  intro?: 'none' | 'type' | 'assemble' | 'metrics';
  introDuration?: number;
  guides?: boolean;
  bleedY?: number;
  bleedX?: number;
  bleedTop?: number;
  bleedBottom?: number;
  bleedLeft?: number;
  bleedRight?: number;
  className?: string;
  style?: React.CSSProperties;
}

interface GlyphBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface GlyphSprite {
  image: HTMLCanvasElement;
  left: number;
  top: number;
}

interface AssemblyCell {
  x: number;
  y: number;
  size: number;
  dx: number;
  dy: number;
  start: number;
  land: number;
}

interface GlyphData {
  char: string;
  x: number;
  box: GlyphBox;
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
  outline: number;
  shown: number;
  cells: AssemblyCell[] | null;
  assembled: number;
  index: number;
  fill: GlyphSprite;
  dashes: GlyphSprite;
}

interface LayoutBand {
  y0: number;
  y1: number;
  up: boolean;
  order: number;
}

interface LayoutLine {
  y: number;
  label: string;
}

interface LayoutView {
  size: number;
  baseline: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  lines: LayoutLine[];
  bands: LayoutBand[];
}

interface SweepState {
  x: number;
  y: number;
  timer: number;
  dwell: number;
  initialized: boolean;
}

const getRandomFraction = (): number => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return 0.5;
};

const resolveSweepTarget = (
  sweep: SweepState,
  glyphs: GlyphData[],
  view: LayoutView,
  clock: number,
  speed: number,
  dt: number
): { x: number; y: number } => {
  sweep.timer -= dt * speed;
  if (!sweep.initialized || sweep.timer <= 0) {
    sweep.initialized = true;
    sweep.dwell = 1.6 + getRandomFraction() * 2.2;
    sweep.timer = sweep.dwell;

    if (glyphs.length > 0) {
      const targetIndex = Math.floor(getRandomFraction() * glyphs.length);
      const targetGlyph = glyphs[targetIndex];
      const cx = (targetGlyph.box.x1 + targetGlyph.box.x2) / 2;
      const cy = (targetGlyph.box.y1 + targetGlyph.box.y2) / 2;
      sweep.x = cx + (getRandomFraction() - 0.5) * 16;
      sweep.y = cy + (getRandomFraction() - 0.5) * 12;
    } else {
      sweep.x = view.left + (view.right - view.left) * getRandomFraction();
      sweep.y = view.top + (view.bottom - view.top) * 0.5;
    }
  }

  const driftX = Math.sin(clock * 1.2) * 8 + Math.cos(clock * 0.5) * 5;
  const driftY = Math.cos(clock * 1.5) * 6 + Math.sin(clock * 0.7) * 4;

  return {
    x: sweep.x + driftX,
    y: sweep.y + driftY
  };
};

export const TechText: React.FC<TechTextProps> = ({
  text = 'React Bits',
  fontFamily = '',
  fontWeight = 600,
  fontSize = 150,
  letterSpacing = -0.05,
  color = 'currentColor',
  accentColor = 'currentColor',
  align = 'center',
  reach = 200,
  softness = 0.7,
  dashLength = 4,
  dashGap = 2,
  strokeWidth = 1.5,
  lineStyle = 'dashed',
  reveal = 'letter',
  specks = 15,
  selection = true,
  labels = true,
  draggable = true,
  bounce = 0.4,
  sweep = false,
  speed = 1,
  clickKick = true,
  intro = 'none',
  introDuration = 2,
  guides = false,
  bleedY = 0,
  bleedX = 0,
  bleedTop,
  bleedBottom,
  bleedLeft,
  bleedRight,
  className = '',
  style
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const settingsRef = useRef<TechTextProps | null>(null);
  const wakeRef = useRef<() => void>(() => {});

  useEffect(() => {
    settingsRef.current = {
      text,
      fontFamily,
      fontWeight,
      fontSize,
      letterSpacing,
      color,
      accentColor,
      align,
      reach,
      softness,
      dashLength,
      dashGap,
      strokeWidth,
      lineStyle,
      reveal,
      specks,
      selection,
      labels,
      draggable,
      bounce,
      sweep,
      speed,
      clickKick,
      intro,
      introDuration,
      guides,
      bleedY,
      bleedX,
      bleedTop,
      bleedBottom,
      bleedLeft,
      bleedRight
    };
    wakeRef.current();
  });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const scratch = document.createElement('canvas');
    const scratchCtx = scratch.getContext('2d');
    if (!container || !canvas || !ctx || !scratchCtx) return undefined;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    let width = 1;
    let height = 1;
    let dpr = 1;
    let raf = 0;
    let last = performance.now();
    let visible = true;
    let alive = true;
    let layoutKey = '';
    let requestedFont = '';
    let word: LayoutView | null = null;
    let glyphs: GlyphData[] = [];
    let presence = 0;
    let clock = 0;
    let pulse = 0;
    let placed = false;
    let dragging = -1;
    let cursor = '';
    let introClock = 0;
    let introKind = '';
    let introducing = false;
    let fontsReady = typeof document === 'undefined' || !document.fonts;
    let guideAlpha = 0;
    const kicks: Array<{ index: number; at: number; velocity: number }> = [];
    const press = { x: 0, y: 0, time: 0, index: -1 };
    const pointer = { x: 0, y: 0, inside: false };
    const grab = { x: 0, y: 0 };
    const lens = { x: 0, y: 0 };
    const sweepState: SweepState = { x: 0, y: 0, timer: 0, dwell: 2.2, initialized: false };
    const frame = { x1: 0, y1: 0, x2: 0, y2: 0, alpha: 0, index: -1 };

    const getBleed = () => {
      const s = settingsRef.current;
      const defX = resolveBleedOffset(s?.bleedX);
      const defY = resolveBleedOffset(s?.bleedY);
      const top = resolveBleedOffset(s?.bleedTop, defY);
      const bottom = resolveBleedOffset(s?.bleedBottom, defY);
      const left = resolveBleedOffset(s?.bleedLeft, defX);
      const right = resolveBleedOffset(s?.bleedRight, defX);
      return {
        x: left,
        y: top,
        left,
        top,
        right,
        bottom
      };
    };

    const refreshFonts = () => {
      layoutKey = '';
      tick(performance.now());
      wakeRef.current();
    };

    const fontsLoaded = () => {
      fontsReady = true;
      refreshFonts();
    };

    const family = (s: TechTextProps) => {
      if (s.fontFamily) {
        return `"${s.fontFamily}", "PlanetKosmos", "Planet Kosmos", sans-serif`;
      }
      return (container ? getComputedStyle(container).fontFamily : '') || 'sans-serif';
    };

    const fontFor = (s: TechTextProps, size: number) => `${s.fontWeight} ${size}px ${family(s)}`;

    const palette = (s: TechTextProps) => {
      const current = (container ? getComputedStyle(container).color : '') || '#ffffff';
      const pick = (value?: string) => (!value || INHERIT.test(String(value).trim()) ? current : value);
      return { ink: pick(s.color), accent: pick(s.accentColor) };
    };

    const setFont = (target: CanvasRenderingContext2D, s: TechTextProps, size: number) => {
      target.font = fontFor(s, size);
      if ('letterSpacing' in target && typeof s.letterSpacing === 'number') {
        (target as unknown as { letterSpacing: string }).letterSpacing = `${s.letterSpacing * size}px`;
      }
      target.textAlign = 'left';
      target.textBaseline = 'alphabetic';
    };

    const sprite = (
      s: TechTextProps,
      view: LayoutView,
      glyph: { char: string; x: number; box: GlyphBox },
      stroke: boolean,
      ink: string
    ): GlyphSprite => {
      const pad = Math.ceil((s.strokeWidth ?? 1.5) * 2 + 8);
      const originDevX = Math.floor((glyph.box.x1 - pad) * dpr);
      const originDevY = Math.floor((glyph.box.y1 - pad) * dpr);
      const left = originDevX / dpr;
      const top = originDevY / dpr;
      const w = Math.ceil((glyph.box.x2 + pad) * dpr) - originDevX;
      const h = Math.ceil((glyph.box.y2 + pad) * dpr) - originDevY;
      const image = document.createElement('canvas');
      image.width = Math.max(1, w);
      image.height = Math.max(1, h);
      const c = image.getContext('2d');
      if (!c) return { image, left, top };
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.setTransform(dpr, 0, 0, dpr, -originDevX, -originDevY);
      setFont(c, s, view.size);
      if (stroke) {
        c.lineJoin = 'round';
        c.lineWidth = (s.strokeWidth ?? 1.5) * 2;
        c.lineCap = 'butt';
        c.strokeStyle = ink;
        if (s.lineStyle !== 'solid') {
          c.setLineDash([Math.max(1, s.dashLength ?? 4), Math.max(1, s.dashGap ?? 2)]);
        }
        c.strokeText(glyph.char, glyph.x, view.baseline);
        c.setLineDash([]);
        c.globalCompositeOperation = 'destination-out';
        c.fillStyle = '#000000';
        c.fillText(glyph.char, glyph.x, view.baseline);
        c.globalCompositeOperation = 'source-over';
      } else {
        c.fillStyle = ink;
        c.fillText(glyph.char, glyph.x, view.baseline);
      }
      return { image, left, top };
    };

    const ensureLayout = (s: TechTextProps, ink: string): LayoutView => {
      const activeText = s.text ?? 'React Bits';
      const key = [
        activeText,
        family(s),
        s.fontWeight,
        s.fontSize,
        s.letterSpacing,
        s.align,
        ink,
        s.dashLength,
        s.dashGap,
        s.strokeWidth,
        s.lineStyle,
        width,
        height,
        dpr
      ].join('|');
      if (key === layoutKey && word) return word;
      layoutKey = key;

      const wanted = fontFor(s, 64);
      if (document.fonts && wanted !== requestedFont) {
        requestedFont = wanted;
        document.fonts.load(wanted, activeText).then(refreshFonts, refreshFonts);
      }

      const probe = scratchCtx;
      const baseFontSize = s.fontSize ?? 150;
      setFont(probe, s, baseFontSize);
      let m = probe.measureText(activeText);

      const mLeft = m.actualBoundingBoxLeft ?? 0;
      const mRight = m.actualBoundingBoxRight ?? m.width;
      const mAscent = m.actualBoundingBoxAscent ?? baseFontSize * 0.8;
      const mDescent = m.actualBoundingBoxDescent ?? baseFontSize * 0.2;

      const inkWidth = Math.max(mLeft + mRight, 1);
      const inkHeight = Math.max(mAscent + mDescent, 1);

      const fit = Math.min(
        1,
        (width * 0.96) / inkWidth,
        (height * 0.85) / inkHeight
      );
      const size = baseFontSize * fit;
      setFont(probe, s, size);
      m = probe.measureText(activeText);

      const actualLeft = m.actualBoundingBoxLeft ?? 0;
      const actualRight = m.actualBoundingBoxRight ?? m.width;
      const actualAscent = m.actualBoundingBoxAscent ?? size * 0.8;
      const actualDescent = m.actualBoundingBoxDescent ?? size * 0.2;

      const fittedInkWidth = actualLeft + actualRight;
      const fittedInkHeight = actualAscent + actualDescent;
      const margin = width * 0.02;
      let start = (width - fittedInkWidth) / 2;
      if (s.align === 'left') {
        start = margin;
      } else if (s.align === 'right') {
        start = width - margin - fittedInkWidth;
      }
      const x = start + actualLeft;
      const baseline = (height - fittedInkHeight) / 2 + actualAscent;

      const xMeasure = probe.measureText('x');
      const hMeasure = probe.measureText('H');
      const dMeasure = probe.measureText('d');
      const pMeasure = probe.measureText('p');

      const xHeight = baseline - (xMeasure.actualBoundingBoxAscent ?? size * 0.5);
      const capHeight = baseline - (hMeasure.actualBoundingBoxAscent ?? size * 0.7);
      const ascender = baseline - (dMeasure.actualBoundingBoxAscent ?? size * 0.75);
      const descender = baseline + (pMeasure.actualBoundingBoxDescent ?? size * 0.2);
      const top = baseline - actualAscent;
      const bottom = baseline + actualDescent;
      const inkTop = Math.min(top, capHeight) - 2;
      const inkBottom = Math.max(bottom, baseline) + 2;

      const next: LayoutView = {
        size,
        baseline,
        left: x - actualLeft,
        right: x + actualRight,
        top,
        bottom,
        lines: [
          { y: baseline, label: 'baseline' },
          { y: xHeight, label: 'x-height' },
          { y: capHeight, label: 'cap height' },
          ...(capHeight - ascender > Math.max(11, size * 0.06) ? [{ y: ascender, label: 'ascender' }] : []),
          { y: descender, label: 'descender' }
        ],
        bands: [
          { y0: xHeight, y1: baseline, up: true, order: 0 },
          { y0: capHeight, y1: xHeight, up: true, order: 1 },
          { y0: inkTop, y1: capHeight, up: true, order: 2 },
          { y0: baseline, y1: inkBottom, up: false, order: 1 }
        ].filter(band => band.y1 - band.y0 > 0.5)
      };
      word = next;

      const chars = Array.from(activeText);
      const previous = glyphs;
      glyphs = [];
      let prefix = '';
      chars.forEach((char, i) => {
        prefix += char;
        const own = probe.measureText(char);
        const ownWidth = own.width;
        const ownLeft = own.actualBoundingBoxLeft ?? 0;
        const ownRight = own.actualBoundingBoxRight ?? ownWidth;
        const ownAscent = own.actualBoundingBoxAscent ?? size * 0.8;
        const ownDescent = own.actualBoundingBoxDescent ?? size * 0.2;

        const gx = x + probe.measureText(prefix).width - ownWidth;
        if (!char.trim()) return;
        const base = {
          char,
          x: gx,
          box: {
            x1: gx - ownLeft,
            y1: baseline - ownAscent,
            x2: gx + ownRight,
            y2: baseline + ownDescent
          }
        };
        const kept = previous[glyphs.length];
        glyphs.push({
          ...base,
          offset: kept?.char === char ? kept.offset : { x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
          outline: 0,
          shown: 1,
          cells: null,
          assembled: 0,
          index: i,
          fill: sprite(s, next, base, false, ink),
          dashes: sprite(s, next, base, true, ink)
        });
      });
      dragging = -1;
      frame.index = -1;
      return next;
    };

    const glyphAt = (x: number, y: number): number => {
      if (!word) return -1;
      let best = -1;
      let bestDistance = Infinity;
      glyphs.forEach((glyph, i) => {
        const x1 = glyph.box.x1 + glyph.offset.x;
        const x2 = glyph.box.x2 + glyph.offset.x;
        const y1 = glyph.box.y1 + glyph.offset.y;
        const y2 = glyph.box.y2 + glyph.offset.y;

        let dx = 0;
        if (x < x1) dx = x1 - x;
        else if (x > x2) dx = x - x2;

        let dy = 0;
        if (y < y1) dy = y1 - y;
        else if (y > y2) dy = y - y2;
        const d = Math.hypot(dx, dy);

        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      });
      return bestDistance < Math.max(32, (word.size || 120) * 0.35) ? best : -1;
    };

    const falloff = (
      target: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      radius: number,
      strength: number,
      softnessVal: number
    ) => {
      const inner = Math.min(1, Math.max(0, 1 - softnessVal));
      const gradient = target.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
      if (inner > 0.995) {
        gradient.addColorStop(0.995, `rgba(0, 0, 0, ${strength})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        return gradient;
      }
      for (let i = 0; i <= FALLOFF_STEPS; i++) {
        const t = i / FALLOFF_STEPS;
        const eased = t * t * (3 - 2 * t);
        gradient.addColorStop(inner + (1 - inner) * t, `rgba(0, 0, 0, ${strength * (1 - eased)})`);
      }
      return gradient;
    };

    const blit = (
      target: CanvasRenderingContext2D,
      art: GlyphSprite,
      dx: number,
      dy: number,
      originX = 0,
      originY = 0
    ) => {
      target.drawImage(
        art.image,
        Math.round((art.left + dx) * dpr - originX),
        Math.round((art.top + dy) * dpr - originY)
      );
    };

    const drawReveal = (s: TechTextProps, bleed: { x: number; y: number }) => {
      const radius = (s.reach ?? 200) * dpr;
      const cx = (lens.x + bleed.x) * dpr;
      const cy = (lens.y + bleed.y) * dpr;
      const softnessVal = s.softness ?? 0.7;

      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = falloff(ctx, cx, cy, radius, presence, softnessVal);
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.globalCompositeOperation = 'source-over';

      const x0 = Math.max(0, Math.floor(cx - radius));
      const y0 = Math.max(0, Math.floor(cy - radius));
      const x1 = Math.min(canvas.width, Math.ceil(cx + radius));
      const y1 = Math.min(canvas.height, Math.ceil(cy + radius));
      if (x1 <= x0 || y1 <= y0) return;
      const w = x1 - x0;
      const h = y1 - y0;
      if (scratch.width < w || scratch.height < h) {
        scratch.width = Math.max(scratch.width, w);
        scratch.height = Math.max(scratch.height, h);
        scratchCtx.imageSmoothingEnabled = true;
        scratchCtx.imageSmoothingQuality = 'high';
      }
      scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
      scratchCtx.globalCompositeOperation = 'source-over';
      scratchCtx.clearRect(0, 0, w, h);
      for (const glyph of glyphs) {
        blit(
          scratchCtx,
          glyph.dashes,
          glyph.offset.x,
          glyph.offset.y,
          x0 - bleed.x * dpr,
          y0 - bleed.y * dpr
        );
      }
      scratchCtx.globalCompositeOperation = 'destination-in';
      scratchCtx.fillStyle = falloff(scratchCtx, cx - x0, cy - y0, radius, 1, softnessVal);
      scratchCtx.fillRect(0, 0, w, h);
      scratchCtx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = presence;
      ctx.drawImage(scratch, 0, 0, w, h, x0, y0, w, h);
      ctx.globalAlpha = 1;
    };

    const crisp = (value: number) => (Math.round(value * dpr) + 0.5) / dpr;

    const perimeterPoint = (distance: number, w: number, h: number): [number, number, number, number] => {
      let d = ((distance % (2 * (w + h))) + 2 * (w + h)) % (2 * (w + h));
      if (d < w) return [frame.x1 + d, frame.y1, 0, -1];
      d -= w;
      if (d < h) return [frame.x2, frame.y1 + d, 1, 0];
      d -= h;
      if (d < w) return [frame.x2 - d, frame.y2, 0, 1];
      d -= w;
      return [frame.x1, frame.y2 - d, -1, 0];
    };

    const renderSingleSpeck = (
      k: number,
      box: { w: number; h: number; perimeter: number; a: number; seed: number }
    ) => {
      const { seed, a, w, h, perimeter } = box;
      const grid = 3;
      const period = 0.5 + noise(seed, k, 11) * 1.2;
      const t = pulse / period + noise(seed, k, 17);
      const cycle = Math.floor(t);
      const life = t - cycle;
      if (life > 0.7) return;

      const [px, py, nx, ny] = perimeterPoint(noise(seed, k, cycle) * perimeter, w, h);
      const pick = noise(seed, k, cycle, 2);
      const size = getSpeckSize(pick);
      const large = size >= 8;
      const out = (large ? 9 : 4) + Math.floor(noise(seed, k, cycle, 1) * 5) * grid;
      const x = frame.x1 + Math.round((px + nx * out - frame.x1) / grid) * grid;
      const y = frame.y1 + Math.round((py + ny * out - frame.y1) / grid) * grid;
      const tone = noise(seed, k, cycle, 3);

      let blink = 1;
      if (life < 0.06 || (life > 0.32 && life < 0.36)) {
        blink = 0.35;
      }

      const toneMultiplier = large ? 0.3 + 0.4 * tone : 0.3 + 0.6 * tone;
      const alpha = a * toneMultiplier * blink;
      const left = Math.round(x - size / 2);
      const top = Math.round(y - size / 2);

      ctx.globalAlpha = alpha;
      if (tone < 0.26 || (large && tone < 0.78)) {
        ctx.strokeRect(left + 0.5, top + 0.5, size, size);
        if (large && tone > 0.5) ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      } else {
        ctx.fillRect(left, top, size, size);
      }
    };

    const renderOrbitTrails = (s: TechTextProps, a: number, w: number, h: number, perimeter: number) => {
      const orbitAlpha = [0.95, 0.55, 0.32, 0.16];
      for (let j = 0; j < 2; j++) {
        const head = (pulse * 0.42 * (s.speed ?? 1) + j * 0.5) * perimeter;
        for (let i = 0; i < 4; i++) {
          const [x, y] = perimeterPoint(head - i * 6, w, h);
          const size = i === 0 ? 3 : 2;
          ctx.globalAlpha = a * orbitAlpha[i];
          ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
        }
      }
    };

    const drawSpecks = (s: TechTextProps, a: number, accent: string) => {
      const w = frame.x2 - frame.x1;
      const h = frame.y2 - frame.y1;
      if (w < 2 || h < 2) return;
      const perimeter = 2 * (w + h);
      const seed = frame.index + 1;
      ctx.fillStyle = accent;
      ctx.strokeStyle = accent;

      const numSpecks = s.specks ?? 15;
      const box = { w, h, perimeter, a, seed };
      for (let k = 0; k < numSpecks; k++) {
        renderSingleSpeck(k, box);
      }
      renderOrbitTrails(s, a, w, h, perimeter);
      ctx.globalAlpha = 1;
    };

    const drawFrame = (
      s: TechTextProps,
      view: LayoutView,
      accent: string,
      bleed: { x: number; y: number }
    ) => {
      const glyph = glyphs[frame.index];
      if (!glyph || frame.alpha < 0.01) return;
      const a = frame.alpha;

      const devX1 = Math.round((frame.x1 + bleed.x) * dpr);
      const devY1 = Math.round((frame.y1 + bleed.y) * dpr);
      const devX2 = Math.round((frame.x2 + bleed.x) * dpr);
      const devY2 = Math.round((frame.y2 + bleed.y) * dpr);
      const devW = devX2 - devX1;
      const devH = devY2 - devY1;

      const unit = Math.max(1, view.size * 0.012) * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = accent;
      ctx.strokeStyle = accent;
      ctx.lineWidth = unit;

      const moved = Math.hypot(glyph.offset.x, glyph.offset.y);
      if (moved > 1) {
        const hx = Math.round(((glyph.box.x1 + glyph.box.x2) / 2 + bleed.x) * dpr);
        const hy = Math.round(((glyph.box.y1 + glyph.box.y2) / 2 + bleed.y) * dpr);
        const targetX = Math.round(((glyph.box.x1 + glyph.box.x2) / 2 + glyph.offset.x + bleed.x) * dpr);
        const targetY = Math.round(((glyph.box.y1 + glyph.box.y2) / 2 + glyph.offset.y + bleed.y) * dpr);
        ctx.beginPath();
        ctx.moveTo(hx + 0.5, hy + 0.5);
        ctx.lineTo(targetX + 0.5, targetY + 0.5);
        ctx.setLineDash([Math.round(unit * 2.2), Math.round(unit * 2.8)]);
        ctx.globalAlpha = 0.5 * a;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.rect(hx - unit, hy - unit, unit * 2, unit * 2);
        ctx.globalAlpha = 0.75 * a;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.rect(devX1 + 0.5, devY1 + 0.5, devW, devH);
      ctx.globalAlpha = 0.65 * a;
      ctx.stroke();

      const handleSize = Math.max(unit * 2.4, 4);
      const halfH = Math.floor(handleSize / 2);
      ctx.beginPath();
      for (const [cx, cy] of [
        [devX1, devY1],
        [devX2, devY1],
        [devX2, devY2],
        [devX1, devY2]
      ]) {
        ctx.rect(cx - halfH, cy - halfH, handleSize, handleSize);
      }
      ctx.globalAlpha = 0.95 * a;
      ctx.fill();
      ctx.globalAlpha = 1;

      if ((s.specks ?? 15) > 0) {
        ctx.setTransform(dpr, 0, 0, dpr, bleed.x * dpr, bleed.y * dpr);
        drawSpecks(s, a, accent);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      if (!s.labels) return;

      const labelCssSize = Math.max(8, view.size * 0.09);
      const labelDevSize = Math.round(labelCssSize * dpr);
      ctx.font = `600 ${labelDevSize}px "Geist Mono", Consolas, SFMono-Regular, Menlo, monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.98 * a;

      const label =
        moved > 1
          ? `${signed(Math.round(glyph.offset.x))}, ${signed(Math.round(-glyph.offset.y))}`
          : `${glyph.char}  ${Math.round(glyph.box.x2 - glyph.box.x1)} × ${Math.round(glyph.box.y2 - glyph.box.y1)}`;

      const labelGap = Math.round((labelCssSize * 0.45 + 3) * dpr);
      ctx.fillText(label, devX1, devY1 - labelGap);
      ctx.globalAlpha = 1;
    };

    const drawLines = (
      s: TechTextProps,
      view: LayoutView,
      accent: string,
      alpha: number,
      growth: (k: number) => number,
      bleed: { x: number; y: number }
    ) => {
      const pad = Math.max(12, view.size * 0.12);
      const x1 = Math.round(view.left - pad);
      const x2 = Math.round(view.right + pad);
      const room = width - x2 > x1;
      ctx.setTransform(dpr, 0, 0, dpr, bleed.x * dpr, bleed.y * dpr);
      ctx.strokeStyle = accent;
      ctx.fillStyle = accent;
      ctx.lineWidth = 1;
      ctx.font = LABEL_FONT;
      ctx.textBaseline = 'middle';
      ctx.textAlign = room ? 'left' : 'right';
      view.lines.forEach((line, k) => {
        const grow = growth(k);
        if (grow <= 0.001) return;
        const y = crisp(line.y);
        const end = x1 + (x2 - x1) * grow;
        ctx.globalAlpha = alpha * 0.4;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(end, y);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillRect(x1 - 1, Math.round(line.y) - 1, 3, 3);
        ctx.fillRect(Math.round(end) - 1, Math.round(line.y) - 1, 3, 3);
        if (s.labels) {
          ctx.globalAlpha = alpha * 0.9 * smoothstep(0.7, 1, grow);
          ctx.fillText(line.label, room ? x2 + 8 : x1 - 8, Math.round(line.y));
        }
      });
      ctx.textAlign = 'left';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
    };

    const ensureCells = (glyph: GlyphData, view: LayoutView) => {
      if (glyph.cells) return glyph.cells;
      const art = glyph.fill;
      const size = Math.max(3, Math.round(view.size / 26));
      const w = art.image.width;
      const h = art.image.height;
      const source = art.image.getContext('2d');
      const cells: AssemblyCell[] = [];
      glyph.cells = cells;
      glyph.assembled = 0;
      if (!source || w < 2 || h < 2) return cells;
      const data = source.getImageData(0, 0, w, h).data;
      const gx = Math.floor(art.left / size) * size;
      const gy = Math.floor(art.top / size) * size;
      const cols = Math.ceil((art.left + w / dpr - gx) / size) + 1;
      const rows = Math.ceil((art.top + h / dpr - gy) / size) + 1;
      const hit = new Uint8Array(cols * rows);
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          if (data[(py * w + px) * 4 + 3] < 24) continue;
          const cx = Math.floor((art.left + px / dpr - gx) / size);
          const cy = Math.floor((art.top + py / dpr - gy) / size);
          hit[cy * cols + cx] = 1;
        }
      }
      const center = (glyph.box.x1 + glyph.box.x2) / 2;
      const along = clamp01((center - view.left) / Math.max(1, view.right - view.left));
      for (let k = 0; k < hit.length; k++) {
        if (!hit[k]) continue;
        const angle = noise(glyph.index, k, 1) * Math.PI * 2;
        const distance = view.size * (0.25 + 0.6 * noise(glyph.index, k, 2));
        const start = 0.03 + 0.36 * along + 0.12 * noise(glyph.index, k, 3);
        const land = start + 0.3 + 0.14 * noise(glyph.index, k, 4);
        cells.push({
          x: gx + (k % cols) * size,
          y: gy + Math.floor(k / cols) * size,
          size,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance * 0.7,
          start,
          land
        });
        glyph.assembled = Math.max(glyph.assembled, land);
      }
      return cells;
    };

    const cellRect = (x: number, y: number, size: number, bleed: { x: number; y: number }): [number, number, number, number] => {
      const left = Math.round((x + bleed.x) * dpr);
      const top = Math.round((y + bleed.y) * dpr);
      return [left, top, Math.round((x + size + bleed.x) * dpr) - left, Math.round((y + size + bleed.y) * dpr) - top];
    };

    const drawAssembling = (glyph: GlyphData, progress: number, accent: string, bleed: { x: number; y: number }) => {
      const cells = glyph.cells || [];
      ctx.save();
      ctx.beginPath();
      let landed = 0;
      for (const cell of cells) {
        if (progress < cell.land) continue;
        const [x, y, w, h] = cellRect(cell.x, cell.y, cell.size, bleed);
        ctx.rect(x, y, w, h);
        landed++;
      }
      if (landed) {
        ctx.clip();
        blit(ctx, glyph.fill, 0, 0, -bleed.x * dpr, -bleed.y * dpr);
      }
      ctx.restore();
      ctx.fillStyle = accent;
      for (const cell of cells) {
        if (progress < cell.start || progress >= cell.land) continue;
        const u = (progress - cell.start) / (cell.land - cell.start);
        const eased = 1 - Math.pow(1 - u, 4);
        const size = cell.size * (0.4 + 0.6 * eased);
        const x = cell.x + (cell.size - size) / 2 + cell.dx * (1 - eased);
        const y = cell.y + (cell.size - size) / 2 + cell.dy * (1 - eased);
        const [left, top, w, h] = cellRect(x, y, size, bleed);
        ctx.globalAlpha = Math.min(1, u * 4) * (0.55 + 0.45 * eased);
        ctx.fillRect(left, top, Math.max(1, w), Math.max(1, h));
      }
      ctx.globalAlpha = 1;
    };

    const drawFilling = (glyph: GlyphData, lead: number, progress: number, view: LayoutView, bleed: { x: number; y: number }) => {
      const art = glyph.fill;
      const left = Math.floor((art.left + bleed.x) * dpr);
      const top = Math.floor((art.top + bleed.y) * dpr);
      const w = art.image.width + 2;
      const h = art.image.height + 2;
      const fill = clamp01((progress - 0.24 - 0.28 * lead) / 0.48);
      const rects: Array<[number, number]> = [];
      for (const band of view.bands) {
        const amount = smoothstep(0.3 * band.order, 0.3 * band.order + 0.4, fill);
        if (amount <= 0) continue;
        const span = (band.y1 - band.y0) * amount;
        const y0 = Math.round((band.up ? band.y1 - span + bleed.y : band.y0 + bleed.y) * dpr);
        const y1 = Math.round((band.up ? band.y1 + bleed.y : band.y0 + span + bleed.y) * dpr);
        if (y1 > y0) rects.push([y0, y1 - y0]);
      }
      const outline = smoothstep(0.08 + 0.2 * lead, 0.22 + 0.2 * lead, progress);
      if (outline > 0.001) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(left - 2, top - 2, w + 2, h + 2);
        for (const [y, span] of rects) ctx.rect(left - 2, y, w + 2, span);
        ctx.clip('evenodd');
        ctx.globalAlpha = outline;
        blit(ctx, glyph.dashes, 0, 0, -bleed.x * dpr, -bleed.y * dpr);
        ctx.restore();
      }
      if (rects.length) {
        ctx.save();
        ctx.beginPath();
        for (const [y, span] of rects) ctx.rect(left - 2, y, w + 2, span);
        ctx.clip();
        blit(ctx, glyph.fill, 0, 0, -bleed.x * dpr, -bleed.y * dpr);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    const kick = (index: number) => {
      const strength = (word ? word.size : 120) * 11;
      kicks.push({ index, at: pulse, velocity: strength });
      for (let d = 1; d < glyphs.length; d++) {
        const velocity = strength * Math.pow(KICK_DECAY, d);
        if (velocity < 30) break;
        for (const j of [index - d, index + d]) {
          if (j >= 0 && j < glyphs.length) kicks.push({ index: j, at: pulse + d * 0.055, velocity });
        }
      }
      wakeRef.current();
    };

    const updateIntroProgress = (s: TechTextProps, dt: number): number => {
      if (s.intro !== introKind) {
        introKind = s.intro ?? 'none';
        introClock = 0;
      }
      const introOn = introKind !== 'none' && !reducedMotion && glyphs.length > 0;
      if (introOn && fontsReady) introClock += dt;
      const progress = introOn
        ? clamp01((introClock - INTRO_DELAY) / Math.max(0.3, s.introDuration ?? 2))
        : 1;
      introducing = introOn && progress < 1;
      return progress;
    };

    const updateSweepAndLens = (s: TechTextProps, view: LayoutView, dt: number): boolean => {
      const sweeping = !introducing && Boolean(s.sweep) && !reducedMotion && !pointer.inside && dragging < 0;
      const speed = Math.max(0.1, s.speed ?? 0.6);
      if (sweeping) clock += dt * speed;
      pulse += dt;
      let targetX = pointer.x;
      let targetY = pointer.y;
      if (sweeping) {
        const target = resolveSweepTarget(sweepState, glyphs, view, clock, speed, dt);
        targetX = target.x;
        targetY = target.y;
      } else {
        sweepState.initialized = false;
      }
      const active = !introducing && (pointer.inside || sweeping || dragging >= 0);
      if (active && !placed) {
        lens.x = targetX;
        lens.y = targetY;
      }
      if (active) {
        const lag = pointer.inside ? 0.05 : 0.45;
        lens.x = approach(lens.x, targetX, dt, lag);
        lens.y = approach(lens.y, targetY, dt, lag);
      }
      placed = active;
      presence = approach(presence, s.reveal === 'area' && active && dragging < 0 ? 1 : 0, dt, 0.16);
      return active;
    };

    const updateKickPulses = () => {
      for (let k = kicks.length - 1; k >= 0; k--) {
        if (kicks[k].at > pulse) continue;
        const glyph = glyphs[kicks[k].index];
        if (glyph) glyph.velocity.y -= kicks[k].velocity;
        kicks.splice(k, 1);
      }
    };

    const updateGlyphPhysics = (dt: number, damping: number): boolean => {
      let isMoving = false;
      const bleed = getBleed();
      glyphs.forEach((glyph, i) => {
        if (i === dragging) {
          const topPad = 32;
          const bottomPad = 20;
          const sidePad = 24;
          const minOffsetX = -bleed.left + sidePad - glyph.box.x1;
          const maxOffsetX = width + bleed.right - sidePad - glyph.box.x2;
          const minOffsetY = -bleed.top + topPad - glyph.box.y1;
          const maxOffsetY = height + bleed.bottom - bottomPad - glyph.box.y2;

          const targetX = Math.max(minOffsetX, Math.min(maxOffsetX, pointer.x - grab.x));
          const targetY = Math.max(minOffsetY, Math.min(maxOffsetY, pointer.y - grab.y));

          glyph.offset.x = approach(glyph.offset.x, targetX, dt, 0.03);
          glyph.offset.y = approach(glyph.offset.y, targetY, dt, 0.03);
          glyph.velocity.x = 0;
          glyph.velocity.y = 0;
          isMoving = true;
          return;
        }
        const { offset, velocity } = glyph;
        if (Math.abs(offset.x) < 0.05 && Math.abs(offset.y) < 0.05 && Math.hypot(velocity.x, velocity.y) < 0.5) {
          offset.x = 0;
          offset.y = 0;
          velocity.x = 0;
          velocity.y = 0;
          return;
        }
        velocity.x += (-SPRING * offset.x - damping * velocity.x) * dt;
        velocity.y += (-SPRING * offset.y - damping * velocity.y) * dt;
        offset.x += velocity.x * dt;
        offset.y += velocity.y * dt;
        isMoving = true;
      });
      return isMoving;
    };

    const updateIntroTyping = (progress: number): number => {
      if (!introducing || introKind !== 'type') {
        glyphs.forEach(glyph => {
          glyph.shown = 1;
        });
        return -1;
      }
      const step = 0.86 / glyphs.length;
      const cursorAt = Math.min(glyphs.length - 1, Math.floor(progress / step));
      const typing = progress < 0.93 ? cursorAt : -1;
      glyphs.forEach((glyph, i) => {
        if (i < cursorAt) {
          glyph.shown = 1;
        } else if (i === cursorAt) {
          glyph.shown = smoothstep(0, step * 0.3, progress - i * step);
        } else {
          glyph.shown = 0;
        }
      });
      return typing;
    };

    const updateSelectionFrame = (focus: number, dt: number, selectionEnabled: boolean) => {
      if (focus >= 0 && selectionEnabled) {
        const glyph = glyphs[focus];
        const bx1 = glyph.box.x1 + glyph.offset.x - 6;
        const by1 = glyph.box.y1 + glyph.offset.y - 6;
        const bx2 = glyph.box.x2 + glyph.offset.x + 6;
        const by2 = glyph.box.y2 + glyph.offset.y + 6;
        if (frame.index < 0 || frame.alpha < 0.02) {
          frame.x1 = bx1;
          frame.y1 = by1;
          frame.x2 = bx2;
          frame.y2 = by2;
        }
        const glide = focus === dragging ? 0.02 : 0.08;
        frame.x1 = approach(frame.x1, bx1, dt, glide);
        frame.y1 = approach(frame.y1, by1, dt, glide);
        frame.x2 = approach(frame.x2, bx2, dt, glide);
        frame.y2 = approach(frame.y2, by2, dt, glide);
        frame.index = focus;
      }
      frame.alpha = approach(frame.alpha, focus >= 0 && selectionEnabled ? 1 : 0, dt, 0.1);
    };

    const updateGlyphOutlines = (
      focus: number,
      typing: number,
      revealMode: string,
      dt: number
    ): boolean => {
      let isOutlining = false;
      glyphs.forEach((glyph, i) => {
        let target = 0;
        if (introducing) {
          if (introKind === 'type' && (i === typing || (typing >= 0 && i > typing))) {
            target = 1;
          }
        } else if (revealMode === 'letter' && i === focus && i !== dragging) {
          target = 1;
        }

        if (introducing && glyph.shown === 0) {
          glyph.outline = target;
        }
        glyph.outline = approach(glyph.outline, target, dt, 0.09);
        if (Math.abs(glyph.outline - target) > 0.002) {
          isOutlining = true;
        } else {
          glyph.outline = target;
        }
      });
      return isOutlining;
    };

    const resolveCursor = (focus: number, draggableEnabled: boolean, clickKickEnabled: boolean): string => {
      if (dragging >= 0) return 'grabbing';
      const hovering = !introducing && focus >= 0 && pointer.inside;
      if (hovering && draggableEnabled) return 'grab';
      if (hovering && clickKickEnabled) return 'pointer';
      return '';
    };

    const determineFocus = (typing: number, active: boolean): number => {
      if (introducing) return typing;
      if (dragging >= 0) return dragging;
      if (active) return glyphAt(lens.x, lens.y);
      return -1;
    };

    const renderGhostOutlines = (bleed: { x: number; y: number }) => {
      for (const glyph of glyphs) {
        const moved = Math.hypot(glyph.offset.x, glyph.offset.y);
        if (moved > 1) {
          ctx.globalAlpha = Math.min(1, moved / 24) * 0.55;
          blit(ctx, glyph.dashes, 0, 0, -bleed.x * dpr, -bleed.y * dpr);
          ctx.globalAlpha = 1;
        }
      }
    };

    const renderGlyphSprite = (
      glyph: GlyphData,
      i: number,
      view: LayoutView,
      progress: number,
      accent: string,
      bleed: { x: number; y: number }
    ) => {
      if (introducing && introKind === 'assemble') {
        ensureCells(glyph, view);
        if (progress < glyph.assembled) {
          drawAssembling(glyph, progress, accent, bleed);
          return;
        }
      }
      if (introducing && introKind === 'metrics') {
        const lead = glyphs.length > 1 ? i / (glyphs.length - 1) : 0;
        if (progress < 0.72 + 0.28 * lead) {
          drawFilling(glyph, lead, progress, view, bleed);
          return;
        }
      }
      if (glyph.shown < 0.001) return;
      if (glyph.outline < 0.999) {
        ctx.globalAlpha = (1 - glyph.outline) * glyph.shown;
        blit(ctx, glyph.fill, glyph.offset.x, glyph.offset.y, -bleed.x * dpr, -bleed.y * dpr);
      }
      if (glyph.outline > 0.001) {
        ctx.globalAlpha = glyph.outline * glyph.shown;
        blit(ctx, glyph.dashes, glyph.offset.x, glyph.offset.y, -bleed.x * dpr, -bleed.y * dpr);
      }
      ctx.globalAlpha = 1;
    };

    const renderScene = (
      s: TechTextProps,
      view: LayoutView,
      progress: number,
      accent: string,
      bleed: { x: number; y: number }
    ) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      renderGhostOutlines(bleed);

      if (introducing && introKind === 'metrics') {
        drawLines(
          s,
          view,
          accent,
          1 - smoothstep(0.84, 1, progress),
          k => smoothstep(0.02 + 0.04 * k, 0.2 + 0.04 * k, progress),
          bleed
        );
      } else if (guideAlpha > 0.005) {
        drawLines(s, view, accent, guideAlpha * 0.6, () => 1, bleed);
      }

      let activeGlyphIndex = -1;
      if (dragging >= 0) {
        activeGlyphIndex = dragging;
      } else if (frame.alpha > 0.05) {
        activeGlyphIndex = frame.index;
      }
      glyphs.forEach((glyph, i) => {
        if (i !== activeGlyphIndex) {
          renderGlyphSprite(glyph, i, view, progress, accent, bleed);
        }
      });
      if (activeGlyphIndex >= 0 && glyphs[activeGlyphIndex]) {
        renderGlyphSprite(glyphs[activeGlyphIndex], activeGlyphIndex, view, progress, accent, bleed);
      }

      if (presence > 0.001) drawReveal(s, bleed);
      drawFrame(s, view, accent, bleed);
    };

    const checkSettling = (moving: boolean, active: boolean, revealMode?: string): boolean => {
      return (
        moving ||
        introducing ||
        kicks.length > 0 ||
        (guideAlpha > 0.005 && guideAlpha < 0.995) ||
        Math.abs(presence - (revealMode === 'area' && active && dragging < 0 ? 1 : 0)) > 0.002 ||
        (frame.alpha > 0.01 && frame.alpha < 0.99) ||
        glyphs.some(g => g.outline > 0.002 && g.outline < 0.998)
      );
    };

    const tick = (now: number) => {
      raf = 0;
      const s = settingsRef.current;
      if (!s) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      const { ink, accent } = palette(s);
      const view = ensureLayout(s, ink);
      const damping = 2 * Math.sqrt(SPRING) * (1 - clamp01(s.bounce ?? 0.4) * 0.96);
      const bleed = getBleed();

      const progress = updateIntroProgress(s, dt);
      const active = updateSweepAndLens(s, view, dt);
      updateKickPulses();

      const isPhysicsMoving = updateGlyphPhysics(dt, damping);
      const typing = updateIntroTyping(progress);
      const focus = determineFocus(typing, active);

      updateSelectionFrame(focus, dt, Boolean(s.selection));
      const isOutlining = updateGlyphOutlines(focus, typing, s.reveal ?? 'letter', dt);
      const moving = isPhysicsMoving || isOutlining;

      guideAlpha = approach(guideAlpha, s.guides && !introducing && (focus >= 0 || presence > 0.4) ? 1 : 0, dt, 0.14);

      const nextCursor = resolveCursor(focus, Boolean(s.draggable), Boolean(s.clickKick));
      if (nextCursor !== cursor) {
        cursor = nextCursor;
        container.style.cursor = nextCursor;
      }

      renderScene(s, view, progress, accent, bleed);

      const settling = checkSettling(moving, active, s.reveal);
      if ((active || settling) && visible && alive) raf = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (raf || !visible || !alive) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    wakeRef.current = wake;

    const resize = () => {
      const bleed = getBleed();
      const rect = container.getBoundingClientRect();
      width = Math.max(1, rect.width || container.clientWidth);
      height = Math.max(1, rect.height || container.clientHeight);
      dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);

      const narrow = window.innerWidth <= 1000;
      const margin = 16;
      const bleedLeft = narrow ? Math.min(bleed.left, Math.max(0, rect.left - margin)) : bleed.left;
      const bleedRight = narrow ? Math.min(bleed.right, Math.max(0, window.innerWidth - margin - rect.right)) : bleed.right;

      const canvasWidth = Math.round((width + bleedLeft + bleedRight) * dpr);
      const canvasHeight = Math.round((height + bleed.top + bleed.bottom) * dpr);

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      canvas.style.position = 'absolute';
      canvas.style.left = `-${bleedLeft}px`;
      canvas.style.top = `-${bleed.top}px`;
      canvas.style.width = `${width + bleedLeft + bleedRight}px`;
      canvas.style.height = `${height + bleed.top + bleed.bottom}px`;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      scratchCtx.imageSmoothingEnabled = true;
      scratchCtx.imageSmoothingQuality = 'high';

      layoutKey = '';
      tick(performance.now());
    };

    const locate = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    };

    const onMove = (e: PointerEvent) => {
      locate(e);
      pointer.inside = true;
      wake();
    };

    const onLeave = () => {
      if (dragging >= 0) return;
      pointer.inside = false;
      wake();
    };

    const onDown = (e: PointerEvent) => {
      locate(e);
      pointer.inside = true;
      const s = settingsRef.current;
      const primary = e.pointerType !== 'mouse' || e.button === 0;
      const index = introducing || !primary ? -1 : glyphAt(pointer.x, pointer.y);
      press.x = pointer.x;
      press.y = pointer.y;
      press.time = performance.now();
      press.index = index;
      if (s?.draggable && index >= 0) {
        dragging = index;
        container.style.touchAction = 'none';
        grab.x = pointer.x - glyphs[index].offset.x;
        grab.y = pointer.y - glyphs[index].offset.y;
        try {
          container.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
      wake();
    };

    const onUp = (e: PointerEvent) => {
      if (dragging >= 0) {
        dragging = -1;
        container.style.touchAction = 'pan-y';
        try {
          container.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        const rect = container.getBoundingClientRect();
        pointer.inside =
          e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      }
      if (
        e.type === 'pointerup' &&
        press.index >= 0 &&
        settingsRef.current?.clickKick &&
        !reducedMotion &&
        performance.now() - press.time < 450
      ) {
        const rect = container.getBoundingClientRect();
        if (Math.hypot(e.clientX - rect.left - press.x, e.clientY - rect.top - press.y) < 10) {
          kick(press.index);
        }
      }
      press.index = -1;
      wake();
    };

    const onCancel = (e: PointerEvent) => {
      if (dragging >= 0) {
        dragging = -1;
        container.style.touchAction = 'pan-y';
        try {
          container.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
      pointer.inside = false;
      press.index = -1;
      wake();
    };

    container.addEventListener('pointermove', onMove, { passive: true });
    container.addEventListener('pointerenter', onMove, { passive: true });
    container.addEventListener('pointerdown', onDown);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', onCancel);
    container.addEventListener('pointerleave', onLeave, { passive: true });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        tick(performance.now());
      }
    });
    intersectionObserver.observe(container);
    const themeObserver = new MutationObserver(wake);
    for (const node of [document.documentElement, document.body]) {
      if (node) themeObserver.observe(node, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    }
    const schemeQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    schemeQuery?.addEventListener?.('change', wake);
    if (document.fonts) document.fonts.ready.then(fontsLoaded, fontsLoaded);

    const ensureFont = async () => {
      const fam = settingsRef.current?.fontFamily;
      if (!fam || typeof document === 'undefined' || !document.fonts) return;
      try {
        if ((fam === 'PlanetKosmos' || fam === 'Planet Kosmos') && !document.fonts.check('16px "PlanetKosmos"')) {
          const face = new FontFace('PlanetKosmos', 'url(/fonts/PlanetKosmos.ttf)', { weight: '400', style: 'normal' });
          const loaded = await face.load();
          document.fonts.add(loaded);
          refreshFonts();
        } else {
          await document.fonts.load(`400 64px "${fam}"`);
          refreshFonts();
        }
      } catch {
        // Fallback gracefully
      }
    };
    void ensureFont();

    resize();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      wakeRef.current = () => {};
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      schemeQuery?.removeEventListener?.('change', wake);
      container.style.cursor = '';
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerenter', onMove);
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onCancel);
      container.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`tech-text ${className}`.trim()}
      style={{
        ...style,
        fontFamily: fontFamily ? `"${fontFamily}", "PlanetKosmos", "Planet Kosmos", sans-serif` : undefined
      }}
      role="img"
      aria-label={text}
    >
      {fontFamily && (
        <span
          style={{
            fontFamily: `"${fontFamily}", "PlanetKosmos", "Planet Kosmos", sans-serif`,
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            fontSize: '1px'
          }}
          aria-hidden="true"
        >
          {text}
        </span>
      )}
      <canvas ref={canvasRef} className="tech-text-canvas" />
    </div>
  );
};
