import type { Metadata } from "next";
import { GuessGame } from "@/components/play/GuessGame";
import { parseGuessResult } from "@/lib/challengeResults";
import { PageReadableSummary } from "@/components/shared/PageReadableSummary";

export const metadata: Metadata = {
  title: "Guess the Signal — SonifySphere",
  description: "Hear a short sonified phrase and name the region or the record it came from.",
};

export default async function GuessPage({
  searchParams,
}: {
  searchParams: Promise<{ seed?: string; resume?: string; result?: string }>;
}) {
  const params = await searchParams;
  const parsed = Number(params.seed);
  const seed = Number.isInteger(parsed) ? parsed : undefined;
  return (
    <>
      <PageReadableSummary pageKey="guess" />
      <GuessGame seed={seed} sharedResult={parseGuessResult(params.result)} />
    </>
  );
}
