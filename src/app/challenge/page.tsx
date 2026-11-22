import type { Metadata } from "next";
import { StoryChaptersCarousel } from "@/components/story/StoryChaptersCarousel";
import { PageReadableSummary } from "@/components/shared/PageReadableSummary";
import { BreadcrumbJsonLd } from "@/components/shared/BreadcrumbJsonLd";

export const metadata: Metadata = {
  title: "Challenge — SonifySphere",
  description: "Explore the 3 story chapters and play with sound: guess a signal, or compile an Earth mixtape.",
};

export default function ChallengePage() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen w-full bg-[#141414] pt-12 sm:pt-14">
      <BreadcrumbJsonLd name="Challenges" path="/challenge" />
      <PageReadableSummary pageKey="challenge" />
      <StoryChaptersCarousel />
    </main>
  );
}
