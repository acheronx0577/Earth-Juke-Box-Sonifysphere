"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initGlobalLenis, destroyGlobalLenis, getGlobalLenis } from "@/lib/lenis";

export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || pathname === "/listen") return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    initGlobalLenis();

    return () => {
      destroyGlobalLenis();
    };
  }, [pathname]);

  useEffect(() => {
    const lenis = getGlobalLenis();
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
    }
    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 120);
    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
