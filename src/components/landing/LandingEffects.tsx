"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { INTRO_COPY, SPLIT_ROWS_MOTION, type SplitRowMotion } from "@/data/landingData";
import { createLenisInstance } from "@/lib/lenis";

const GRID_BLOCK_SIZE = 60;
const GRID_HIGHLIGHT_DURATION = 300;

interface GridCell {
  el: HTMLDivElement;
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  until: number;
}

function populateGridCells(container: HTMLDivElement): GridCell[] {
  container.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const cells: GridCell[] = [];
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cols = Math.ceil(w / GRID_BLOCK_SIZE);
  const rows = Math.ceil(h / GRID_BLOCK_SIZE);
  const ox = (w - cols * GRID_BLOCK_SIZE) / 2;
  const oy = (h - rows * GRID_BLOCK_SIZE) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = c * GRID_BLOCK_SIZE + ox;
      const py = r * GRID_BLOCK_SIZE + oy;
      const el = document.createElement("div");
      el.className = "sonify-grid-block";
      el.style.width = `${GRID_BLOCK_SIZE}px`;
      el.style.height = `${GRID_BLOCK_SIZE}px`;
      el.style.left = `${px}px`;
      el.style.top = `${py}px`;
      fragment.appendChild(el);
      cells.push({ el, x: px + 30, y: py + 30, gridX: c, gridY: r, until: 0 });
    }
  }
  container.appendChild(fragment);
  return cells;
}

function getCryptoRandomIndex(length: number): number {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues && length > 0) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] % length;
  }
  return 0;
}

function highlightNearestCell(cells: GridCell[], clientX: number, clientY: number): void {
  let best: GridCell | null = null;
  let bestDist = GRID_BLOCK_SIZE * 2;
  for (const cell of cells) {
    const d = Math.hypot(clientX - cell.x, clientY - cell.y);
    if (d < bestDist) {
      bestDist = d;
      best = cell;
    }
  }
  if (!best) return;

  const now = Date.now();
  best.el.classList.add("highlight");
  best.until = now + GRID_HIGHLIGHT_DURATION;

  // Orbit Matter cluster highlight
  const neighbors = cells.filter(
    (n) => n !== best && Math.abs(n.gridX - best!.gridX) <= 1 && Math.abs(n.gridY - best!.gridY) <= 1
  );
  if (neighbors.length > 0) {
    const randomNeighbor = neighbors[getCryptoRandomIndex(neighbors.length)];
    randomNeighbor.el.classList.add("highlight");
    randomNeighbor.until = now + GRID_HIGHLIGHT_DURATION + 10;
  }
}

function setupInteractiveGrid(container: HTMLDivElement): () => void {
  // Mobile / touch devices do not have cursor hover; skip creating hundreds of DOM cells
  if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) {
    return () => {};
  }

  let cells: GridCell[] = [];
  let rafId = 0;
  let cancelled = false;

  const tick = () => {
    const now = Date.now();
    let hasActive = false;
    for (const cell of cells) {
      if (cell.until > 0) {
        if (now > cell.until) {
          cell.el.classList.remove("highlight");
          cell.until = 0;
        } else {
          hasActive = true;
        }
      }
    }
    if (hasActive) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = 0;
    }
  };

  const onResize = () => {
    if (cancelled) return;
    cells = populateGridCells(container);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (cells.length === 0) return;
    highlightNearestCell(cells, e.clientX, e.clientY);
    if (!rafId) {
      rafId = requestAnimationFrame(tick);
    }
  };

  const init = () => {
    if (cancelled) return;
    cells = populateGridCells(container);
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);
  };

  // Defer DOM generation to idle time so initial hydration and LCP are unblocked
  const idleId = typeof window !== "undefined" && "requestIdleCallback" in window
    ? window.requestIdleCallback(init, { timeout: 1000 })
    : setTimeout(init, 100);

  return () => {
    cancelled = true;
    if (typeof window !== "undefined" && "cancelIdleCallback" in window && typeof idleId === "number") {
      window.cancelIdleCallback(idleId);
    } else {
      clearTimeout(idleId);
    }
    window.removeEventListener("resize", onResize);
    window.removeEventListener("mousemove", onMouseMove);
    if (rafId) cancelAnimationFrame(rafId);
  };
}

function setupIntroCharScrub(): ScrollTrigger | null {
  const bodySpan = document.querySelector<HTMLElement>(".sonify-intro-body");
  const copyEl = document.querySelector<HTMLElement>(".sonify-intro-copy");
  if (!bodySpan || !copyEl) return null;

  bodySpan.innerHTML = "";
  const charEls: HTMLSpanElement[] = [];

  for (const ch of INTRO_COPY.body) {
    const s = document.createElement("span");
    s.textContent = ch;
    s.style.color = "rgba(242,242,240,0.22)";
    bodySpan.appendChild(s);
    charEls.push(s);
  }

  return ScrollTrigger.create({
    trigger: copyEl,
    start: "top 75%",
    end: "bottom 30%",
    onUpdate: (self) => {
      if (window.scrollY < 10) return;
      const litCount = Math.floor(self.progress * charEls.length);
      charEls.forEach((el, idx) => {
        el.style.color = idx < litCount ? "#f2f2f0" : "rgba(242,242,240,0.22)";
      });
    },
  });
}

