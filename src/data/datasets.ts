import type { ThemeId } from "@/data/landingData";
import type { LayerId } from "@/data/exploreMap";

export type DatasetId = "co2" | "ch4" | "temp";

export interface DatasetOption {
  readonly id: DatasetId;
  readonly chip: string;
  readonly title: string;
  readonly layer: LayerId;
  readonly theme: ThemeId;
}

export const DATASETS: readonly DatasetOption[] = [
  {
    id: "co2",
    chip: "CO₂",
    title: "CO₂ in the air · Keeling curve",
    layer: "co2",
    theme: "co2",
  },
  {
    id: "ch4",
    chip: "CH₄",
    title: "Atmospheric methane · CH₄",
    layer: "methane",
    theme: "methane",
  },
  {
    id: "temp",
    chip: "TEMP",
    title: "Global surface temperature",
    layer: "temperature",
    theme: "temperature",
  },
];

const BY_ID = new Map(DATASETS.map((item) => [item.id, item]));

export function datasetById(id: string | null | undefined): DatasetOption | null {
  if (!id) return null;
  return BY_ID.get(id as DatasetId) ?? null;
}

export function datasetForLayer(layer: LayerId): DatasetOption | null {
  return DATASETS.find((item) => item.layer === layer) ?? null;
}

export function datasetForTheme(theme: ThemeId): DatasetId {
  return DATASETS.find((item) => item.theme === theme)?.id ?? "co2";
}

export function writeDatasetParam(id: DatasetId): void {
  const url = new URL(window.location.href);
  url.searchParams.set("data", id);
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(null, "", next);
}
