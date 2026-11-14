import type { Metadata } from "next";
import { datasetById } from "@/data/datasets";
import { ListenExplore } from "@/components/listen/ListenExplore";

export const metadata: Metadata = {
  title: "Listen — SonifySphere",
  description: "A flat map of twelve Earth regions. Pick a place, a season, and the weather, then play it.",
};

export default async function ListenPage({
  searchParams,
}: {
  searchParams: Promise<{ sound?: string; data?: string }>;
}) {
  const params = await searchParams;
  const initialSound = params.sound === "off" ? "off" : params.sound === "on" ? "on" : null;
  const initialData = datasetById(params.data)?.id ?? null;
  return <ListenExplore initialSound={initialSound} initialData={initialData} />;
}
