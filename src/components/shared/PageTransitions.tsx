"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import { canWarmAssets } from "@/lib/assetCache";
import { waitForFirstView, warmRouteAssets } from "@/lib/routeAssets";
import "./PageTransitions.css";

const APP_ROUTE_PATHS = new Set([
  "/",
  "/listen",
  "/listen/classic",
  "/about",
  "/story",
  "/challenge",
  "/challenge/guess",
  "/challenge/compose",
  "/challenge/match",
  "/challenge/ribbons",
  "/challenge/ribbon",
  "/play",
  "/play/guess",
  "/play/compose",
  "/play/match",
  "/play/ribbons",
  "/challenges",
  "/challenges/guess",
  "/challenges/compose",
  "/challenges/match",
  "/challenges/ribbons",
  "/credit",
  "/credits",
]);

/** Warmed on intent, and left on the normal link click. Contact stays out of the tile transition. */
const WARM_ONLY_PATHS = new Set(["/contact"]);

type ActiveNavigation = {
  from: string;
  href: string;
  pushed: boolean;
  covered: boolean;
  revealing: boolean;
  keyboard: boolean;
  controller: AbortController;
};

/** Orbit Matter's grid-cover motif, adapted to persistent Next.js navigation. */
export function PageTransitions() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef<() => void>(() => {});
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const router = useRouter();

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const prefetched = new Map<string, number>();
    let animation: gsap.core.Tween | undefined;
    let intentTimer: ReturnType<typeof setTimeout> | undefined;
    let safetyTimer: ReturnType<typeof setTimeout> | undefined;
    let active: ActiveNavigation | null = null;

    const normalizedPathname = (pathname: string) => pathname.replace(/\/+$/, "") || "/";

    const destination = (target: EventTarget | null) => {
      const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self") || anchor.dataset.noTransition !== undefined) return null;
      const url = new URL(anchor.href, location.href);
      const pathname = normalizedPathname(url.pathname);
      if (url.origin !== location.origin || !/^https?:$/.test(url.protocol) || pathname === normalizedPathname(location.pathname)) return null;
      if (!APP_ROUTE_PATHS.has(pathname) && !WARM_ONLY_PATHS.has(pathname)) return null;
      return url;
    };
    const warm = (url: URL) => {
      if (document.documentElement.dataset.lite === "on") return;
      if (!canWarmAssets()) return;
      const href = url.pathname + url.search;
      if (Date.now() - (prefetched.get(href) ?? 0) > 30_000) {
        prefetched.set(href, Date.now());
        if (prefetched.size > 16) prefetched.delete(prefetched.keys().next().value!);
        router.prefetch(href);
      }
      void warmRouteAssets(url.pathname);
    };
    const createTiles = () => {
      const size = 60;
      const columns = Math.ceil(innerWidth / size);
      const rows = Math.ceil(innerHeight / size) + 1;
      const offsetX = (innerWidth - columns * size) / 2;
      const offsetY = (innerHeight - rows * size) / 2;
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < columns * rows; index++) {
        const tile = document.createElement("span");
        tile.setAttribute("aria-hidden", "true");
        tile.style.width = `${size}px`;
        tile.style.height = `${size}px`;
        tile.style.left = `${(index % columns) * size + offsetX}px`;
        tile.style.top = `${Math.floor(index / columns) * size + offsetY}px`;
        fragment.appendChild(tile);
      }
      return fragment;
    };
    const reset = () => {
      active?.controller.abort();
      active = null;
      clearTimeout(safetyTimer);
      animation?.kill();
      overlay.hidden = true;
      overlay.dataset.state = "idle";
      overlay.replaceChildren();
      delete document.documentElement.dataset.sonifyNavigating;
    };
    const reveal = async () => {
      const navigation = active;
      if (!navigation?.pushed || !navigation.covered || navigation.revealing) return;
      navigation.revealing = true;
      clearTimeout(safetyTimer);
      safetyTimer = undefined;
      await waitForFirstView(pathnameRef.current, navigation.controller.signal);
      if (active !== navigation) return;
      overlay.dataset.state = "revealing";
      animation = gsap.to(overlay.children, {
        opacity: 0,
        delay: 0.3,
        duration: 0.05,
        ease: "power2.inOut",
        stagger: { amount: 0.5, each: 0.01, from: "random" },
        onComplete: () => {
          reset();
          if (navigation.keyboard) document.querySelector<HTMLElement>("main")?.focus({ preventScroll: true });
          window.dispatchEvent(new Event("sonify-page-revealed"));
        },
      });
    };
    committedRef.current = () => {
      if (active && pathnameRef.current !== active.from) void reveal();
    };
    const onIntent = (event: Event) => {
      const url = destination(event.target);
      if (!url) return;
      clearTimeout(intentTimer);
      intentTimer = setTimeout(() => warm(url), event.type === "pointerover" ? 100 : 0);
    };
    const cancelIntent = () => clearTimeout(intentTimer);
    const onPopState = () => {
      const url = new URL(location.href);
      const pathname = normalizedPathname(url.pathname);
      if (motion.matches || !APP_ROUTE_PATHS.has(pathname) || pathname === normalizedPathname(pathnameRef.current)) {
        reset();
        return;
      }

      reset();
      const navigation: ActiveNavigation = {
        from: pathnameRef.current,
        href: url.pathname + url.search + url.hash,
        pushed: true,
        covered: false,
        revealing: false,
        keyboard: false,
        controller: new AbortController(),
      };
      active = navigation;
      document.documentElement.dataset.sonifyNavigating = "1";
      overlay.replaceChildren(createTiles());
      overlay.hidden = false;
      overlay.dataset.state = "covering";
      safetyTimer = setTimeout(reset, 8_000);
      animation = gsap.fromTo(overlay.children, { opacity: 0 }, {
        opacity: 1,
        duration: 0.05,
        ease: "power2.inOut",
        stagger: { amount: 0.5, each: 0.01, from: "random" },
        onComplete: () => {
          if (active !== navigation) return;
          navigation.covered = true;
          overlay.dataset.state = "loading";
          if (pathnameRef.current !== navigation.from) void reveal();
        },
      });
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = destination(event.target);
      if (!url) return;
      warm(url);
      if (!APP_ROUTE_PATHS.has(normalizedPathname(url.pathname))) return;
      if (motion.matches) return;
      event.preventDefault();
      if (active) return;
      const navigation: ActiveNavigation = { from: pathnameRef.current, href: url.pathname + url.search + url.hash, pushed: false, covered: false, revealing: false, keyboard: event.detail === 0, controller: new AbortController() };
      active = navigation;
      document.documentElement.dataset.sonifyNavigating = "1";
      overlay.replaceChildren(createTiles());
      overlay.hidden = false;
      overlay.dataset.state = "covering";
      // Safety timer only covers a stalled route commit; reveal readiness is separately bounded.
      safetyTimer = setTimeout(reset, 8_000);
      animation = gsap.fromTo(overlay.children, { opacity: 0 }, {
        opacity: 1,
        duration: 0.05,
        ease: "power2.inOut",
        stagger: { amount: 0.5, each: 0.01, from: "random" },
        onComplete: () => {
          if (active !== navigation) return;
          navigation.covered = true;
          animation = gsap.delayedCall(0.3, () => {
            if (active !== navigation) return;
            navigation.pushed = true;
            overlay.dataset.state = "loading";
            if (pathnameRef.current !== navigation.from) void reveal();
            else router.push(navigation.href);
          });
        },
      });
    };
    const onMotionChange = () => {
      if (!motion.matches || !active) return;
      if (!active.pushed) router.push(active.href);
      reset();
    };
    document.addEventListener("pointerover", onIntent, { passive: true });
    document.addEventListener("focusin", onIntent);
    document.addEventListener("pointerdown", onIntent, { passive: true });
    document.addEventListener("touchstart", onIntent, { passive: true });
    document.addEventListener("pointerout", cancelIntent, { passive: true });
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    motion.addEventListener("change", onMotionChange);
    return () => {
      reset();
      cancelIntent();
      committedRef.current = () => {};
      document.removeEventListener("pointerover", onIntent);
      document.removeEventListener("focusin", onIntent);
      document.removeEventListener("pointerdown", onIntent);
      document.removeEventListener("touchstart", onIntent);
      document.removeEventListener("pointerout", cancelIntent);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      motion.removeEventListener("change", onMotionChange);
    };
  }, [router]);

  useEffect(() => { committedRef.current(); }, [pathname]);

  return <div ref={overlayRef} className="sonify-page-transition" data-state="idle" role="status" aria-label="Loading next page" hidden />;
}
