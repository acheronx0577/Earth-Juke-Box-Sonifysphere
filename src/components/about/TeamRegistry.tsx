"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TEAM } from "@/data/aboutData";

export function TeamRegistry() {
  const sectionRef = useRef<HTMLElement>(null);
  const countContainerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    gsap.registerPlugin(ScrollTrigger);

    const stickySection = sectionRef.current;
    const countContainer = countContainerRef.current;
    if (!stickySection || !countContainer) return;

    const cards = cardsRef.current.filter(Boolean) as HTMLDivElement[];
    if (!cards.length) return;

    const totalCards = cards.length;
    let lastCounterY: number | null = null;
    const cardSpacing = 0.15;
    // Full arc was 7 viewports; the last card is centered at 5/7 of that.
    const fullArcDistance = () => window.innerHeight * 7;

    function progressWhenCardCentered(index: number) {
      const initialOffset = -cardSpacing * (totalCards - 1);
      const totalTravel = 1 - initialOffset;
      const cardOffset = (totalCards - 1 - index) * cardSpacing;
      return (0.5 - cardOffset - initialOffset) / totalTravel;
    }

    function distanceUntilLastCard() {
      return fullArcDistance() * progressWhenCardCentered(totalCards - 1);
    }

    function getRadius() {
      return window.innerWidth < 900
        ? window.innerWidth * 7.5
        : window.innerWidth * 2.5;
    }

    const arcAngle = Math.PI * 0.4;
    const startAngle = Math.PI / 2 - arcAngle / 2;

    function positionCards(progress = 0) {
      const radius = getRadius();
      const initialOffset = -cardSpacing * (totalCards - 1);
      const totalTravel = 1 - initialOffset;
      const arcProgress = initialOffset + progress * totalTravel;

      cards.forEach((card, i) => {
        const cardOffset = (totalCards - 1 - i) * cardSpacing;
        const cardProgress = cardOffset + arcProgress;
        const angle = startAngle + arcAngle * cardProgress;

        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const rotation = (angle - Math.PI / 2) * (180 / Math.PI);

        gsap.set(card, {
          x,
          y: -y + radius,
          rotation: -rotation,
          transformOrigin: "center center",
        });
      });
    }

    function centeredCardIndex(progress: number) {
      const initialOffset = -cardSpacing * (totalCards - 1);
      const totalTravel = 1 - initialOffset;
      const arcProgress = initialOffset + progress * totalTravel;
      const raw = totalCards - 1 - (0.5 - arcProgress) / cardSpacing;
      return Math.max(0, Math.min(totalCards - 1, Math.round(raw)));
    }

    function updateTeamCounter(progress: number) {
      const stepHeight = countContainer?.parentElement?.getBoundingClientRect().height ?? 0;
      if (!stepHeight) return;
      const index = centeredCardIndex(progress);
      const targetY = -index * stepHeight;
      if (targetY === lastCounterY) return;
      const first = lastCounterY === null;
      lastCounterY = targetY;

      gsap.to(countContainer, {
        y: targetY,
        duration: first ? 0 : 0.3,
        ease: "power1.out",
        overwrite: true,
      });
    }

    positionCards(0);
    updateTeamCounter(0);

    const trigger = ScrollTrigger.create({
      trigger: stickySection,
      start: "top top",
      end: () => `+=${distanceUntilLastCard()}`,
      pin: true,
      pinSpacing: true,
      anticipatePin: 0,
      onUpdate: (self) => {
        const progress = self.progress * progressWhenCardCentered(totalCards - 1);
        positionCards(progress);
        updateTeamCounter(progress);
      },
    });

    const onResize = () => {
      lastCounterY = null;
      ScrollTrigger.refresh();
    };

    window.addEventListener("resize", onResize);

    // Same finger-up stop as the data section, so a flick cannot keep sliding through the cards.
    let hold = false;
    const sectionVisible = () => {
      const rect = stickySection.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    };
    const onTouchStart = () => {
      hold = false;
    };
    const onTouchEnd = () => {
      if (!sectionVisible()) return;
      const y = window.scrollY;
      const until = performance.now() + 1400;
      hold = true;
      const tick = () => {
        if (!hold) return;
        if (Math.abs(window.scrollY - y) > 0.5) window.scrollTo(0, y);
        if (performance.now() < until) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      hold = false;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      trigger.kill();
    };
  }, []);

  return (
    <section className="team" ref={sectionRef} aria-label="Team Registry">
      <div className="team-counter">
        <div className="counter-title">
          <h2 className="team-heading">
            Crew <br />
            Registry
          </h2>
        </div>

        <div className="count" aria-hidden="true">
          <div className="count-container" ref={countContainerRef}>
            {TEAM.map((_, i) => (
              <span key={i} className="count-number">
                {String(i + 1).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="cards">
        {TEAM.map((member, i) => {
          const isGeneratedPlaceholder = member.name === "Irmuun Temuulel";

          return (
            <div
              key={member.name}
              className="card"
              ref={(el) => {
                cardsRef.current[i] = el;
              }}
            >
              <div className="card-img">
                <img
                  src={member.image || `/team/squad_img_${String(i + 1).padStart(2, "0")}.webp`}
                  alt={isGeneratedPlaceholder ? `AI-generated representative portrait for ${member.name}` : member.name}
                  data-si-generated={isGeneratedPlaceholder ? "true" : undefined}
                  data-si-media={isGeneratedPlaceholder ? "image" : undefined}
                  loading="lazy"
                  draggable={false}
                />
                {isGeneratedPlaceholder && (
                  <span className="team-ai-label" aria-hidden="true">AI-GENERATED IMAGE</span>
                )}
              </div>
              <div className="card-content">
                <h3>{member.name}</h3>
                <p>{member.role}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
