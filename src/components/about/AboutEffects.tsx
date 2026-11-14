"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { createLenisInstance } from "@/lib/lenis";

function reduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AboutEffects() {
  useEffect(() => {
    if (reduced()) return;
    gsap.registerPlugin(ScrollTrigger, SplitText);
    const { destroyLenis, lenis } = createLenisInstance({ syncTouch: false });
    const splits: Array<{ revert: () => void }> = [];
    const mm = gsap.matchMedia();
    let lastX = 0;
    let lastY = 0;
    let hoverRow: Element | null = null;

    const stackOf = (row: Element | null) => row?.querySelector<HTMLElement>(".sonify-roll__stack") ?? null;

    const claimRoll = (stack: HTMLElement) => {
      const roll = stack.closest(".sonify-roll");
      if (!roll || roll.classList.contains("is-js")) return;
      roll.classList.add("is-js");
      gsap.set(stack, { yPercent: -66.666 });
    };

    const rollTo = (stack: HTMLElement, yPercent: number) => {
      gsap.to(stack, {
        yPercent,
        duration: 0.4,
        ease: "power2.out",
        overwrite: "auto",
        onStart: () => {
          stack.style.willChange = "transform";
        },
        onComplete: () => {
          stack.style.willChange = "auto";
        },
      });
    };

    const enterRow = (row: Element, fromTop: boolean) => {
      if (window.innerWidth < 1000) return;
      const stack = stackOf(row);
      if (!stack) return;
      if (row.hasAttribute("data-team-row") || row.hasAttribute("data-voice-row")) claimRoll(stack);
      const current = Number(gsap.getProperty(stack, "yPercent"));
      if (fromTop || current === 0) {
        row.classList.add("is-rolled");
        rollTo(stack, -33.333);
      }
      hoverRow = row;
    };

    const leaveRow = (row: Element, fromTop: boolean) => {
      const stack = stackOf(row);
      if (!stack || window.innerWidth < 1000) return;
      if (row.hasAttribute("data-team-row") || row.hasAttribute("data-voice-row")) claimRoll(stack);
      row.classList.remove("is-rolled");
      if (row.getAttribute("data-playing") === "true") {
        rollTo(stack, -33.333);
        return;
      }
      rollTo(stack, fromTop ? -66.666 : 0);
      if (hoverRow === row) hoverRow = null;
    };

    const onMove = (event: MouseEvent) => {
      lastX = event.clientX;
      lastY = event.clientY;
    };

    const recheckHover = () => {
      if (window.innerWidth < 1000) return;
      const hit = document.elementFromPoint(lastX, lastY);
      const row = hit?.closest<HTMLElement>("[data-roll]") ?? null;
      if (row === hoverRow) return;
      if (hoverRow) {
        const rect = hoverRow.getBoundingClientRect();
        leaveRow(hoverRow, lastY < rect.top + rect.height / 2);
      }
      if (row) {
        const rect = row.getBoundingClientRect();
        enterRow(row, lastY < rect.top + rect.height / 2);
      }
    };

    const onEnter = (event: Event) => {
      const row = event.currentTarget as HTMLElement;
      const rect = row.getBoundingClientRect();
      const mouse = event as MouseEvent;
      enterRow(row, mouse.clientY < rect.top + rect.height / 2);
    };
    const onLeave = (event: Event) => {
      const row = event.currentTarget as HTMLElement;
      const rect = row.getBoundingClientRect();
      const mouse = event as MouseEvent;
      leaveRow(row, mouse.clientY < rect.top + rect.height / 2);
    };
    const onFocusIn = (event: Event) => {
      if (window.innerWidth < 1000) return;
      const row = event.currentTarget as HTMLElement;
      if (!row.querySelector("button")) return;
      enterRow(row, true);
    };
    const onFocusOut = (event: FocusEvent) => {
      const row = event.currentTarget as HTMLElement;
      if (row.contains(event.relatedTarget as Node | null)) return;
      leaveRow(row, true);
    };

    document.querySelectorAll<HTMLElement>("[data-roll]").forEach((row) => {
      row.addEventListener("mouseenter", onEnter);
      row.addEventListener("mouseleave", onLeave);
      row.addEventListener("focusin", onFocusIn);
      row.addEventListener("focusout", onFocusOut);
    });
    document.addEventListener("mousemove", onMove);
    lenis.on("scroll", () => requestAnimationFrame(recheckHover));

    const syncPlaying = () => {
      if (window.innerWidth < 1000) return;
      document.querySelectorAll<HTMLElement>("[data-voice-row]").forEach((row) => {
        if (row.getAttribute("data-playing") !== "true") return;
        const stack = stackOf(row);
        if (!stack) return;
        claimRoll(stack);
        row.classList.add("is-rolled");
        rollTo(stack, -33.333);
      });
    };
    const playingObserver = new MutationObserver(syncPlaying);
    document.querySelectorAll("[data-voice-row]").forEach((row) => {
      playingObserver.observe(row, { attributes: true, attributeFilter: ["data-playing"] });
    });

    mm.add({ motion: "(prefers-reduced-motion: no-preference)", desk: "(min-width: 1000px)" }, (context) => {
      const desk = Boolean(context.conditions?.desk);
      const clean: Array<() => void> = [];

      const slide = (el: HTMLElement, delay: number) => {
        const split = SplitText.create(el, { type: "lines", mask: "lines", linesClass: "about-line" });
        splits.push(split);
        gsap.from(split.lines, {
          yPercent: 100,
          duration: 0.75,
          ease: "power3.out",
          stagger: 0.1,
          delay,
        });
      };

      const runHero = () => {
        const title = document.querySelector<HTMLElement>("[data-about-title]");
        const copy = document.querySelector<HTMLElement>("[data-about-copy]");
        if (title) slide(title, 0.15);
        if (copy) slide(copy, 0.35);
        const cta = document.querySelector(".about-hero-actions");
        if (cta) gsap.from(cta, { opacity: 0, duration: 0.3, delay: 0.6 });
        document.querySelectorAll<HTMLElement>("[data-flicker]").forEach((el) => {
          const split = SplitText.create(el, { type: "chars" });
          gsap.from(split.chars, {
            opacity: 0,
            duration: 0.05,
            stagger: { amount: 0.5, from: "random" },
            delay: 0.9,
            onComplete: () => split.revert(),
          });
        });
      };

      if (document.fonts?.ready) void document.fonts.ready.then(runHero);
      else runHero();

      document.querySelectorAll<HTMLElement>("[data-about-h2]").forEach((el) => {
        const split = SplitText.create(el, { type: "lines", mask: "lines", linesClass: "about-line" });
        splits.push(split);
        gsap.from(split.lines, {
          yPercent: 100,
          duration: 0.75,
          ease: "power3.out",
          stagger: 0.1,
          scrollTrigger: { trigger: el, start: "top 70%", once: true },
        });
      });

      const rows = gsap.utils.toArray<HTMLElement>("[data-roll]");
      const batch = ScrollTrigger.batch(rows, {
        start: "top 85%",
        once: true,
        onEnter: (entered) => {
          gsap.from(entered, { y: 24, opacity: 0, duration: 0.6, ease: "power3.out", stagger: 0.06 });
        },
      });
      clean.push(() => batch.forEach((trigger) => trigger.kill()));

      if (desk) {
        document.querySelectorAll<HTMLElement>("[data-team-row]").forEach((row) => {
          const stack = stackOf(row);
          if (!stack) return;
          claimRoll(stack);
          const timeline = gsap.timeline({ paused: true });
          timeline
            .to(stack, { yPercent: -33.333, duration: 0.4, ease: "power2.out", overwrite: "auto" })
            .to(stack, { yPercent: -66.666, duration: 0.4, ease: "power2.inOut", overwrite: "auto" }, "+=0.9");
          timeline.eventCallback("onStart", () => row.classList.add("is-rolled"));
          timeline.eventCallback("onComplete", () => {
            if (hoverRow !== row) row.classList.remove("is-rolled");
          });
          const trigger = ScrollTrigger.create({
            trigger: row,
            start: "center 55%",
            once: true,
            onEnter: () => timeline.play(),
          });
          clean.push(() => {
            trigger.kill();
            timeline.kill();
          });
        });
      }

      return () => clean.forEach((fn) => fn());
    });

    return () => {
      playingObserver.disconnect();
      document.removeEventListener("mousemove", onMove);
      document.querySelectorAll<HTMLElement>("[data-roll]").forEach((row) => {
        row.removeEventListener("mouseenter", onEnter);
        row.removeEventListener("mouseleave", onLeave);
        row.removeEventListener("focusin", onFocusIn);
        row.removeEventListener("focusout", onFocusOut);
      });
      mm.revert();
      splits.forEach((split) => split.revert());
      destroyLenis();
    };
  }, []);

  return null;
}