function applyRowSplitTransform(row: HTMLElement, motion: SplitRowMotion, p: number): void {
  const left = row.querySelector<HTMLElement>(".sonify-cta-card-left");
  const right = row.querySelector<HTMLElement>(".sonify-cta-card-right");
  if (left) {
    left.style.transform = `translate3d(${p * motion.leftX}px, ${p * motion.y}px, 0) rotate(${
      p * motion.leftRotate
    }deg)`;
  }
  if (right) {
    right.style.transform = `translate3d(${p * motion.rightX}px, ${p * motion.y}px, 0) rotate(${
      p * motion.rightRotate
    }deg)`;
  }
}

function setupSplitCtaScrub(): () => void {
  const section = document.querySelector<HTMLElement>(".sonify-split-cta");
  if (!section) return () => {};

  const rows = Array.from(section.querySelectorAll<HTMLElement>(".sonify-cta-row"));
  const center = section.querySelector<HTMLElement>(".sonify-cta-centre");
  const logo = section.querySelector<HTMLElement>(".sonify-cta-logo");

  const cardTrigger = ScrollTrigger.create({
    trigger: section,
    start: "top center",
    end: "150% bottom",
    scrub: true,
    onUpdate: (self) => {
      rows.forEach((row, index) => {
        const motion = SPLIT_ROWS_MOTION[index];
        if (motion) applyRowSplitTransform(row, motion, self.progress);
      });
    },
  });

  const centerTween = center
    ? gsap.fromTo(
        center,
        { autoAlpha: 0, pointerEvents: "none" },
        {
          autoAlpha: 1,
          pointerEvents: "auto",
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top center",
            end: "center center",
            scrub: true,
          },
        }
      )
    : null;

  const logoTween = logo
    ? gsap.fromTo(
        logo,
        { scale: 0.7, autoAlpha: 0 },
        {
          scale: 1,
          autoAlpha: 1,
          duration: 0.5,
          ease: "power2.out",
          scrollTrigger: {
            trigger: section,
            start: "top 30%",
            toggleActions: "play reverse play reverse",
          },
        }
      )
    : null;

  return () => {
    cardTrigger.kill();
    centerTween?.scrollTrigger?.kill();
    centerTween?.kill();
    logoTween?.scrollTrigger?.kill();
    logoTween?.kill();
  };
}

function useGridAndSmoothScroll(setupExtraMotion: () => () => void) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const setupRef = useRef(setupExtraMotion);
  setupRef.current = setupExtraMotion;

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cleanupGrid = gridRef.current ? setupInteractiveGrid(gridRef.current) : () => {};
    const { destroyLenis } = createLenisInstance();
    const cleanupExtra = setupRef.current();

    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        ScrollTrigger.refresh();
      });
    }

    return () => {
      cleanupGrid();
      cleanupExtra();
      destroyLenis();
    };
  }, []);

  return gridRef;
}

function setupChaptersMotion(): () => void {
  const block = document.querySelector<HTMLElement>(".sonify-chapters-block");
  const section = document.querySelector<HTMLElement>(".sonify-chapters-section");
  if (!block || !section) return () => {};

  // 1. Slide reveal animation for the 2 big words lines (Orbit Matter initSlideAnimation)
  const lines = block.querySelectorAll<HTMLElement>(".sonify-chapter-line-inner");
  const slideTween =
    lines.length > 0
      ? gsap.fromTo(
          lines,
          { yPercent: 100 },
          {
            yPercent: 0,
            duration: 0.85,
            ease: "power3.out",
            stagger: 0.12,
            scrollTrigger: {
              trigger: block,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        )
      : null;

  // 2. Card entrance animation: Each card rises 50px and fades in (Figma dev notes 35:254)
  const cards = section.querySelectorAll<HTMLElement>(".sonify-teaser-card");
  const cardTriggers: ScrollTrigger[] = [];
  cards.forEach((card) => {
    const cardTween = gsap.fromTo(
      card,
      { y: 50, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: card,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      }
    );
    if (cardTween.scrollTrigger) cardTriggers.push(cardTween.scrollTrigger);
  });

  return () => {
    slideTween?.scrollTrigger?.kill();
    slideTween?.kill();
    cardTriggers.forEach((st) => st.kill());
  };
}

function setupLandingMotion(): () => void {
  const mm = gsap.matchMedia();

  // Scroll animations across all viewports: mobile, tablet, desktop
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    const t1 = setupIntroCharScrub();
    const killChapters = setupChaptersMotion();
    ScrollTrigger.refresh();
    return () => {
      t1?.kill();
      killChapters();
    };
  });

  // Desktop-specific layouts (split CTA card spread)
  mm.add("(min-width: 1000px) and (prefers-reduced-motion: no-preference)", () => {
    const killSplit = setupSplitCtaScrub();
    ScrollTrigger.refresh();
    return () => {
      killSplit();
    };
  });

  return () => mm.revert();
}

export function LandingEffects() {
  const gridRef = useGridAndSmoothScroll(setupLandingMotion);
  return <div ref={gridRef} className="sonify-interactive-grid" aria-hidden="true" />;
}
