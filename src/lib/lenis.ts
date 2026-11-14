import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

let globalLenis: Lenis | null = null;
let tickerFn: ((time: number) => void) | null = null;

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
    syncTouch: options?.syncTouch ?? true,
    touchMultiplier: cfg.touchMultiplier,
  });

  globalLenis = lenis;
  if (typeof window !== "undefined") {
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
  }

  lenis.on("scroll", ScrollTrigger.update);
  tickerFn = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tickerFn);
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

export function destroyGlobalLenis(): void {
  if (!globalLenis) return;
  if (tickerFn) {
    gsap.ticker.remove(tickerFn);
    tickerFn = null;
  }
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
