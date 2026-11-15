import type { Metadata } from "next";
import { WaveformRibbonsGame } from "@/components/play/WaveformRibbonsGame";
import { parseRibbonsResult } from "@/lib/challengeResults";

export const metadata: Metadata = {
  title: "Waveform Ribbons — SonifySphere",
  description: "Interactive seasonal curve challenge: track annual forest respiration and Arctic polar pack rhythms by ear.",
};

export default async function WaveformRibbonsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const params = await searchParams;
  return <WaveformRibbonsGame sharedResult={parseRibbonsResult(params.result)} />;
}
