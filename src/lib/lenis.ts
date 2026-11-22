import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { scrollIsResting } from "@/lib/scrollRest";

let globalLenis: Lenis | null = null;
let tickerFn: ((time: number) => void) | null = null;
let parked = false;
let restingFrames = 0;
let wakeScroll: (() => void) | null = null;
const REST_FRAMES = 12;

function getLenisConfig(isMobile: boolean) {
  if (isMobile) {
    return { duration: 0.8, lerp: 0.075, touchMultiplier: 1.5 };
  }
  return { duration: 1.2, lerp: 0.1, touchMultiplier: 2 };
}

export function getGlobalLenis(): Lenis | null {
  return globalLenis;
}

export function initGlobalLenis(options?: { readonly syncTouch?: boolean }): Lenis {
  if (globalLenis) return globalLenis;

  gsap.registerPlugin(ScrollTrigger);
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 1000;
  const cfg = getLenisConfig(isMobile);
  const lenis = new Lenis({
    duration: cfg.duration,
    lerp: cfg.lerp,
    smoothWheel: true,
    syncTouch: options?.syncTouch ?? false,
    touchMultiplier: cfg.touchMultiplier,
  });

  globalLenis = lenis;
  if (typeof window !== "undefined") {
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
  }

  lenis.on("scroll", ScrollTrigger.update);
  tickerFn = (time: number) => {
    lenis.raf(time * 1000);
    if (scrollIsResting(lenis.velocity, lenis.isScrolling)) {
      restingFrames += 1;
      if (restingFrames >= REST_FRAMES) parkScrollTicker();
    } else {
      restingFrames = 0;
    }
  };
  gsap.ticker.add(tickerFn);
  gsap.ticker.lagSmoothing(0);
  wakeScroll = () => wakeScrollTicker();
  window.addEventListener("wheel", wakeScroll, { passive: true, capture: true });
  window.addEventListener("touchstart", wakeScroll, { passive: true, capture: true });
  window.addEventListener("pointerdown", wakeScroll, { passive: true, capture: true });
  window.addEventListener("keydown", wakeScroll);
  window.addEventListener("scroll", wakeScroll, { passive: true });

  return lenis;
}

function parkScrollTicker(): void {
  if (!tickerFn || parked) return;
  gsap.ticker.remove(tickerFn);
  parked = true;
}

function wakeScrollTicker(): void {
  restingFrames = 0;
  if (!globalLenis || !tickerFn || !parked) return;
  parked = false;
  gsap.ticker.add(tickerFn);
  globalLenis.raf(performance.now());
}

export function destroyGlobalLenis(): void {
  if (!globalLenis) return;
  if (wakeScroll) {
    window.removeEventListener("wheel", wakeScroll, { capture: true });
    window.removeEventListener("touchstart", wakeScroll, { capture: true });
    window.removeEventListener("pointerdown", wakeScroll, { capture: true });
    window.removeEventListener("keydown", wakeScroll);
    window.removeEventListener("scroll", wakeScroll);
    wakeScroll = null;
  }
  if (tickerFn) {
    gsap.ticker.remove(tickerFn);
    tickerFn = null;
  }
  parked = false;
  restingFrames = 0;
  if (typeof window !== "undefined") {
    delete (window as unknown as { __lenis?: Lenis }).__lenis;
  }
  globalLenis.destroy();
  globalLenis = null;
}

/** Shared Lenis instance for compatibility with individual component hooks */
export function createLenisInstance(options?: { readonly syncTouch?: boolean }): {
  lenis: Lenis;
  destroyLenis: () => void;
} {
  const lenis = initGlobalLenis(options);
  return {
    lenis,
    destroyLenis: () => {
      // Managed globally by layout SmoothScroll
    },
  };
}
