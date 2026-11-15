import type { Metadata } from "next";
import { ListenV4 } from "@/components/listen/v4/ListenV4";
import { layerFromParam } from "@/components/listen/v4/model";

export const metadata: Metadata = {
  title: "Listen — SonifySphere",
  description: "Move across an Equal Earth map or open NASA media, pick one data layer, and hear the point under the probe.",
};

export default async function ListenPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const params = await searchParams;
  return <ListenV4 initialLayer={layerFromParam(params.data)} />;
}
