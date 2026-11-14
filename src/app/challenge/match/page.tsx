import type { Metadata } from "next";
import { SignalMatchGame } from "@/components/play/SignalMatchGame";

export const metadata: Metadata = {
  title: "Wave Match · Tune the Signal — SonifySphere",
  description: "Interactive audio frequency and resonance matching challenge to detect real climate anomaly spikes.",
};

export default function SignalMatchPage() {
  return <SignalMatchGame />;
}
