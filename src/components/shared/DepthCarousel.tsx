"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import gsap from "gsap";
import "./DepthCarousel.css";

export interface DepthCarouselItem {
  readonly image?: string;
  readonly alt?: string;
  readonly id?: string;
  readonly content?: ReactNode;
  readonly render?: (
    item: DepthCarouselItem,
    index: number,
    isActive: boolean
  ) => ReactNode;
  readonly [key: string]: unknown;
}

export type DepthCarouselInputItem = string | DepthCarouselItem;

export interface DepthCarouselProps {
  readonly items?: readonly DepthCarouselInputItem[];
  readonly cardWidth?: number;
  readonly cardHeight?: number;
  readonly radius?: number;
  readonly tint?: string;
  readonly depth?: number;
  readonly spread?: number;
  readonly tilt?: number;
  readonly tiltDirection?: "left" | "right";
  readonly perspective?: number;
  readonly visibleCards?: number;
  readonly falloff?: number;
  readonly blur?: number;
  readonly duration?: number;
  readonly ease?: string;
  readonly autoplay?: boolean;
  readonly autoplayDelay?: number;
  readonly loop?: boolean;
  readonly showControls?: boolean;
  readonly showIndicators?: boolean;
  readonly onChange?: (index: number, item: DepthCarouselItem) => void;
  readonly className?: string;
}

const DEFAULT_ITEMS: readonly DepthCarouselItem[] = [
  { image: "https://picsum.photos/seed/depth1/800/1000", alt: "Slide 1" },
  { image: "https://picsum.photos/seed/depth2/800/1000", alt: "Slide 2" },
  { image: "https://picsum.photos/seed/depth3/800/1000", alt: "Slide 3" },
  { image: "https://picsum.photos/seed/depth4/800/1000", alt: "Slide 4" },
  { image: "https://picsum.photos/seed/depth5/800/1000", alt: "Slide 5" },
  { image: "https://picsum.photos/seed/depth6/800/1000", alt: "Slide 6" },
];

const clamp = (v: number, min: number, max: number): number =>
  Math.min(Math.max(v, min), max);

const normalizeItem = (it: DepthCarouselInputItem): DepthCarouselItem =>
  typeof it === "string" ? { image: it, alt: "" } : it;

interface DragState {
  readonly x: number;
  readonly y: number;
  readonly startPos: number;
  lastX: number;
  lastT: number;
  v: number;
  moved: boolean;
  isScrolling: boolean;
  readonly id: number;
}

interface CardLayoutCfg {
  readonly count: number;
  readonly depth: number;
  readonly spread: number;
  readonly tilt: number;
  readonly tiltDirection: "left" | "right";
  readonly visibleCards: number;
  readonly falloff: number;
  readonly blur: number;
  readonly loop: boolean;
}

function calculateCardDelta(
  index: number,
  pos: number,
  n: number,
  loop: boolean
): number {
  let d = index - pos;
  if (loop && n > 1) {
    d = ((d % n) + n) % n;
    if (d > n / 2) d -= n;
  }
  return d;
}

function applyCardLayout(
  el: HTMLElement,
  ov: HTMLElement | null,
  d: number,
  cfg: CardLayoutCfg,
  scale: number,
  reduced: boolean
): void {
  const dir = cfg.tiltDirection === "left" ? -1 : 1;
  const back = Math.max(0, d);
  const shown = Math.abs(d) <= cfg.visibleCards + 0.5;

  const tz = -cfg.depth * d;
  const tx = dir * cfg.spread * d;
  const ry = dir * cfg.tilt * clamp(d, 0, 1);

  const opacity = !shown ? 0 : d < 0 ? Math.max(0, 1 + d) : 1;
  const brightness = Math.max(0.65, 1 - back * (cfg.falloff * 0.7));
  const blurPx =
    cfg.blur > 0
      ? Math.min(cfg.blur, (back / Math.max(1, cfg.visibleCards)) * cfg.blur)
      : 0;
  const zi = Math.round(2000 - d * 20);

  el.style.transform = `translate3d(-50%, -50%, 0) scale(${scale}) translate3d(${tx.toFixed(2)}px, 0, ${tz.toFixed(2)}px) rotateY(${ry.toFixed(3)}deg)`;
  el.style.opacity = opacity.toFixed(3);
  el.style.filter =
    !reduced && blurPx >= 0.5
      ? `brightness(${brightness.toFixed(3)}) blur(${blurPx.toFixed(1)}px)`
      : brightness < 0.99
      ? `brightness(${brightness.toFixed(3)})`
      : "none";
  el.style.zIndex = String(zi);
  el.style.pointerEvents = shown && opacity > 0.05 ? "auto" : "none";

  if (ov) {
    ov.style.opacity = clamp(back * cfg.falloff * 0.65, 0, 0.4).toFixed(3);
  }
}

