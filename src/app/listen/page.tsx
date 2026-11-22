import type { Metadata } from "next";
import { ListenV4 } from "@/components/listen/v4/ListenV4";
import { layerFromParam } from "@/components/listen/v4/model";
import { PageReadableSummary } from "@/components/shared/PageReadableSummary";
import { BreadcrumbJsonLd } from "@/components/shared/BreadcrumbJsonLd";

export const metadata: Metadata = {
  title: "Listen — SonifySphere",
  description: "Move across an Equal Earth map or open NASA media, pick one data layer, and hear the point under the probe.",
};

export default async function ListenPage({ searchParams }: { searchParams: Promise<{ data?: string; source?: string; lat?: string; lng?: string }> }) {
  const params = await searchParams;
  const lat = Number(params.lat);
  const lng = Number(params.lng);
  return (
    <>
      <BreadcrumbJsonLd name="Listen" path="/listen" />
      <PageReadableSummary pageKey="listen" />
      <ListenV4
        initialLayer={layerFromParam(params.data)}
        initialSourceId={params.source}
        initialLat={Number.isFinite(lat) ? lat : undefined}
        initialLng={Number.isFinite(lng) ? lng : undefined}
      />
    </>
  );
}
