import type { VoiceId } from "@/context/SonifyPlayerContext";

export const ABOUT_ASSETS = {
  miniPlayerBg: "/assets/about/0c65d.svg",
  miniPlayButton: "/assets/about/414f5.svg",
  miniThemeSwitcherBg: "/assets/about/c750b.svg",
  miniMuteButton: "/assets/about/7d30a.svg",
  heroHeadlineHowItSounds: "/assets/about/58732.svg",
  buttonSecondaryOutlineBg: "/assets/about/50488.svg",
  slideCardBg: "/assets/about/38b7a.svg",
  slideNumber01: "/assets/about/b5eba.svg",
  slideStripPitch: "/assets/about/0f7df.svg",
  slideNumber02: "/assets/about/da51f.svg",
  slideStripPulse: "/assets/about/fe2a0.svg",
  slideNumber03: "/assets/about/12da5.svg",
  slideStripClick: "/assets/about/c9b85.svg",
  creditsHeaderOutline: "/assets/about/84603.svg",
  creditsHoverThumbnail: "/assets/about/32b04.svg",
} as const;

export type VoiceStrip = "rise" | "sine" | "ticks";

export interface VoiceCardSpec {
  readonly id: VoiceId;
  readonly index: string;
  readonly title: string;
  readonly body: string;
  readonly strip: VoiceStrip;
  readonly stripAlt: string;
}

export const VOICE_CARDS: readonly VoiceCardSpec[] = [
  {
    id: "pitch",
    index: "01 / 03",
    title: "PITCH = PPM",
    body: "More CO₂, higher note. 315.71 ppm (Mar 1958) is the low end; the 432.34 ppm record (May 2026) is the top note.",
    strip: "rise",
    stripAlt: "Rising CO₂ curve from 315.71 ppm to 432.34 ppm",
  },
  {
    id: "pulse",
    index: "02 / 03",
    title: "PULSE = SEASONS",
    body: "Forests breathe CO₂ in every summer and out every winter. That ~6 ppm swing (6.14 in 2025) is the beat.",
    strip: "sine",
    stripAlt: "Seasonal CO₂ swing drawn as a sine wave",
  },
  {
    id: "click",
    index: "03 / 03",
    title: "CLICK = RECORDS",
    body: "Every month that beats all earlier months adds a soft click. 163 so far, the latest in May 2026.",
    strip: "ticks",
    stripAlt: "Record months drawn as vertical ticks",
  },
];

export interface AboutCreditRowSpec {
  readonly id: string;
  readonly label: string;
  readonly text: string;
  readonly linkLabel?: string;
  readonly linkHref?: string;
}

export const ABOUT_CREDIT_ROWS: readonly AboutCreditRowSpec[] = [
  {
    id: "data",
    label: "Data",
    text: "NOAA GML Mauna Loa. Shown CO₂ figures are embedded, not a live feed.",
    linkLabel: "gml.noaa.gov ↗",
    linkHref: "https://gml.noaa.gov/ccgg/trends/",
  },
  {
    id: "gibs",
    label: "Imagery",
    text: "Classic globe requests NASA GIBS Blue Marble tiles.",
    linkLabel: "GIBS ↗",
    linkHref: "https://nasa-gibs.github.io/gibs-api-docs/",
  },
  {
    id: "library",
    label: "Media",
    text: "Listen searches the NASA Image and Video Library. Media, not measurements.",
    linkLabel: "NASA images ↗",
    linkHref: "https://images.nasa.gov/",
  },
  {
    id: "gistemp",
    label: "Temperature",
    text: "NASA GISTEMP v4 is credited. Shown figures are examples, not a live feed.",
    linkLabel: "GISTEMP ↗",
    linkHref: "https://data.giss.nasa.gov/gistemp/",
  },
  {
    id: "image",
    label: "Image",
    text: "NASA EPIC (DSCOVR) is a credited reference, not the hero or the GIBS globe.",
    linkLabel: "EPIC ↗",
    linkHref: "https://epic.gsfc.nasa.gov/",
  },
  {
    id: "meteomatics",
    label: "Weather",
    text: "Meteomatics readings appear only when the server is configured.",
    linkLabel: "Meteomatics ↗",
    linkHref: "https://www.meteomatics.com/en/api/",
  },
  {
    id: "hero-image",
    label: "Hero image",
    text: "AI-generated illustration, not a real photo of Earth.",
  },
  {
    id: "si-tools",
    label: "SI tools",
    text: "Grok Bot, ChatGPT, Claude, Antigravity, Codex. Hero is AI-generated; data is not.",
  },
  {
    id: "audio-provenance",
    label: "Audio",
    text: "Tone.js/Web Audio synthesize from data/settings; not AI-made; WAVs carry provenance.",
    linkLabel: "tonejs.github.io ↗",
    linkHref: "https://tonejs.github.io",
  },
  {
    id: "video-provenance",
    label: "Video",
    text: "No AI video included; future videos must show a visible SI watermark.",
  },
  {
    id: "type",
    label: "Type",
    text: "Planet Kosmos by Mads Rydahl, The Planet",
    linkLabel: "dafont.com ↗",
    linkHref: "https://www.dafont.com/planet-kosmos.font",
  },
  {
    id: "ui-type",
    label: "UI type",
    text: "Geist + Geist Mono by Vercel (OFL 1.1)",
    linkLabel: "vercel.com/font ↗",
    linkHref: "https://vercel.com/font",
  },
  {
    id: "layout",
    label: "Layout",
    text: "Orbit Matter template by Codegrid",
    linkLabel: "Codegrid on YouTube ↗",
    linkHref: "https://www.youtube.com/@codegrid",
  },
  {
    id: "react-bits",
    label: "Component",
    text: "FlowingMenu adapted from React Bits",
    linkLabel: "reactbits.dev ↗",
    linkHref: "https://reactbits.dev/",
  },
];

