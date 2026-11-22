import type { Metadata } from "next";
import { StoryChaptersCarousel } from "@/components/story/StoryChaptersCarousel";
import { FooterSection } from "@/components/landing/FooterSection";
import { PageReadableSummary } from "@/components/shared/PageReadableSummary";
import { BreadcrumbJsonLd } from "@/components/shared/BreadcrumbJsonLd";

export const metadata: Metadata = {
  title: "Story / 3 Chapters — SonifySphere",
  description: "Three chapters of the Mauna Loa CO₂ record sonified. From the first breath in March 1958 to 432 ppm today.",
};

export default function StoryPage() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen w-full bg-[#141414] pt-20">
      <BreadcrumbJsonLd name="Story" path="/story" />
      <PageReadableSummary pageKey="story" />
      <StoryChaptersCarousel />
      <FooterSection showChallenge />
    </main>
  );
}
