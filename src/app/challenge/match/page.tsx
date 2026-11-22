import type { Metadata } from "next";
import { SignalMatchGame } from "@/components/play/SignalMatchGame";
import { parseMatchResult } from "@/lib/challengeResults";

export const metadata: Metadata = {
  title: "Challenge 02 · Tune the signal — SonifySphere",
  description: "Overlap your tone with the Keeling record. Tune frequency and resonance until the two waves match.",
};

export default async function SignalMatchPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const params = await searchParams;
  return <SignalMatchGame sharedResult={parseMatchResult(params.result)} />;
}
