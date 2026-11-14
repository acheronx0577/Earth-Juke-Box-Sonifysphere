import type { Metadata } from "next";
import { ComposeBoard } from "@/components/play/ComposeBoard";

export const metadata: Metadata = {
  title: "Compose — SonifySphere",
  description: "Compile regions and records into a short Earth mixtape, then play, download, or share it.",
};

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ mix?: string }>;
}) {
  const params = await searchParams;
  return <ComposeBoard initialMix={params.mix ?? null} />;
}
