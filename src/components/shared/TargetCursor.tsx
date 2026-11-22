'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './TargetCursor.css';

const CORNER_ANGLES = [0, 90, 180, 270];
const QUARTER = Math.PI / 2;
const DEFAULT_TARGET_SELECTOR =
  'button, a, [role="button"], input, select, textarea, .cursor-target, [data-cursor-target], .sonify-card, .sonify-teaser-card, .sonify-about-slide';

export interface TargetCursorProps {
  targetSelector?: string;
  cursorColor?: string;
  cursorColorOnTarget?: string;
  spinDuration?: number;
  hoverDuration?: number;
  parallaxOn?: boolean;
  hideDefaultCursor?: boolean;
  size?: number;
  cornerSize?: number;
  thickness?: number;
  padding?: number;
  matchRadius?: boolean;
  dotSize?: number;
  blendMode?: React.CSSProperties['mixBlendMode'];
  showLabel?: boolean;
  clickEffect?: boolean;
  container?: React.RefObject<HTMLElement | null> | HTMLElement | null;
}

interface SpringState {
  x: number;
  v: number;
}

interface PointerState {
  x: number;
  y: number;
  inside: boolean;
  seen: boolean;
  pressed: boolean;
}

type InternalSettings = Required<Omit<TargetCursorProps, 'cursorColorOnTarget' | 'container'>> & {
  cursorColorOnTarget?: string;
  container?: React.RefObject<HTMLElement | null> | HTMLElement | null;
};

// Scale responsively around 1440×900, with a slightly smaller cursor throughout.
// Pointer positions and target rectangles stay in CSS pixels; never scale them.
const getViewportScale = (): number =>
  0.85 * Math.max(0.75, Math.min(1.5, window.innerWidth / 1440, window.innerHeight / 900));

const scaleCursorSettings = (settings: InternalSettings, scale: number): InternalSettings => ({
  ...settings,
  size: settings.size * scale,
  cornerSize: settings.cornerSize * scale,
  thickness: settings.thickness * scale,
  padding: settings.padding * scale,
  dotSize: settings.dotSize * scale
});

const spring = (state: SpringState, goal: number, stiffness: number, damping: number, dt: number): void => {
  // Keep the integration stable after a long frame (including software-rendered maps).
  const steps = Math.max(1, Math.ceil(dt * 240));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    state.v += (stiffness * (goal - state.x) - damping * state.v) * h;
    state.x += state.v * h;
  }
};

const resolveElement = (
  value?: React.RefObject<HTMLElement | null> | HTMLElement | null
): HTMLElement | null => {
  if (!value) return null;
  if ('current' in value) return value.current;
  return value;
};

interface CornerStyleParams {
  centerX: number;
  centerY: number;
  w: number;
  h: number;
  sin: number;
  cos: number;
  degrees: number;
  cornerSize: number;
  thickness: number;
  r: number;
  cardBox: DOMRect | null;
}

