"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const AnimatedTechText = dynamic(
  () => import("@/components/shared/TechText").then((module) => module.TechText),
  { ssr: false },
);

function isIPadOS() {
  return /iPad/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function FooterWordmark() {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1000px) and (hover: hover) and (pointer: fine)");
    const update = () => setAnimate(media.matches && !isIPadOS());

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div className="relative shrink-0 w-full max-w-[1346.4px] xl:max-w-[1500px] 2xl:max-w-[1680px] aspect-[1346.4/239.467] z-30 overflow-visible font-['PlanetKosmos']">
      {animate ? (
        <AnimatedTechText
          text="sonifysphere"
          className="cursor-target"
          fontFamily="PlanetKosmos"
          fontWeight={400}
          fontSize={160}
          letterSpacing={-0.03}
          color="#f2f2f0"
          accentColor="#f2f2f0"
          reveal="letter"
          dashLength={4}
          dashGap={2}
          strokeWidth={1.5}
          specks={15}
          selection={true}
          labels={true}
          draggable={true}
          bounce={0.4}
          clickKick={true}
          intro="none"
          sweep={true}
          speed={0.5}
          guides={false}
          bleedTop={520}
          bleedBottom={220}
          bleedX={200}
        />
      ) : (
        <span className="sonify-footer-wordmark-static" aria-hidden="true">
          sonifysphere
        </span>
      )}
    </div>
  );
}
