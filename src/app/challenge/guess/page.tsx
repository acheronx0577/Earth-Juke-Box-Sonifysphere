import type { Metadata } from "next";
import { GuessGame } from "@/components/play/GuessGame";

export const metadata: Metadata = {
  title: "Guess the Signal — SonifySphere",
  description: "Hear a short sonified phrase and name the region or the record it came from.",
};

export default async function GuessPage({
  searchParams,
}: {
  searchParams: Promise<{ seed?: string; resume?: string }>;
}) {
  const params = await searchParams;
  const parsed = Number(params.seed);
  const seed = Number.isInteger(parsed) ? parsed : undefined;
  return <GuessGame seed={seed} />;
}
