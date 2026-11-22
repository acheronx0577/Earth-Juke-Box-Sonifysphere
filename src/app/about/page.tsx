import type { Metadata } from "next";
import { TeamRegistry } from "@/components/about/TeamRegistry";
import { MapHero } from "@/components/about/MapHero";
import { RoutineStrip } from "@/components/about/RoutineStrip";
import { FooterSection } from "@/components/landing/FooterSection";
import { AboutCreditsSection } from "@/components/about/AboutCreditsSection";
import { BreadcrumbJsonLd } from "@/components/shared/BreadcrumbJsonLd";
import "@/app/about-map.css";

export const metadata: Metadata = {
  title: "About / How It Sounds — SonifySphere",
  description: "SonifySphere plays the Mauna Loa CO₂ record as music. Three voices, one for each pattern in the data.",
};

export default function AboutPage() {
  return (
    <main id="main-content" tabIndex={-1} className="about-rebuild min-h-screen w-full max-w-full overflow-x-clip">
      <BreadcrumbJsonLd name="About" path="/about" />
      <MapHero />
      <RoutineStrip />
      <TeamRegistry />
      <AboutCreditsSection />
      <FooterSection showChallenge />
    </main>
  );
}
