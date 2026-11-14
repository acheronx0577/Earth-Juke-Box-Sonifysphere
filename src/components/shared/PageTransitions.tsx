"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import { canWarmAssets } from "@/lib/assetCache";
import { waitForFirstView, warmRouteAssets } from "@/lib/routeAssets";
import "./PageTransitions.css";

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
    let active: { from: string; href: string; pushed: boolean; revealing: boolean; keyboard: boolean; controller: AbortController } | null = null;

    const destination = (target: EventTarget | null) => {
      const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self") || anchor.dataset.noTransition !== undefined) return null;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || !/^https?:$/.test(url.protocol) || url.pathname === location.pathname) return null;
      if (!/^\/(?:listen|about|story|challenge(?:\/(?:guess|compose|match))?)?\/?$/.test(url.pathname)) return null;
      return url;
    };
    const warm = (url: URL) => {
      if (!canWarmAssets()) return;
      const href = url.pathname + url.search;
      if (Date.now() - (prefetched.get(href) ?? 0) > 30_000) {
        prefetched.set(href, Date.now());
        if (prefetched.size > 16) prefetched.delete(prefetched.keys().next().value!);
        router.prefetch(href);
      }
      void warmRouteAssets(url.pathname);
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
      if (!navigation?.pushed || navigation.revealing) return;
      navigation.revealing = true;
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
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = destination(event.target);
      if (!url) return;
      warm(url);
      if (motion.matches) return;
      event.preventDefault();
      if (active) return;
      const navigation = { from: pathnameRef.current, href: url.pathname + url.search + url.hash, pushed: false, revealing: false, keyboard: event.detail === 0, controller: new AbortController() };
      active = navigation;
      document.documentElement.dataset.sonifyNavigating = "1";
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
      overlay.replaceChildren(fragment);
      overlay.hidden = false;
      overlay.dataset.state = "covering";
      // A failed navigation must never leave an opaque input-blocking overlay behind.
      safetyTimer = setTimeout(reset, 6000);
      animation = gsap.fromTo(overlay.children, { opacity: 0 }, {
        opacity: 1,
        duration: 0.05,
        ease: "power2.inOut",
        stagger: { amount: 0.5, each: 0.01, from: "random" },
        onComplete: () => {
          if (active !== navigation) return;
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
    document.addEventListener("pointerout", cancelIntent, { passive: true });
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", reset);
    motion.addEventListener("change", onMotionChange);
    return () => {
      reset();
      cancelIntent();
      committedRef.current = () => {};
      document.removeEventListener("pointerover", onIntent);
      document.removeEventListener("focusin", onIntent);
      document.removeEventListener("pointerdown", onIntent);
      document.removeEventListener("pointerout", cancelIntent);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", reset);
      motion.removeEventListener("change", onMotionChange);
    };
  }, [router]);

  useEffect(() => { committedRef.current(); }, [pathname]);

  return <div ref={overlayRef} className="sonify-page-transition" data-state="idle" role="status" aria-label="Loading next page" hidden />;
}