export interface TeamMember {
  readonly name: string;
  readonly role?: string;
  readonly image?: string;
}

export const TEAM: readonly TeamMember[] = [
  { name: "Richard Huynh", role: "Team Leader", image: "/team/squad_img_01.webp" },
  { name: "Erin Sur", role: "Visual & UI Design", image: "/team/squad_img_02.webp" },
  { name: "Quoc Pham", role: "Audio Architect", image: "/team/squad_img_03.webp" },
  { name: "Ryan Wang", role: "Frontend Engineer", image: "/team/squad_img_04.webp" },
  { name: "Aqila Nasiry", role: "Atmospheric Research", image: "/team/squad_img_05.webp" },
  { name: "Irmuun Temuulel", role: "Systems Engineer", image: "/team/squad_img_06.webp" },
] as const;

export const MINI_WAVEFORM_BARS: readonly { readonly h: number; readonly top: number; readonly dim?: boolean }[] = [
  { h: 4.736, top: 11.63 },
  { h: 5.135, top: 11.43 },
  { h: 5.593, top: 11.2 },
  { h: 5.541, top: 11.23 },
  { h: 5.509, top: 11.25 },
  { h: 5.144, top: 11.43 },
  { h: 4.934, top: 11.53 },
  { h: 5.051, top: 11.47 },
  { h: 5.543, top: 11.23 },
  { h: 5.976, top: 11.01 },
  { h: 6.38, top: 10.81 },
  { h: 6.775, top: 10.61 },
  { h: 7.011, top: 10.49 },
  { h: 7.515, top: 10.24 },
  { h: 8.062, top: 9.97 },
  { h: 8.007, top: 10 },
  { h: 7.961, top: 10.02 },
  { h: 7.705, top: 10.15 },
  { h: 7.826, top: 10.09 },
  { h: 8.056, top: 9.97 },
  { h: 8.625, top: 9.69 },
  { h: 9.413, top: 9.29 },
  { h: 9.903, top: 9.05 },
  { h: 10.222, top: 8.89 },
  { h: 11.016, top: 8.49 },
  { h: 11.394, top: 8.3 },
  { h: 11.533, top: 8.23 },
  { h: 11.579, top: 8.21 },
  { h: 11.634, top: 8.18 },
  { h: 11.555, top: 8.22 },
  { h: 11.872, top: 8.06 },
  { h: 12.309, top: 7.85 },
  { h: 12.664, top: 7.67 },
  { h: 13.195, top: 7.4 },
  { h: 13.719, top: 7.14 },
  { h: 14.37, top: 6.82 },
  { h: 14.808, top: 6.6 },
  { h: 15.417, top: 6.29 },
  { h: 15.595, top: 6.2 },
  { h: 15.508, top: 6.25 },
  { h: 15.46, top: 6.27 },
  { h: 15.687, top: 6.16 },
  { h: 16.464, top: 5.77 },
  { h: 17.027, top: 5.49 },
  { h: 17.801, top: 5.1 },
  { h: 18.305, top: 4.85 },
  { h: 18.733, top: 4.63 },
  { h: 19.423, top: 4.29 },
  { h: 20.108, top: 3.95 },
  { h: 20.255, top: 3.87 },
  { h: 20.376, top: 3.81 },
  { h: 20.54, top: 3.73 },
  { h: 20.57, top: 3.72 },
  { h: 21.155, top: 3.42 },
  { h: 22.192, top: 2.9 },
  { h: 22.843, top: 2.58 },
  { h: 23.642, top: 2.18 },
  { h: 24.295, top: 1.85 },
  { h: 24.947, top: 1.53 },
  { h: 25.459, top: 1.27 },
  { h: 26.215, top: 0.89 },
  { h: 26.792, top: 0.6 },
  { h: 26.982, top: 0.51, dim: true },
  { h: 26.625, top: 0.69, dim: true },
];
