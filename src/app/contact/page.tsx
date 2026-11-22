import type { Metadata } from "next";
import { ContactStage } from "@/components/contact/ContactStage";
import { PageReadableSummary } from "@/components/shared/PageReadableSummary";

export const metadata: Metadata = {
  title: "Contact — SonifySphere",
  description: "The SonifySphere team. Six voices, one Earth record.",
};

export default function ContactPage() {
  return (
    <>
      <PageReadableSummary pageKey="contact" />
      <ContactStage />
    </>
  );
}