interface DepthCardViewProps {
  readonly item: DepthCarouselItem;
  readonly index: number;
  readonly count: number;
  readonly isActive: boolean;
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly radius: number;
  readonly tint: string;
  readonly onCardRef: (el: HTMLDivElement | null) => void;
  readonly onOverlayRef: (el: HTMLSpanElement | null) => void;
  readonly onClick: (index: number) => void;
}

function DepthCardView({
  item,
  index,
  count,
  isActive,
  cardWidth,
  cardHeight,
  radius,
  tint,
  onCardRef,
  onOverlayRef,
  onClick,
}: Readonly<DepthCardViewProps>) {
  const isCustom = Boolean(item.render || item.content);

  return (
    <div
      key={item.id ?? index}
      className="depth-carousel__card"
      ref={onCardRef}
      style={{
        width: cardWidth,
        height: cardHeight,
        borderRadius: isCustom ? undefined : radius,
      }}
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${count}`}
      aria-hidden={!isActive}
      onClick={() => onClick(index)}
    >
      {item.render ? (
        item.render(item, index, isActive)
      ) : item.content ? (
        item.content
      ) : item.image ? (
        <img
          className="depth-carousel__img"
          src={item.image}
          alt={item.alt || ""}
          draggable={false}
        />
      ) : null}
      {!isCustom && (
        <span
          className="depth-carousel__tint"
          ref={onOverlayRef}
          style={{ background: tint }}
        />
      )}
    </div>
  );
}

function DepthControls({
  onNavigate,
}: Readonly<{ onNavigate: (step: number) => void }>) {
  return (
    <>
      <button
        type="button"
        className="depth-carousel__arrow depth-carousel__arrow--prev"
        aria-label="Previous slide"
        onClick={() => onNavigate(-1)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M15 5l-7 7 7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        className="depth-carousel__arrow depth-carousel__arrow--next"
        aria-label="Next slide"
        onClick={() => onNavigate(1)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M9 5l7 7-7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </>
  );
}

function DepthIndicators({
  count,
  active,
  onSelect,
}: Readonly<{
  count: number;
  active: number;
  onSelect: (index: number) => void;
}>) {
  return (
    <div className="depth-carousel__dots" role="tablist" aria-label="Slides">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={active === i}
          aria-label={`Go to slide ${i + 1}`}
          className={`depth-carousel__dot${active === i ? " is-active" : ""}`}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  );
}

function updatePointerDrag(
  e: React.PointerEvent<HTMLDivElement>,
  drag: DragState,
  cardWidth: number,
  scale: number,
  rootEl: HTMLDivElement | null
): number | null {
  if (drag.isScrolling) return null;

  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;

  if (!drag.moved) {
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 7) {
      drag.isScrolling = true;
      return null;
    }
    if (Math.abs(dx) > 6) {
      drag.moved = true;
      rootEl?.setPointerCapture(drag.id);
    }
  }

  if (!drag.moved) return null;
  const stepPx = Math.max(cardWidth * 0.55 * scale, 40);
  const now = performance.now();
  const dt = Math.max(now - drag.lastT, 1);
  drag.v = (e.clientX - drag.lastX) / dt;
  drag.lastX = e.clientX;
  drag.lastT = now;
  return drag.startPos - dx / stepPx;
}

export default function DepthCarousel({
  items = DEFAULT_ITEMS,
  cardWidth = 300,
  cardHeight = 380,
  radius = 18,
  tint = "#141414",
  depth = 220,
  spread = 90,
  tilt = 22,
  tiltDirection = "right",
  perspective = 1400,
  visibleCards = 4,
  falloff = 0.2,
  blur = 6,
  duration = 700,
  ease = "power3.out",
  autoplay = false,
  autoplayDelay = 3200,
  loop = true,
  showControls = true,
  showIndicators = true,
  onChange,
  className = "",
}: DepthCarouselProps) {
  const data = useMemo(
    () => (Array.isArray(items) ? items : []).map(normalizeItem),
    [items]
  );
  const count = data.length;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const overlayRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const posRef = useRef(0);
  const focusRef = useRef(0);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const scaleRef = useRef(1);
  const onChangeRef = useRef(onChange);
  const dragRef = useRef<DragState | null>(null);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTimerRef = useRef<number | null>(null);
  const reducedRef = useRef(false);

  const [active, setActive] = useState(0);

  onChangeRef.current = onChange;

  const cfg: CardLayoutCfg = useMemo(
    () => ({
      count,
      depth,
      spread,
      tilt,
      tiltDirection,
      visibleCards,
      falloff,
      blur,
      loop,
    }),
    [
      count,
      depth,
      spread,
      tilt,
      tiltDirection,
      visibleCards,
      falloff,
      blur,
      loop,
    ]
  );

  const layout = useCallback(
    (pos: number) => {
      const n = cfg.count;
      if (!n) return;
      const sc = scaleRef.current;
      for (let i = 0; i < n; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const d = calculateCardDelta(i, pos, n, cfg.loop);
        applyCardLayout(
          el,
          overlayRefs.current[i],
          d,
          cfg,
          sc,
          reducedRef.current
        );
      }
    },
    [cfg]
  );

  const notify = useCallback(
    (idx: number) => {
      setActive(idx);
      onChangeRef.current?.(idx, data[idx]);
    },
    [data]
  );

  const tweenTo = useCallback(
    (target: number, animate: boolean) => {
      tweenRef.current?.kill();
      const proxy = { p: posRef.current };
      const dur = animate && !reducedRef.current ? duration / 1000 : 0;
      tweenRef.current = gsap.to(proxy, {
        p: target,
        duration: dur,
        ease,
        onUpdate: () => {
          posRef.current = proxy.p;
          layout(proxy.p);
        },
        onComplete: () => {
          const n = count;
          if (n > 0) posRef.current = ((posRef.current % n) + n) % n;
          layout(posRef.current);
        },
      });
    },
    [duration, ease, count, layout]
  );

  const setFocus = useCallback(
    (rawIndex: number, animate = true) => {
      if (!count) return;
      const idx = loop
        ? ((rawIndex % count) + count) % count
        : clamp(rawIndex, 0, count - 1);
      let delta = idx - posRef.current;
      if (loop && count > 1) {
        delta = ((delta % count) + count) % count;
        if (delta > count / 2) delta -= count;
      }
      tweenTo(posRef.current + delta, animate);
      if (idx !== focusRef.current) {
        focusRef.current = idx;
        notify(idx);
      }
    },
    [count, loop, tweenTo, notify]
  );

  const navigateBy = useCallback(
    (step: number) => setFocus(focusRef.current + step, true),
    [setFocus]
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      const targetWidth = clamp(w * 0.85, 290, 360);
      scaleRef.current = clamp(targetWidth / cardWidth, 0.85, 1.18);
      layout(posRef.current);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, [cardWidth, layout]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (count < 2) return;
      e.preventDefault();
      tweenRef.current?.kill();
      const raw =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const delta = e.deltaMode === 1 ? raw * 24 : raw;
      const step = clamp(delta / (cardWidth * 0.9), -0.6, 0.6);
      posRef.current += step;
      layout(posRef.current);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(
        () => setFocus(Math.round(posRef.current), true),
        130
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    };
  }, [count, cardWidth, layout, setFocus]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (count < 2) return;
    tweenRef.current?.kill();
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPos: posRef.current,
      lastX: e.clientX,
      lastT: performance.now(),
      v: 0,
      moved: false,
      isScrolling: false,
      id: e.pointerId,
    };
  }, [count]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const nextPos = updatePointerDrag(
        e,
        drag,
        cardWidth,
        scaleRef.current,
        rootRef.current
      );
      if (nextPos !== null) {
        posRef.current = nextPos;
        layout(nextPos);
      }
    },
    [cardWidth, layout]
  );

  const onPointerEnd = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.id !== undefined && rootRef.current?.hasPointerCapture(drag.id)) {
      try {
        rootRef.current.releasePointerCapture(drag.id);
      } catch {
        // Ignored
      }
    }
    dragRef.current = null;
    if (!drag.moved) return;
    const stepPx = Math.max(cardWidth * 0.55 * scaleRef.current, 40);
    const projected = posRef.current - (drag.v * 180) / stepPx;
    setFocus(Math.round(projected), true);
  }, [cardWidth, setFocus]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateBy(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateBy(1);
      }
    },
    [navigateBy]
  );

  const onCardClick = useCallback(
    (index: number) => {
      if (dragRef.current?.moved) return;
      setFocus(index, true);
      onChangeRef.current?.(index, data[index]);
    },
    [setFocus, data]
  );

  useEffect(() => {
    reducedRef.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!autoplay || reducedRef.current || count < 2) return;
    const root = rootRef.current;
    let hovered = false;
    let focused = false;
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    if (root) observer.observe(root);
    const stop = () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    };
    const start = () => {
      stop();
      autoTimerRef.current = window.setInterval(() => {
        if (!hovered && !focused && visible && !document.hidden) navigateBy(1);
      }, Math.max(autoplayDelay, 600));
    };
    const onEnter = () => {
      hovered = true;
    };
    const onLeave = () => {
      hovered = false;
    };
    const onFocusIn = () => {
      focused = true;
    };
    const onFocusOut = () => {
      focused = false;
    };
    root?.addEventListener("mouseenter", onEnter);
    root?.addEventListener("mouseleave", onLeave);
    root?.addEventListener("focusin", onFocusIn);
    root?.addEventListener("focusout", onFocusOut);
    start();
    return () => {
      stop();
      observer.disconnect();
      root?.removeEventListener("mouseenter", onEnter);
      root?.removeEventListener("mouseleave", onLeave);
      root?.removeEventListener("focusin", onFocusIn);
      root?.removeEventListener("focusout", onFocusOut);
    };
  }, [autoplay, autoplayDelay, count, navigateBy]);

  useEffect(() => {
    layout(posRef.current);
  }, [layout]);

  useEffect(
    () => () => {
      tweenRef.current?.kill();
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    },
    []
  );

  return (
    <div
      ref={rootRef}
      className={`depth-carousel ${className}`.trim()}
      style={
        {
          "--dc-perspective": `${perspective}px`,
        } as React.CSSProperties
      }
      role="group"
      aria-roledescription="carousel"
      aria-label="Depth carousel"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
    >
      <div className="depth-carousel__stage" ref={stageRef}>
        {data.map((item, i) => (
          <DepthCardView
            key={item.id ?? i}
            item={item}
            index={i}
            count={count}
            isActive={active === i}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            radius={radius}
            tint={tint}
            onCardRef={(el) => {
              cardRefs.current[i] = el;
            }}
            onOverlayRef={(el) => {
              overlayRefs.current[i] = el;
            }}
            onClick={onCardClick}
          />
        ))}
      </div>

      {showControls && count > 1 && (
        <DepthControls onNavigate={navigateBy} />
      )}

      {showIndicators && count > 1 && (
        <DepthIndicators
          count={count}
          active={active}
          onSelect={(i) => setFocus(i, true)}
        />
      )}
    </div>
  );
}
