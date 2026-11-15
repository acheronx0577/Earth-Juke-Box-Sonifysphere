import type { Metadata } from "next";
import { EpicSource } from "@/components/listen/epic/EpicSource";
import "@/components/listen/v4/listen-v4.css";

export const metadata: Metadata = {
  title: "EPIC frames — SonifySphere",
  description: "Whole-Earth frames from NASA EPIC (DSCOVR). Image-derived, not a measurement.",
};

export default function EpicPage() {
  return <EpicSource />;
}
