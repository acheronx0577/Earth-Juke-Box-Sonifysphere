import type { Metadata } from "next";
import { ContactStage } from "@/components/contact/ContactStage";

export const metadata: Metadata = {
  title: "Contact — SonifySphere",
  description: "The SonifySphere team. Six voices, one Earth record.",
};

export default function ContactPage() {
  return <ContactStage />;
}
