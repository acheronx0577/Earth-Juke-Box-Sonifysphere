"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";

interface RollingTextProps {
  text: string;
  direction?: 1 | -1;
  className?: string;
  hoverRoll?: boolean;
}

function renderChars(
  str: string,
  token: string,
  isIncoming = true,
  hoverRoll = false
) {
  const prefix = isIncoming ? "in" : "out";
  const charClass = isIncoming
    ? "rolling-char rolling-char-in inline-block will-change-transform leading-none"
    : "rolling-char-out inline-block will-change-transform leading-none";

  return str.split("").map((char, index) => (
    <span
      key={`${token}-${prefix}-${index}`}
      className={charClass}
      style={{
        height: "1.25em",
        lineHeight: "1.25em",
        textShadow: hoverRoll && isIncoming ? "0 1.25em currentColor" : undefined,
      }}
    >
      {char === " " ? "\u00A0" : char}
    </span>
  ));
}

function addGlitchTwice(tl: gsap.core.Timeline, container: HTMLElement) {
  tl.to(container, {
    x: -3.5,
    skewX: -5,
    opacity: 0.75,
    filter: "drop-shadow(2px 0 0 #aaaaaa) drop-shadow(-2px 0 0 #555555)",
    duration: 0.06,
    ease: "power1.inOut",
  });
  tl.to(container, {
    x: 0,
    skewX: 0,
    opacity: 1,
    filter: "none",
    duration: 0.03,
  });
  tl.to(container, {
    x: 3.5,
    skewX: 4,
    opacity: 0.65,
    filter: "drop-shadow(-2px 0 0 #aaaaaa) drop-shadow(2px 0 0 #555555)",
    duration: 0.06,
    ease: "power1.inOut",
  });
  tl.to(container, {
    x: 0,
    skewX: 0,
    opacity: 1,
    filter: "none",
    duration: 0.03,
  });
}

function rollOut(tl: gsap.core.Timeline, chars: NodeListOf<Element>, fromDir: "start" | "end") {
  if (!chars.length) return;
  tl.to(
    chars,
    {
      y: fromDir === "start" ? "-1.25em" : "1.25em",
      opacity: 0,
      duration: 0.32,
      ease: "power2.inOut",
      stagger: { each: 0.012, from: fromDir },
    },
    ">"
  );
}

function rollIn(tl: gsap.core.Timeline, chars: NodeListOf<Element>, fromDir: "start" | "end") {
  if (!chars.length) return;
  tl.fromTo(
    chars,
    { y: fromDir === "start" ? "1.25em" : "-1.25em", opacity: 0 },
    {
      y: "0em",
      opacity: 1,
      duration: 0.42,
      ease: "power3.out",
      stagger: { each: 0.015, from: fromDir },
    },
    "<0.06"
  );
}

function buildGlitchAndWaveTimeline(
  container: HTMLElement,
  fromDir: "start" | "end",
  onComplete: () => void
) {
  const outChars = container.querySelectorAll(".rolling-char-out");
  const inChars = container.querySelectorAll(".rolling-char-in");
  const tl = gsap.timeline({
    onComplete: () => {
      gsap.set(container, { clearProps: "transform,filter,opacity" });
      gsap.set(inChars, { y: "0em", opacity: 1 });
      onComplete();
    },
  });

  addGlitchTwice(tl, container);
  rollOut(tl, outChars, fromDir);
  rollIn(tl, inChars, fromDir);

  return tl;
}

function bindHoverRoll(container: HTMLElement) {
  const trigger = container.closest("button, a") || container;

  const onEnter = () => {
    const chars = container.querySelectorAll(".rolling-char-in");
    if (!chars.length) return;
    gsap.to(chars, {
      y: "-1.25em",
      duration: 0.45,
      stagger: 0.018,
      ease: "power3.out",
      overwrite: "auto",
    });
  };

  const onLeave = () => {
    const chars = container.querySelectorAll(".rolling-char-in");
    if (!chars.length) return;
    gsap.to(chars, {
      y: "0em",
      duration: 0.45,
      stagger: 0.018,
      ease: "power3.out",
      overwrite: "auto",
    });
  };

  trigger.addEventListener("mouseenter", onEnter);
  trigger.addEventListener("mouseleave", onLeave);

  return () => {
    trigger.removeEventListener("mouseenter", onEnter);
    trigger.removeEventListener("mouseleave", onLeave);
  };
}

export function RollingText({
  text,
  direction = 1,
  className = "",
  hoverRoll = true,
}: RollingTextProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const [displayText, setDisplayText] = useState(text);
  const [outgoingText, setOutgoingText] = useState<string | null>(null);
  const prevTextRef = useRef(text);
  const activeTimelineRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (text === prevTextRef.current) return;
    setOutgoingText(prevTextRef.current);
    prevTextRef.current = text;
    setDisplayText(text);
  }, [text]);

  useEffect(() => {
    if (!outgoingText || !containerRef.current) return;

    if (activeTimelineRef.current) {
      activeTimelineRef.current.kill();
    }

    const fromDir = direction === 1 ? "start" : "end";
    const tl = buildGlitchAndWaveTimeline(containerRef.current, fromDir, () => {
      setOutgoingText(null);
      activeTimelineRef.current = null;
    });
    activeTimelineRef.current = tl;

    const timer = setTimeout(() => {
      setOutgoingText(null);
    }, 1200);

    return () => clearTimeout(timer);
  }, [displayText, outgoingText, direction]);

  useEffect(() => {
    if (!hoverRoll || !containerRef.current) return;
    return bindHoverRoll(containerRef.current);
  }, [hoverRoll, displayText]);

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center justify-center overflow-hidden align-middle leading-none px-2.5 ${className}`}
      style={{
        height: "1.25em",
        lineHeight: "1.25em",
        verticalAlign: "middle",
        clipPath: "inset(0 0 0 0)",
      }}
      aria-label={text}
    >
      <span className="sr-only">{text}</span>

      {outgoingText && (
        <span
          className="absolute inset-0 px-2.5 inline-flex items-center justify-center whitespace-nowrap pointer-events-none select-none leading-none"
          aria-hidden="true"
        >
          {renderChars(outgoingText, outgoingText, false, false)}
        </span>
      )}

      <span
        className="inline-flex items-center justify-center whitespace-nowrap leading-none"
        aria-hidden="true"
      >
        {renderChars(displayText, displayText, true, hoverRoll)}
      </span>
    </span>
  );
}
