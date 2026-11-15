import type { ListenSource } from "@/components/listen/v4/model";

/** Decorative history swatch. The official frame loads only after the source is opened. */
const THUMB =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#12343a"/><rect y="78" width="320" height="36" fill="#e07a4a"/></svg>`,
  );

export const EIC_FRAME_SOURCE: ListenSource = {
  id: "eic-svs-5101",
  title: "EIC sea surface temperature, image-derived",
  kind: "image",
  eyebrow: "EIC",
  meta: "NASA SVS 5101 · image-derived",
  preview: THUMB,
  layer: "all",
  legend: null,
};

export const EIC_FRAME_IMAGE = "/api/listen/eic/image";
export const EIC_FRAME_STATUS = "NASA Earth Information Center frame. Image-derived, not a measurement.";
