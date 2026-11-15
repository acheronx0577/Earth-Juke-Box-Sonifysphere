import type { Metadata } from "next";
import { EventPulses } from "@/components/listen/events/EventPulses";
import "@/components/listen/v4/listen-v4.css";

export const metadata: Metadata = {
  title: "Natural events — SonifySphere",
  description: "Open NASA EONET events in the chosen view, played as pulses and listed in text.",
};

export default function EventsPage() {
  return <EventPulses />;
}
