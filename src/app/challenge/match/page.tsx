import type { Metadata } from "next";
import { SignalMatchGame } from "@/components/play/SignalMatchGame";
import { parseMatchResult } from "@/lib/challengeResults";

export const metadata: Metadata = {
  title: "Wave Match · Tune the Signal — SonifySphere",
  description: "Interactive audio frequency and resonance matching challenge to detect real climate anomaly spikes.",
};

export default async function SignalMatchPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const params = await searchParams;
  return <SignalMatchGame sharedResult={parseMatchResult(params.result)} />;
}
