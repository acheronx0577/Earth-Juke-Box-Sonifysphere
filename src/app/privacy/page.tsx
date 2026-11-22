import type { Metadata } from "next";
import Link from "next/link";
import { FooterSection } from "@/components/landing/FooterSection";
import { BreadcrumbJsonLd } from "@/components/shared/BreadcrumbJsonLd";

export const metadata: Metadata = {
  title: "Privacy Policy — SonifySphere",
  description: "Privacy policy and data governance for SonifySphere: how data, local preferences, and client-side audio synthesis work.",
};

export default function PrivacyPage() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen w-full bg-[#141414] text-[#f2f2f0] pt-28 pb-16 px-6 sm:px-12 flex flex-col items-center">
      <BreadcrumbJsonLd name="Privacy Policy" path="/privacy" />
      <article className="max-w-3xl w-full flex flex-col gap-8 font-mono">
        <header className="border-b border-[#333333] pb-6 flex flex-col gap-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#8a8a8a]">Legal & Data Governance</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#f2f2f0]">Privacy Policy</h1>
          <p className="text-xs text-[#8a8a8a]">Effective Date: November 2026 · SonifySphere</p>
        </header>

        <section className="flex flex-col gap-4 text-sm leading-relaxed text-[#cccccc]">
          <h2 className="text-lg font-medium text-[#f2f2f0] uppercase tracking-wide border-l-2 border-[#555555] pl-3">
            1. Core Principles
          </h2>
          <p>
            SonifySphere is an educational open-source interactive sound installation created for NASA Space Apps 2026.
            We believe privacy is a fundamental human right. We do not sell user data, track personal browsing habits,
            or construct advertising profiles. All audio sonification happens directly inside your web browser.
          </p>
        </section>

        <section className="flex flex-col gap-4 text-sm leading-relaxed text-[#cccccc]">
          <h2 className="text-lg font-medium text-[#f2f2f0] uppercase tracking-wide border-l-2 border-[#555555] pl-3">
            2. Audio Synthesis & Client-Side Execution
          </h2>
          <p>
            All sound rendering is performed locally on your device via the Web Audio API and Tone.js. Your audio interactions,
            parameters, and challenge responses are computed on-device in real-time. No raw audio streams or user microphone
            inputs are recorded or transmitted to external AI cloud models or third-party servers.
          </p>
        </section>

        <section className="flex flex-col gap-4 text-sm leading-relaxed text-[#cccccc]">
          <h2 className="text-lg font-medium text-[#f2f2f0] uppercase tracking-wide border-l-2 border-[#555555] pl-3">
            3. Cookies & Local Storage
          </h2>
          <p>
            SonifySphere does not use advertising or third-party tracking cookies. We utilize standard browser local storage
            strictly for functional client-side preferences:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-xs text-[#b0b0b0]">
            <li><code>sonifysphere-lite</code>: Stores your preference for performance optimization mode (on/off).</li>
            <li><code>sonify-intro-seen</code>: Remembers whether the initial tutorial animation has played to avoid repetitive intro states.</li>
            <li><code>sonify-sound-preference</code>: Retains your sound on/off preference across page navigation.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-4 text-sm leading-relaxed text-[#cccccc]">
          <h2 className="text-lg font-medium text-[#f2f2f0] uppercase tracking-wide border-l-2 border-[#555555] pl-3">
            4. Public Scientific Datasets
          </h2>
          <p>
            Earth climate figures, satellite imagery, and atmospheric measurements presented across SonifySphere originate
            from public-domain scientific repositories:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-xs text-[#b0b0b0]">
            <li>NASA Global Imagery Browse Services (GIBS) & NASA Image and Video Library</li>
            <li>NASA Earth Polychromatic Imaging Camera (EPIC)</li>
            <li>NOAA Global Monitoring Laboratory (Mauna Loa Observatory CO₂ records)</li>
            <li>Open-Meteo elevation APIs and Microsoft Planetary Computer public endpoints</li>
          </ul>
        </section>

        <section className="flex flex-col gap-4 text-sm leading-relaxed text-[#cccccc]">
          <h2 className="text-lg font-medium text-[#f2f2f0] uppercase tracking-wide border-l-2 border-[#555555] pl-3">
            5. Inquiries & Contact
          </h2>
          <p>
            For privacy inquiries, data questions, or educational outreach regarding SonifySphere, contact project maintainer Richard Huynh:
          </p>
          <p className="text-xs">
            Email: <a href="mailto:richardhuynh0824@gmail.com" className="text-[#f2f2f0] underline">richardhuynh0824@gmail.com</a>
            <br />
            Source Repository: <a href="https://github.com/acheronx0577/Earth-Juke-Box-Sonifysphere" target="_blank" rel="noreferrer" className="text-[#f2f2f0] underline">github.com/acheronx0577/Earth-Juke-Box-Sonifysphere</a>
          </p>
        </section>

        <footer className="pt-8 border-t border-[#333333] flex justify-between items-center text-xs text-[#8a8a8a]">
          <Link href="/" className="hover:text-[#f2f2f0] transition-colors">← Return to Home</Link>
          <Link href="/contact" className="hover:text-[#f2f2f0] transition-colors">Meet the Team →</Link>
        </footer>
      </article>
      <div className="w-full max-w-full mt-16">
        <FooterSection />
      </div>
    </main>
  );
}
