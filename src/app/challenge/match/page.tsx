import type { Metadata } from "next";
import { SignalMatchGame } from "@/components/play/SignalMatchGame";
import { parseMatchResult } from "@/lib/challengeResults";
import { PageReadableSummary } from "@/components/shared/PageReadableSummary";

export const metadata: Metadata = {
  title: "Challenge 02 · Tune the signal — SonifySphere",
  description: "Overlap your tone with the Keeling record. Tune frequency and resonance until the two waves match.",
};

export default async function SignalMatchPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <PageReadableSummary pageKey="match" />
      <SignalMatchGame sharedResult={parseMatchResult(params.result)} />
    </>
  );
}
