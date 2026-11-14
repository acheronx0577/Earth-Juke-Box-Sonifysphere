import type { Metadata } from "next";
import { datasetById } from "@/data/datasets";
import { ListenExplore } from "@/components/listen/ListenExplore";

export const metadata: Metadata = {
  title: "Classic Listen — SonifySphere",
  description: "Explore the original region map, choose a data layer, and hear a place.",
};

export default async function ClassicListenPage({ searchParams }: { searchParams: Promise<{ sound?: string; data?: string }> }) {
  const params = await searchParams;
  const initialSound = params.sound === "off" ? "off" : params.sound === "on" ? "on" : null;
  const initialData = datasetById(params.data)?.id ?? null;
  return <ListenExplore initialSound={initialSound} initialData={initialData} />;
}
