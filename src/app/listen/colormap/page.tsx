import type { Metadata } from "next";
import { ColorMapReading } from "@/components/listen/colormap/ColorMapReading";
import "@/components/listen/v4/listen-v4.css";

export const metadata: Metadata = {
  title: "GIBS colour map — SonifySphere",
  description: "A MERRA-2 air-temperature colour is converted back to kelvin and labeled image-derived.",
};

export default function ColorMapPage() {
  return <ColorMapReading />;
}
