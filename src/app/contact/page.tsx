import type { Metadata } from "next";
import { ContactStage } from "@/components/contact/ContactStage";
import { PageReadableSummary } from "@/components/shared/PageReadableSummary";
import { BreadcrumbJsonLd } from "@/components/shared/BreadcrumbJsonLd";

export const metadata: Metadata = {
  title: "Contact — SonifySphere",
  description: "The SonifySphere team. Six voices, one Earth record.",
};

export default function ContactPage() {
  return (
    <>
      <BreadcrumbJsonLd name="Contact" path="/contact" />
      <PageReadableSummary pageKey="contact" />
      <ContactStage />
    </>
  );
}
