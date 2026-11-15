export const ASSETS = {
  // Hero E-a
  heroEarthSky: "/assets/landing/earth-sky.webp",
  heroForegroundAstronaut: "/assets/landing/foreground-moon-astronaut.webp",
  heroTitleEarth: "/assets/landing/ad7d8.svg",
  heroTitleBreathes: "/assets/landing/673a3.svg",
  headerWordmark: "/assets/landing/045ae.svg",
  navBarBg: "/assets/landing/ce1c5.svg",
  soundToggleBg: "/assets/landing/3466a.svg",
  speakerIcon: "/assets/landing/8a890.svg",
  waveIcon: "/assets/landing/d152b.svg",
  primaryPillBg: "/assets/landing/d4b62.svg",
  chipLeftBg: "/assets/landing/9b7c3.svg",
  chipRightBg: "/assets/landing/d0ab6.svg",

  // Theme Picker
  themeCardActiveBg: "/assets/landing/75566.svg",
  themeCardDefaultBg: "/assets/landing/ff67d.svg",
  themeCardFocusRing: "/assets/landing/10a06.svg",
  tagGreenhouseGases: "/assets/landing/ed8e1.svg",
  tagGlobalClimate: "/assets/landing/2d522.svg",
  tagPolarIce: "/assets/landing/8a9c8.svg",
  sparklineCo2: "/assets/landing/092ce.svg",
  sparklineTemperature: "/assets/landing/e6153.svg",
  sparklineSeaIce: "/assets/landing/05238.svg",
  sparklineMethane: "/assets/landing/b0a71.svg",

  // Intro, Teasers (01, 02, 03), Stats
  introHeaderListenToTheAir: "/assets/landing/5f79a.svg",
  displayStory: "/assets/landing/3f3f1.svg",
  displayChapters: "/assets/landing/1f9de.svg",
  chapterTeaser01Bg: "/assets/landing/5db80.svg",
  chapterTeaser02Bg: "/assets/landing/1a4c8.svg",
  chapterTeaser03Bg: "/assets/landing/1a4c8.svg",
  statBgFirstReading: "/assets/landing/631e3.svg",
  statBgRecordHigh: "/assets/landing/3f6d0.svg",
  statBgMonthsRecorded: "/assets/landing/f625a.svg",
  statBgRecordHighMonths: "/assets/landing/0202a.svg",

  // Split CTA
  ctaMarkFaviconA64: "/assets/landing/aa40a.svg",
  ctaTitleTuneIn: "/assets/landing/bbcac.svg",
  splitCardBgChamfer12: "/assets/landing/9800d.svg",
  splitCardStrokeChamfer12: "/assets/landing/6dfc7.svg",
  splitCardPhotoGradient: "/assets/landing/68eb1.svg",
  chartPanelCo2Bg: "/assets/landing/87cdb.svg",
  chartGlobeCo2: "/assets/landing/09fb9.webp",
  chartPolarKeeling: "/assets/landing/6aab8.svg",
  chartDataDot: "/assets/landing/d5fa9.svg",
  chartPanelTemperatureMap: "/assets/landing/17ad6.webp",
  chartLineTemperature: "/assets/landing/3f1e2.svg",
  chartPanelMethaneGlobe: "/assets/landing/26666.webp",
  chartLineMethane: "/assets/landing/5e066.svg",
  chartPanelSeaIceMap: "/assets/landing/9cfb8.webp",
  chartLineSeaIce: "/assets/landing/0768c.svg",
  photoBlackMarble: "/assets/landing/86675.webp",
  photoArtemisEarthset: "/assets/landing/94030.webp",

  // Footer
  footerWordmark: "/assets/landing/3008a.svg",
} as const;

export type ThemeId = "co2" | "temperature" | "sea-ice" | "methane";

export interface ThemeCardConfig {
  id: ThemeId;
  tag: string;
  tagBg: string;
  sparkline: string;
  title: string;
  source: string;
  cadence: string;
  latestDate: string;
  latestValue: string;
}

export const THEME_CARDS: ThemeCardConfig[] = [
  {
    id: "co2",
    tag: "Greenhouse gases",
    tagBg: ASSETS.tagGreenhouseGases,
    sparkline: ASSETS.sparklineCo2,
    title: "CO₂",
    source: "NOAA GML · Mauna Loa · embedded",
    cadence: "Example figures · not a live feed",
    latestDate: "Example · Sep 2026",
    latestValue: "426.07 ppm",
  },
  {
    id: "temperature",
    tag: "Global climate",
    tagBg: ASSETS.tagGlobalClimate,
    sparkline: ASSETS.sparklineTemperature,
    title: "Temperature",
    source: "NASA GISTEMP v4 · example",
    cadence: "Example figures · not a live feed",
    latestDate: "Example · Sep 2026",
    latestValue: "+1.38 °C vs 1951–80",
  },
  {
    id: "sea-ice",
    tag: "Polar ice",
    tagBg: ASSETS.tagPolarIce,
    sparkline: ASSETS.sparklineSeaIce,
    title: "Arctic sea ice",
    source: "NSIDC Sea Ice Index · example",
    cadence: "Example figures · not a live feed",
    latestDate: "Example · Sep 2026",
    latestValue: "4.81 million km²",
  },
  {
    id: "methane",
    tag: "Greenhouse gases",
    tagBg: ASSETS.tagGreenhouseGases,
    sparkline: ASSETS.sparklineMethane,
    title: "Methane",
    source: "NOAA GML · global mean · embedded",
    cadence: "Example figures · not a live feed",
    latestDate: "Example · Jun 2026",
    latestValue: "1934.57 ppb",
  },
];

