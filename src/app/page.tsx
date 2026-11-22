import { HeroSection } from "@/components/landing/HeroSection";
import { HomepageJsonLd } from "@/components/landing/HomepageJsonLd";
import { ThemePickerSection } from "@/components/landing/ThemePickerSection";
import {
  ChaptersBlock,
  IntroSection,
  StatsSection,
} from "@/components/landing/IntroAndTeaserSection";
import { SplitCtaSection } from "@/components/landing/SplitCtaSection";
import { FooterSection } from "@/components/landing/FooterSection";
import { LandingEffects } from "@/components/landing/LandingEffects";
import { Preloader } from "@/components/landing/Preloader";
import { ReadableSummary } from "@/components/landing/ReadableSummary";

export default function LandingPage() {
  return (
    <main id="main-content" tabIndex={-1} className="bg-[#141414] min-h-screen w-full flex flex-col items-center relative">
      <HomepageJsonLd />
      <Preloader />
      <LandingEffects />
      <div
        className="sonify-landing-canvas content-stretch flex flex-col items-stretch relative w-full z-[2]"
        data-name="1 · Landing (full scroll)"
      >
        <HeroSection />
        <ThemePickerSection />
        <IntroSection />
        <ChaptersBlock />
        <StatsSection />
        <SplitCtaSection />
        <FooterSection />
      </div>
      <ReadableSummary />
    </main>
  );
}
