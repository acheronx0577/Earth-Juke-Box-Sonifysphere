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
    const stickyHeight = window.innerHeight * 7;

    function getRadius() {
      return window.innerWidth < 900
        ? window.innerWidth * 7.5
        : window.innerWidth * 2.5;
    }

    const arcAngle = Math.PI * 0.4;
    const startAngle = Math.PI / 2 - arcAngle / 2;

    function positionCards(progress = 0) {
      const radius = getRadius();
      const cardSpacing = 0.15;
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

    function updateTeamCounter(progress: number) {
      const isMobile = window.innerWidth <= 1000;
      const stepHeight = isMobile ? 100 : 150;
      const positions = [
        stepHeight,
        ...Array.from({ length: totalCards }, (_, i) => -i * stepHeight),
        -totalCards * stepHeight,
      ];
      const startProgress = 0.15;
      const endProgress = 0.9;
      const range = endProgress - startProgress;

      let index: number;
      if (progress < startProgress) {
        index = 0;
      } else if (progress > endProgress) {
        index = positions.length - 1;
      } else {
        const normalizedProgress = (progress - startProgress) / range;
        index = Math.min(
          positions.length - 1,
          Math.floor(normalizedProgress * (positions.length - 1))
        );
      }

      const targetY = positions[index];
      if (targetY === lastCounterY) return;
      lastCounterY = targetY;

      gsap.to(countContainer, {
        y: targetY,
        duration: 0.3,
        ease: "power1.out",
        overwrite: true,
      });
    }

    positionCards(0);
    updateTeamCounter(0);

    const trigger = ScrollTrigger.create({
      trigger: stickySection,
      start: "top top",
      end: `+=${stickyHeight}px`,
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        positionCards(self.progress);
        updateTeamCounter(self.progress);
      },
    });

    const onResize = () => {
      positionCards(trigger.progress || 0);
      updateTeamCounter(trigger.progress || 0);
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
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
