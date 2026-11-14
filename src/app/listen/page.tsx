import type { Metadata } from "next";
import { ListenWorkspace } from "@/components/listen/ListenWorkspace";

export const metadata: Metadata = {
  title: "Listen — SonifySphere",
  description: "Upload or search NASA Earth media, explore data layers, and hear the image or video respond to your touch.",
};

export default function ListenPage() { return <ListenWorkspace />; }