const updateCornerStyles = (
  corners: Array<HTMLSpanElement | null>,
  p: CornerStyleParams
): { left: number; top: number } => {
  const local = [
    [-p.w, -p.h],
    [p.w, -p.h],
    [p.w, p.h],
    [-p.w, p.h]
  ];
  let left = Infinity;
  let top = Infinity;

  corners.forEach((corner, i) => {
    if (!corner) return;
    const [lx, ly] = local[i];
    const x = p.centerX + lx * p.cos - ly * p.sin;
    const y = p.centerY + lx * p.sin + ly * p.cos;
    left = Math.min(left, x);
    top = Math.min(top, y);
    corner.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${(CORNER_ANGLES[i] + p.degrees).toFixed(2)}deg)`;
    corner.style.width = `${p.cornerSize}px`;
    corner.style.height = `${p.cornerSize}px`;
    corner.style.borderWidth = `${p.thickness}px 0 0 ${p.thickness}px`;
    corner.style.borderTopLeftRadius = `${p.r.toFixed(2)}px`;
    // Derive the transformed bounds instead of forcing layout after style writes.
    const angle = (CORNER_ANGLES[i] + p.degrees) * Math.PI / 180;
    const dx = Math.cos(angle) * p.cornerSize;
    const dy = Math.sin(angle) * p.cornerSize;
    const xMin = x + Math.min(0, dx, -dy, dx - dy);
    const xMax = x + Math.max(0, dx, -dy, dx - dy);
    const yMin = y + Math.min(0, dy, dx, dy + dx);
    const yMax = y + Math.max(0, dy, dx, dy + dx);
    const box = p.cardBox;
    corner.style.visibility = box && xMax > box.left && xMin < box.right && yMax > box.top && yMin < box.bottom ? 'hidden' : '';
  });

  return { left, top };
};

const updateDotStyle = (
  dot: HTMLSpanElement | null,
  pointer: PointerState,
  pressX: number,
  dotSize: number
): void => {
  if (!dot) return;
  const dotScale = 1 - pressX * 0.35;
  dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate(-50%, -50%) scale(${dotScale.toFixed(3)})`;
  dot.style.width = `${dotSize}px`;
  dot.style.height = `${dotSize}px`;
};

const updateLabelStyle = (
  label: HTMLSpanElement | null,
  left: number,
  top: number,
  lockX: number,
  text: string,
  lastLabelRef: { current: string }
): void => {
  if (!label) return;
  if (text && text !== lastLabelRef.current) {
    label.textContent = text;
    lastLabelRef.current = text;
  }
  const shown = text ? Math.max(0, Math.min(1, lockX)) : 0;
  label.style.transform = `translate3d(${left.toFixed(2)}px, ${(top - 8).toFixed(2)}px, 0) translateY(-100%) translateY(${((1 - shown) * 4).toFixed(2)}px)`;
  label.style.opacity = shown.toFixed(3);
};

interface GoalMetrics {
  goalX: number;
  goalY: number;
  goalW: number;
  goalH: number;
  goalR: number;
}

function computeGoalMetrics(
  rect: DOMRect | null,
  locked: boolean,
  pointer: PointerState,
  s: InternalSettings,
  quarter: number,
  targetRadius: number
): GoalMetrics {
  if (!locked || !rect) {
    return {
      goalX: pointer.x,
      goalY: pointer.y,
      goalW: s.size / 2,
      goalH: s.size / 2,
      goalR: Math.min(2, s.cornerSize / 4)
    };
  }

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const lean = s.parallaxOn ? 0.08 : 0;
  const odd = Math.abs(quarter) % 2 === 1;
  const w = rect.width / 2 + s.padding;
  const h = rect.height / 2 + s.padding;

  return {
    goalX: cx + (pointer.x - cx) * lean,
    goalY: cy + (pointer.y - cy) * lean,
    goalW: odd ? h : w,
    goalH: odd ? w : h,
    goalR: s.matchRadius ? Math.min(targetRadius + Math.max(0, s.padding), s.cornerSize) : 0
  };
}

interface CursorSprings {
  centerX: SpringState;
  centerY: SpringState;
  halfW: SpringState;
  halfH: SpringState;
  radius: SpringState;
  turn: SpringState;
  lock: SpringState;
  press: SpringState;
  presence: SpringState;
}

function shouldKeepCursorAnimating(
  pointer: PointerState,
  springs: CursorSprings,
  goalX: number,
  goalY: number,
  locked: boolean,
  spinSpeed: number
): boolean {
  const resting =
    !pointer.inside &&
    springs.presence.x < 0.002 &&
    Math.abs(springs.presence.v) < 0.002 &&
    Math.abs(springs.lock.x) < 0.002 &&
    Math.abs(springs.press.x) < 0.002;
  if (resting) return false;

  const spinning = pointer.inside && !locked && spinSpeed > 0.0001;
  const moving =
    Math.abs(springs.centerX.v) +
      Math.abs(springs.centerY.v) +
      Math.abs(springs.halfW.v) +
      Math.abs(springs.halfH.v) +
      Math.abs(springs.turn.v) >
      0.01 ||
    Math.abs(goalX - springs.centerX.x) + Math.abs(goalY - springs.centerY.x) > 0.05 ||
    Math.abs(springs.lock.v) + Math.abs(springs.press.v) + Math.abs(springs.presence.v) > 0.001;

  return spinning || moving;
}

interface SnapConfig {
  snapK: number;
  snapW: number;
  snapC: number;
}

function stepSprings(
  springs: CursorSprings,
  pointer: PointerState,
  locked: boolean,
  s: InternalSettings,
  dt: number
): SnapConfig {
  const snapW = 4.6 / s.hoverDuration;
  const snapK = snapW * snapW;
  const snapC = 2 * 0.72 * snapW;

  spring(springs.presence, pointer.inside ? 1 : 0, 260, 32, dt);
  spring(springs.lock, locked ? 1 : 0, snapK, 2 * snapW, dt);
  spring(springs.press, pointer.pressed && s.clickEffect ? 1 : 0, 900, 40, dt);
  return { snapK, snapW, snapC };
}

function stepMotion(
  springs: CursorSprings,
  goal: GoalMetrics,
  locked: boolean,
  quarter: number,
  snap: SnapConfig,
  dt: number
) {
  const follow = locked ? Math.max(snap.snapK, 3600) : 5600;
  const followC = locked ? Math.max(snap.snapC, 2 * Math.sqrt(3600)) : 2 * Math.sqrt(5600);
  spring(springs.centerX, goal.goalX, follow, followC, dt);
  spring(springs.centerY, goal.goalY, follow, followC, dt);
  spring(springs.halfW, goal.goalW, snap.snapK, snap.snapC, dt);
  spring(springs.halfH, goal.goalH, snap.snapK, snap.snapC, dt);
  spring(springs.radius, goal.goalR, snap.snapK, 2 * snap.snapW, dt);
  if (locked) {
    spring(springs.turn, quarter * QUARTER, snap.snapK, snap.snapC, dt);
  }
}

function updateSpin(
  springs: CursorSprings,
  locked: boolean,
  s: InternalSettings,
  reduce: boolean,
  spinSpeed: number,
  dt: number
): number {
  if (locked) return spinSpeed;
  const speed = s.spinDuration > 0 && !reduce ? (Math.PI * 2) / s.spinDuration : 0;
  const nextSpeed = spinSpeed + (speed - spinSpeed) * (1 - Math.exp(-dt * 3));
  springs.turn.v = nextSpeed;
  springs.turn.x += nextSpeed * dt;
  return nextSpeed;
}

function syncInitialPointerState(pointer: PointerState, springs: CursorSprings, goal: GoalMetrics): void {
  if (!pointer.inside && springs.presence.x < 0.01) pointer.seen = false;
  if (!pointer.seen) {
    springs.centerX.x = goal.goalX;
    springs.centerY.x = goal.goalY;
    springs.halfW.x = goal.goalW;
    springs.halfH.x = goal.goalH;
    pointer.seen = pointer.inside;
  }
}

function resolveLabelText(showLabel: boolean, target: HTMLElement | null): string {
  if (!showLabel || !(target instanceof HTMLElement)) return '';
  return target.dataset.cursorLabel || '';
}

function updateCursorColor(
  root: HTMLDivElement,
  s: InternalSettings,
  lockX: number,
  presenceX: number,
  lastColorRef: { current: string }
) {
  const mix = s.cursorColorOnTarget ? Math.round(Math.max(0, Math.min(1, lockX)) * 100) : 0;
  const color = mix ? `color-mix(in oklab, ${s.cursorColorOnTarget} ${mix}%, ${s.cursorColor})` : s.cursorColor;
  if (color !== lastColorRef.current) {
    root.style.setProperty('--target-cursor-color', color);
    lastColorRef.current = color;
  }
  root.style.opacity = Math.max(0, Math.min(1, presenceX)).toFixed(3);
}

const TargetCursor: React.FC<TargetCursorProps> = ({
  targetSelector = DEFAULT_TARGET_SELECTOR,
  cursorColor = '#f2f2f0',
  cursorColorOnTarget,
  spinDuration = 2,
  hoverDuration = 0.2,
  parallaxOn = true,
  hideDefaultCursor = true,
  size = 36,
  cornerSize = 12,
  thickness = 2.5,
  padding = 6,
  matchRadius = true,
  dotSize = 4,
  blendMode = 'difference',
  showLabel = false,
  clickEffect = true,
  container
}) => {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cornerRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const dotRef = useRef<HTMLSpanElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const wakeRef = useRef<(() => void) | null>(null);

  const settings: InternalSettings = {
    targetSelector,
    cursorColor,
    cursorColorOnTarget,
    spinDuration,
    hoverDuration: Math.max(0.05, hoverDuration),
    parallaxOn,
    hideDefaultCursor,
    size: Math.max(4, size),
    cornerSize: Math.max(2, cornerSize),
    thickness: Math.max(0.5, thickness),
    padding,
    matchRadius,
    dotSize: Math.max(0, dotSize),
    blendMode,
    showLabel,
    clickEffect,
    container
  };
  const settingsRef = useRef<InternalSettings>(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setHost(finePointer.matches ? document.body : null);
    update();
    finePointer.addEventListener('change', update);
    return () => finePointer.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!host || !root) return undefined;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const style = document.createElement('style');
    document.head.appendChild(style);

    const pointer: PointerState = { x: 0, y: 0, inside: false, seen: false, pressed: false };
    const springs: CursorSprings = {
      centerX: { x: 0, v: 0 },
      centerY: { x: 0, v: 0 },
      halfW: { x: 0, v: 0 },
      halfH: { x: 0, v: 0 },
      radius: { x: 0, v: 0 },
      turn: { x: 0, v: 0 },
      lock: { x: 0, v: 0 },
      press: { x: 0, v: 0 },
      presence: { x: 0, v: 0 }
    };

    let target: HTMLElement | null = null;
    let targetRadius = 0;
    let quarter = 0;
    let spinSpeed = 0;
    let raf = 0;
    let last = 0;
    let lastActivity = 0;
    const lastLabelRef = { current: '' };
    const lastColorRef = { current: '' };
    let lastScope: HTMLElement | null = null;
    let viewportScale = getViewportScale();

    const scopeOf = () => resolveElement(settingsRef.current.container);

    const hideCursor = () => {
      const s = settingsRef.current;
      const scope = scopeOf();
      if (scope !== lastScope) {
        lastScope?.removeAttribute('data-target-cursor-scope');
        scope?.setAttribute('data-target-cursor-scope', '');
        lastScope = scope;
      }
      const selector = scope ? '[data-target-cursor-scope]' : 'html';
      // Keep the system pointer until the bracket is actually drawn. Hide zones
      // set data-suppressed, and the bracket also fades in from opacity 0.
      const opacity = Number.parseFloat(root.style.opacity);
      const bracketShown =
        root.isConnected &&
        root.getAttribute('data-suppressed') !== 'true' &&
        Number.isFinite(opacity) &&
        opacity > 0.35;
      const rule =
        s.hideDefaultCursor && pointer.inside && bracketShown ? `${selector}, ${selector} * { cursor: none !important; }` : '';
      if (style.textContent !== rule) style.textContent = rule;
    };

    const regionCoveredByCard = (element: HTMLElement): boolean => {
      if (!element.matches('.sonify-region, .sonify-region-box')) return false;
      const card = document.querySelector('[data-region-card]');
      if (!(card instanceof HTMLElement)) return false;
      const region = element.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      return region.left < cardBox.right && region.right > cardBox.left && region.top < cardBox.bottom && region.bottom > cardBox.top;
    };

    const findTarget = (x: number, y: number, element?: Element | null): HTMLElement | null => {
      const s = settingsRef.current;
      const raw = element || document.elementFromPoint(x, y);
      const node = (raw instanceof Element ? raw : null) as HTMLElement | null;
      if (!node || typeof node.closest !== 'function') return null;

      const interactiveParent = node.closest('button, a, [role="button"]') as HTMLElement | null;
      if (interactiveParent) {
        if (regionCoveredByCard(interactiveParent)) return null;
        return interactiveParent;
      }

      const found = (node.closest(s.targetSelector) as HTMLElement | null) || null;
      const scope = scopeOf();
      if (found && scope && !scope.contains(found)) return null;
      return found;
    };

    const targetObserver = new ResizeObserver(() => wake());
    const lockOn = (next: HTMLElement | null) => {
      if (next === target) return;
      targetObserver.disconnect();
      target = next;
      if (target) {
        targetObserver.observe(target);
        const angle = springs.turn.x;
        quarter = Math.round(angle / QUARTER);
        const corner = Number.parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
        targetRadius = corner;
        spinSpeed = 0;
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (document.hidden) {
        last = 0;
        return;
      }
      const s = scaleCursorSettings(settingsRef.current, viewportScale);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;

      if (target && !target.isConnected) lockOn(null);
      const rect = target ? target.getBoundingClientRect() : null;
      const card = document.querySelector('[data-region-card]');
      const cardBox = card instanceof HTMLElement ? card.getBoundingClientRect() : null;
      const locked = Boolean(rect && rect.width > 0 && rect.height > 0 && pointer.inside);

      const snap = stepSprings(springs, pointer, locked, s, dt);
      const goal = computeGoalMetrics(rect, locked, pointer, s, quarter, targetRadius);

      syncInitialPointerState(pointer, springs, goal);
      stepMotion(springs, goal, locked, quarter, snap, dt);
      const idle = now - lastActivity > 200;
      if (idle && !locked) {
        spinSpeed = 0;
        springs.turn.v = 0;
      } else {
        spinSpeed = updateSpin(springs, locked, s, reduce, spinSpeed, dt);
      }

      const squeeze = 1 - springs.press.x * 0.14;
      const w = Math.max(0, springs.halfW.x) * squeeze;
      const h = Math.max(0, springs.halfH.x) * squeeze;
      const r = Math.max(0, Math.min(springs.radius.x, s.cornerSize));
      const degrees = (springs.turn.x * 180) / Math.PI;

      const { left, top } = updateCornerStyles(cornerRefs.current, {
        centerX: springs.centerX.x,
        centerY: springs.centerY.x,
        w,
        h,
        sin: Math.sin(springs.turn.x),
        cos: Math.cos(springs.turn.x),
        degrees,
        cornerSize: s.cornerSize,
        thickness: s.thickness,
        r,
        cardBox
      });

      updateDotStyle(dotRef.current, pointer, springs.press.x, s.dotSize);

      const labelText = resolveLabelText(s.showLabel, target);
      updateLabelStyle(labelRef.current, left, top, springs.lock.x, labelText, lastLabelRef);

      updateCursorColor(root, s, springs.lock.x, springs.presence.x, lastColorRef);
      hideCursor();

      if (shouldKeepCursorAnimating(pointer, springs, goal.goalX, goal.goalY, locked, spinSpeed)) {
        raf = requestAnimationFrame(frame);
      } else {
        last = 0;
      }
    };

    const wake = () => {
      if (document.hidden) return;
      lastActivity = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
    };
    wakeRef.current = () => {
      hideCursor();
      wake();
    };

    const insideScope = (x: number, y: number, element?: Element | null): boolean => {
      const scope = scopeOf();
      if (!scope) return true;
      if (element instanceof Element && scope.contains(element)) return true;
      const box = scope.getBoundingClientRect();
      return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    };

    let releaseLock = false;

    const markSuppressed = (x: number, y: number) => {
      const hoverTarget = document.elementFromPoint(x, y);
      const hideTargetCursor = hoverTarget instanceof Element && Boolean(hoverTarget.closest('[data-hide-target-cursor]'));
      if (hideTargetCursor) root.setAttribute('data-suppressed', 'true');
      else root.removeAttribute('data-suppressed');
      return hoverTarget;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      markSuppressed(pointer.x, pointer.y);
      const inside = insideScope(pointer.x, pointer.y, event.target as Element | null);
      pointer.inside = inside;
      hideCursor();
      if (releaseLock) {
        releaseLock = false;
        lockOn(null);
        wake();
        return;
      }
      lockOn(inside ? findTarget(pointer.x, pointer.y, event.target as Element | null) : null);
      wake();
    };

    const refreshHover = () => {
      if (!pointer.inside) return;
      const hoverTarget = markSuppressed(pointer.x, pointer.y);
      hideCursor();
      lockOn(findTarget(pointer.x, pointer.y, hoverTarget));
      wake();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      pointer.pressed = true;
      wake();
    };

    const onPointerUp = () => {
      pointer.pressed = false;
      releaseLock = true;
      lockOn(null);
      wake();
    };

    const onLeave = () => {
      pointer.inside = false;
      pointer.pressed = false;
      root.removeAttribute('data-suppressed');
      lockOn(null);
      hideCursor();
      wake();
    };

    const onTouchStart = onLeave;

    const onResize = () => {
      viewportScale = getViewportScale();
      if (pointer.inside) lockOn(findTarget(pointer.x, pointer.y));
      wake();
    };

    let scrollTimeout: number | undefined;
    const onScroll = () => {
      if (!pointer.inside) return;
      wake();
      if (typeof window !== 'undefined') {
        window.clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(() => {
          if (pointer.inside) {
            lockOn(findTarget(pointer.x, pointer.y));
            wake();
          }
        }, 80);
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      } else {
        refreshHover();
        wake();
      }
    };

    let refreshQueued = false;
    const scheduleRefresh = () => {
      if (refreshQueued || !pointer.inside) return;
      refreshQueued = true;
      requestAnimationFrame(() => {
        refreshQueued = false;
        refreshHover();
      });
    };
    const domObserver = new MutationObserver(scheduleRefresh);
    domObserver.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.documentElement.addEventListener('pointerenter', onPointerMove);
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('sonify-map-move', onScroll);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (typeof window !== 'undefined') {
        window.clearTimeout(scrollTimeout);
      }
      cancelAnimationFrame(raf);
      targetObserver.disconnect();
      wakeRef.current = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('scroll', onScroll, { capture: true });
      domObserver.disconnect();
      document.documentElement.removeEventListener('pointerenter', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('sonify-map-move', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      lastScope?.removeAttribute('data-target-cursor-scope');
      style.remove();
    };
  }, [host]);

  useEffect(() => {
    wakeRef.current?.();
  });

  if (!host) return null;

  return createPortal(
    <div
      ref={rootRef}
      className="target-cursor"
      style={{ mixBlendMode: blendMode, opacity: 0 }}
      aria-hidden="true"
    >
      {CORNER_ANGLES.map((angle, i) => (
        <span
          key={angle}
          ref={element => {
            cornerRefs.current[i] = element;
          }}
          className="target-cursor__corner"
        />
      ))}
      <span ref={dotRef} className="target-cursor__dot" />
      <span ref={labelRef} className="target-cursor__label" />
    </div>,
    host
  );
};

export default TargetCursor;