export const INTRO_COPY = {
  lead: "Since March 1958, a station on a Hawaiian volcano has measured the air once a month. ",
  body: "823 readings later the line still climbs, and it still breathes: down each northern summer as forests inhale, back up each winter. SonifySphere turns that record into sound.",
} as const;

export const CHAPTERS_DISPLAY_HEADER = {
  line1: "Story",
  line2: "Chapters",
  label: "From the story · 3 chapters",
} as const;

export interface ChapterTeaserConfig {
  id: string;
  chapterNumber: string;
  bgSvg: string;
  counter: string;
  title: string;
  image: string;
  imageAlt: string;
  tag: string;
  fact: string;
  listenHref: string;
}

export const CHAPTER_TEASERS: ChapterTeaserConfig[] = [
  {
    id: "chapter-01",
    chapterNumber: "Chapter 01",
    bgSvg: ASSETS.chapterTeaser01Bg,
    counter: "01 / 03",
    title: "The first breath",
    image: "/assets/landing/chapters/chapter-01.webp",
    imageAlt: "AI-generated image: atmospheric observatory on the lava slopes of Mauna Loa at dawn",
    tag: "[ First Reading ]",
    fact: "315.71 ppm · March 1958",
    listenHref: "/listen?chapter=01",
  },
  {
    id: "chapter-02",
    chapterNumber: "Chapter 02",
    bgSvg: ASSETS.chapterTeaser02Bg,
    counter: "02 / 03",
    title: "Every spring, Earth inhales",
    image: "/assets/landing/chapters/chapter-02.webp",
    imageAlt: "AI-generated image: mist rising from a northern forest in spring",
    tag: "[ Seasonal Cycle ]",
    fact: "Seasonal swing ~6 ppm · 2025: 6.14",
    listenHref: "/listen?chapter=02",
  },
  {
    id: "chapter-03",
    chapterNumber: "Chapter 03",
    bgSvg: ASSETS.chapterTeaser03Bg,
    counter: "03 / 03",
    title: "163 records and counting",
    image: "/assets/landing/chapters/chapter-03.webp",
    imageAlt: "AI-generated image: hazy amber horizon at dusk under a warming sky",
    tag: "[ Record Log ]",
    fact: "432.34 ppm · May 2026",
    listenHref: "/listen?chapter=03",
  },
];

export interface StatItemConfig {
  id: string;
  label: string;
  valueText: string;
  numericValue: number;
  decimals: number;
  unit: string;
  bgSvg: string;
}

export const STAT_ITEMS: StatItemConfig[] = [
  {
    id: "first-reading",
    label: "First reading · Mar 1958",
    valueText: "315.71",
    numericValue: 315.71,
    decimals: 2,
    unit: "CO₂ in the air, ppm",
    bgSvg: ASSETS.statBgFirstReading,
  },
  {
    id: "record-high",
    label: "Record high · May 2026",
    valueText: "432.34",
    numericValue: 432.34,
    decimals: 2,
    unit: "CO₂ in the air, ppm",
    bgSvg: ASSETS.statBgRecordHigh,
  },
  {
    id: "months-recorded",
    label: "Months recorded",
    valueText: "823",
    numericValue: 823,
    decimals: 0,
    unit: "Mar 1958 – Sep 2026",
    bgSvg: ASSETS.statBgMonthsRecorded,
  },
  {
    id: "record-high-months",
    label: "Record-high months",
    valueText: "163",
    numericValue: 163,
    decimals: 0,
    unit: "each one a new peak",
    bgSvg: ASSETS.statBgRecordHighMonths,
  },
];

export interface SplitRowMotion {
  rowTop: number;
  leftX: number;
  rightX: number;
  y: number;
  leftRotate: number;
  rightRotate: number;
}

export const SPLIT_ROWS_MOTION: SplitRowMotion[] = [
  { rowTop: 44, leftX: -800, rightX: 800, y: 100, leftRotate: -30, rightRotate: 30 },
  { rowTop: 428, leftX: -900, rightX: 900, y: -150, leftRotate: -20, rightRotate: 20 },
  { rowTop: 812, leftX: -400, rightX: 400, y: -400, leftRotate: -35, rightRotate: 35 },
];
