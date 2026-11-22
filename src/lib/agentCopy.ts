import { CHAPTER_TEASERS, INTRO_COPY, STAT_ITEMS, THEME_CARDS } from "../data/landingData";

export const SITE_URL = "https://www.sonifysphere.earth";
export const SITE_NAME = "SonifySphere";
export const SITE_DESCRIPTION = "Four Earth records you can play. The figures shown are examples, not a live feed.";
export const GITHUB_REPO = "https://github.com/acheronx0577/Earth-Juke-Box-Sonifysphere";

export const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";
export const PLAIN_CONTENT_TYPE = "text/plain; charset=utf-8";

const MARKDOWN_PATHS = ["/", "/about", "/listen", "/challenge", "/contact", "/privacy"] as const;
export type MarkdownPath = (typeof MARKDOWN_PATHS)[number];

export function isMarkdownPath(pathname: string): pathname is MarkdownPath {
  return (MARKDOWN_PATHS as readonly string[]).includes(pathname);
}

function page(path: string): string {
  return new URL(path, SITE_URL).href;
}

export function notFoundMarkdown(): string {
  return [
    "# Page not found",
    "",
    "This page is not on the map. SonifySphere has no document at this URL.",
    "",
    `- [Agent guide](${page("/llms.txt")}): how to use the site, including Accept: text/markdown.`,
    `- [Sitemap](${page("/sitemap.xml")}): the public pages.`,
    `- [Home](${page("/")}): Earth breathes, the Earth Information Jukebox.`,
    "",
  ].join("\n");
}

const HOME_MARKDOWN = [
  `# ${SITE_NAME}`,
  "",
  `> ${SITE_DESCRIPTION} SonifySphere is the Earth Information Jukebox. It turns example NASA and Earth climate records into sound you can play in the browser.`,
  "",
  "Earth breathes.",
  "",
  INTRO_COPY.lead.trim(),
  "",
  INTRO_COPY.body,
  "",
  "## Earth themes",
  "",
  "The homepage shows four example figures. They are not a live feed.",
  "",
  ...THEME_CARDS.map((card) => `- **${card.title}** (${card.tag}). ${card.source}. ${card.cadence}. ${card.latestDate}: ${card.latestValue}.`),
  "",
  "## Story chapters",
  "",
  ...CHAPTER_TEASERS.map((chapter) => `- **${chapter.title}** (${chapter.counter}). ${chapter.fact}. ${chapter.tag}.`),
  "",
  "## Recorded figures",
  "",
  ...STAT_ITEMS.map((stat) => `- ${stat.label}: ${stat.valueText}. ${stat.unit}.`),
  "",
  "## Where to go",
  "",
  `- [Listen](${page("/listen")}): move across a map or open NASA media and hear one data layer.`,
  `- [Challenges](${page("/challenge")}): Guess the Signal, Tune the Signal, and Waveform Ribbons.`,
  `- [About](${page("/about")}): how the Mauna Loa CO₂ record is played as music.`,
  `- [Contact](${page("/contact")}): the project team.`,
  `- [Agent guide](${page("/llms.txt")}).`,
  "",
  `Source: [GitHub](${GITHUB_REPO}).`,
  "",
].join("\n");

const ABOUT_MARKDOWN = [
  "# About / How it sounds",
  "",
  "> SonifySphere plays the Mauna Loa CO₂ record as music. Three voices, one for each pattern in the data.",
  "",
  "The about page explains how the record becomes sound, shows the provenance of the figures, and credits the people who built the project.",
  "",
  "The figures on the site are examples, not a live feed. Listen audio is synthesized in the browser. It is not an AI audio model.",
  "",
  `- [Home](${page("/")})`,
  `- [Listen](${page("/listen")})`,
  `- [Agent guide](${page("/llms.txt")})`,
  "",
].join("\n");

const LISTEN_MARKDOWN = [
  "# Listen",
  "",
  "> Move across an Equal Earth map or open NASA media, pick one data layer, and hear the point under the probe.",
  "",
  "Sound starts when you ask for it. Higher normalized values raise pitch. Zoom changes how near or far the sound feels.",
  "",
  "Public query parameters:",
  "",
  "- `data`: `temp` (default temperature), `co2`, `ch4` or `methane`, `sea-ice`, `all`, `air`, `sea-temp`, `currents`, `wind`, `precip`, `elevation`.",
  "- `source`: a listen source id.",
  "- `lat` and `lng`: probe coordinates.",
  "- `sound`: `on` or `off`. The homepage uses `/listen?sound=on` and `/listen?sound=off`.",
  "",
  "Example: " + page("/listen?data=co2"),
  "",
  `- [Challenges](${page("/challenge")})`,
  `- [Agent guide](${page("/llms.txt")})`,
  "",
].join("\n");

const CHALLENGE_MARKDOWN = [
  "# Challenges",
  "",
  "> Three listening challenges. Sound starts only after you ask for it.",
  "",
  `- [Guess the Signal](${page("/challenge/guess")}): ear training. Hear a short sonified phrase and name the region or the record. Share a round with \`seed\` (an integer). Share a finished result with \`result\`. Resume an open round with \`seed\` and \`resume=1\`.`,
  `- [Tune the Signal](${page("/challenge/match")}): overlap your tone with the Keeling record. Tune frequency and resonance until the two waves match. A shared scorecard uses \`result\`.`,
  `- [Waveform Ribbons](${page("/challenge/ribbons")}): track the seasonal forest inhale by ear. A shared scorecard uses \`result\`.`,
  "",
  "There is also [Compose](" + page("/challenge/compose") + "), which compiles regions and records into a short Earth mixtape. A shared mix uses `mix`.",
  "",
  `- [Listen](${page("/listen")})`,
  `- [Agent guide](${page("/llms.txt")})`,
  "",
].join("\n");

const CONTACT_MARKDOWN = [
  "# Contact",
  "",
  "> The SonifySphere team. Six voices, one Earth record.",
  "",
  "The contact page lists the six people on the project. Inquiries go to richardhuynh0824@gmail.com.",
  "",
  `- [About](${page("/about")})`,
  `- [Agent guide](${page("/llms.txt")})`,
  "",
].join("\n");

const PRIVACY_MARKDOWN = [
  "# Privacy Policy",
  "",
  "> Privacy policy and data governance for SonifySphere.",
  "",
  "SonifySphere is an educational open-source interactive sound installation created for NASA Space Apps 2026. All audio sonification happens directly inside your web browser via the Web Audio API.",
  "",
  "We do not sell user data, track personal browsing habits, or construct advertising profiles. We use browser local storage strictly for functional preferences (performance mode, intro animation seen, sound on/off).",
  "",
  "For privacy questions or data governance inquiries, contact richardhuynh0824@gmail.com.",
  "",
  `- [Home](${page("/")})`,
  `- [About](${page("/about")})`,
  `- [Agent guide](${page("/llms.txt")})`,
  "",
].join("\n");

const MARKDOWN_BY_PATH: Record<MarkdownPath, string> = {
  "/": HOME_MARKDOWN,
  "/about": ABOUT_MARKDOWN,
  "/listen": LISTEN_MARKDOWN,
  "/challenge": CHALLENGE_MARKDOWN,
  "/contact": CONTACT_MARKDOWN,
  "/privacy": PRIVACY_MARKDOWN,
};

export function markdownForPath(pathname: string): string | null {
  if (!isMarkdownPath(pathname)) return null;
  return MARKDOWN_BY_PATH[pathname];
}

export const READABLE_SUMMARY: readonly string[] = [
  "SonifySphere is the Earth Information Jukebox, a free educational website at https://www.sonifysphere.earth. It lets a person hear example NASA and Earth climate records as sound. The page title is Earth breathes. Four Earth records you can play. The figures shown are examples, not a live feed.",
  `${INTRO_COPY.lead.trim()} ${INTRO_COPY.body}`,
  `The four example themes are ${THEME_CARDS.map((card) => `${card.title}, ${card.tag}, ${card.source}, ${card.latestDate} ${card.latestValue}`).join("; ")}. Each card says the figures are examples, not a live feed. Choosing a card changes which example the page highlights. Pick a dataset opens Listen with that layer.`,
  `Three story chapters follow the Mauna Loa carbon dioxide record. ${CHAPTER_TEASERS.map((chapter) => `${chapter.counter} ${chapter.title}: ${chapter.fact} ${chapter.tag}`).join(" ")} The chapters are a way to hear the first reading, the seasonal inhale, and the run of record-high months.`,
  `The recorded example figures on the homepage are ${STAT_ITEMS.map((stat) => `${stat.label} ${stat.valueText} (${stat.unit})`).join("; ")}.`,
  "Listen, at /listen, moves across an Equal Earth map or opens NASA media. One data layer is selected at a time, and the point under the probe is what you hear. Public parameters are data (temp, co2, ch4, sea-ice, all, air, sea-temp, currents, wind, precip, elevation), source, lat, lng, and sound=on or sound=off. Enter with sound uses /listen?sound=on. Enter without audio uses /listen?sound=off.",
  "The challenges are three listening activities. Guess the Signal (/challenge/guess) plays a short phrase and asks which region or record it came from. A round can be shared with seed, a finished result with result, and an open round can be resumed with seed and resume=1. Tune the Signal (/challenge/match) asks you to overlap a tone with the Keeling record by tuning frequency and resonance. Waveform Ribbons (/challenge/ribbons) tracks the seasonal forest inhale by ear. Both of those scorecards can be shared with result. Compose (/challenge/compose) arranges regions and records into a short mixtape and can be shared with mix.",
  "About explains how the Mauna Loa CO₂ record is played as music, with three voices for three patterns in the data, plus provenance and credits. Contact lists the six people on the team. Project inquiries use richardhuynh0824@gmail.com. The source repository is https://github.com/acheronx0577/Earth-Juke-Box-Sonifysphere.",
  "Agents can read this site without executing JavaScript. Request a main page with Accept: text/markdown and the response is Markdown for the same URL, with Vary: Accept. Accept: text/html, and a normal browser Accept header, still receive this HTML page. A URL that does not exist stays HTTP 404. When that request prefers text/markdown, the 404 body is Markdown and links to /llms.txt and /sitemap.xml. The agent guide itself is /llms.txt. A longer copy is /llms-full.txt.",
  "Nothing on the homepage is a live scientific feed. The CO₂, temperature, Arctic sea ice, and methane figures are embedded examples with dates and sources printed on the cards. Downloaded mixes are rendered in the browser from the parameters a person selects. They are not generated by an AI audio model.",
  "Listen can use the example Earth Information Center frames and the public datasets named in the project: NOAA Global Monitoring Laboratory Mauna Loa carbon dioxide, NASA GISTEMP temperature, the NSIDC Sea Ice Index, and NOAA methane. The listen workspace also knows layers for air temperature, sea temperature, ocean currents, wind, precipitation, and elevation. One layer is heard at a time. The probe is the place whose value sets the pitch.",
  "The three listening challenges are the ones linked from the challenge page. Guess the Signal is the ear-training quiz. Tune the Signal lines a tone up with the Keeling record. Waveform Ribbons follows the yearly forest inhale, the same seasonal swing the second story chapter describes. Compose is a separate board for arranging a short mixtape and is not one of those three challenges. Each activity waits for a press before it makes sound.",
  "A person can share a listen link with the data layer and sound preference in the query string, share a guess round with its seed, and share a finished challenge scorecard with result. Those parameters are public. They do not require an account. The same pages answer Accept: text/markdown with this description in Markdown, and answer a normal browser with this HTML page. If a path does not exist, the status stays 404.",
];

export function homepageJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        sameAs: [GITHUB_REPO],
      },
      {
        "@type": "WebApplication",
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        applicationCategory: "EducationalApplication",
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        sameAs: [GITHUB_REPO],
      },
      organizationJsonLd(),
    ],
  };
}

export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    email: "richardhuynh0824@gmail.com",
    sameAs: [GITHUB_REPO],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "richardhuynh0824@gmail.com",
      availableLanguage: ["English"],
    },
    address: {
      "@type": "PostalAddress",
      addressCountry: "US",
    },
  };
}

export function siteNavigationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SiteNavigationElement",
        name: "Listen",
        url: `${SITE_URL}/listen`,
        description: "Move across the map or NASA media, pick a data layer, and hear the sonified Earth record.",
      },
      {
        "@type": "SiteNavigationElement",
        name: "Challenges",
        url: `${SITE_URL}/challenge`,
        description: "Interactive climate ear-training games: Guess the Signal, Tune the Signal, and Waveform Ribbons.",
      },
      {
        "@type": "SiteNavigationElement",
        name: "About",
        url: `${SITE_URL}/about`,
        description: "How the Mauna Loa CO₂ record is played as music, with provenance, data sources, and team credits.",
      },
      {
        "@type": "SiteNavigationElement",
        name: "Contact",
        url: `${SITE_URL}/contact`,
        description: "The SonifySphere project crew and inquiries.",
      },
      {
        "@type": "SiteNavigationElement",
        name: "Story",
        url: `${SITE_URL}/story`,
        description: "Three chapters of the Mauna Loa atmospheric carbon record.",
      },
      {
        "@type": "SiteNavigationElement",
        name: "Privacy Policy",
        url: `${SITE_URL}/privacy`,
        description: "Privacy policy and client-side data governance for SonifySphere.",
      },
    ],
  };
}

export function breadcrumbJsonLd(name: string, path: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name,
        item: `${SITE_URL}${path}`,
      },
    ],
  };
}

export function llmsTxt(): string {
  return [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION} SonifySphere is a free educational Earth Information Jukebox: hear example NASA and Earth climate records as sound in the browser. Figures are examples, not a live feed.`,
    "",
    "Read a main page by requesting it with `Accept: text/markdown`. The same URL returns Markdown, with `Content-Type: text/markdown; charset=utf-8` and `Vary: Accept`. `Accept: text/html`, and a browser's default Accept header, still return the normal HTML. HTML is chosen when it has the higher q-value. A missing URL stays HTTP 404; with `Accept: text/markdown` the body is Markdown and links here and to the sitemap.",
    "",
    "Share links are public query strings. Use only the parameters named below.",
    "",
    "## When to use",
    "",
    `- [Hear NASA and Earth climate datasets as sound](${page("/listen")}): Open Listen, pick one data layer, and hear the point under the probe. Parameters: \`data\` (\`temp\`, \`co2\`, \`ch4\`, \`sea-ice\`, \`all\`, \`air\`, \`sea-temp\`, \`currents\`, \`wind\`, \`precip\`, \`elevation\`), \`source\`, \`lat\`, \`lng\`, and \`sound\` (\`on\` or \`off\`). Example: ${page("/listen?data=co2&sound=on")}.`,
    `- [Sonification examples for education](${page("/")}): The homepage introduces four example records (CO₂, temperature, Arctic sea ice, methane) and three chapters of the Mauna Loa CO₂ record. Use it to explain the project. The numbers on the page are the example figures, not a live feed.`,
    `- [Guess the Signal](${page("/challenge/guess")}): Ear-training challenge. Hear a short phrase and name the region or the record. Share a round with \`seed\` (integer), a finished result with \`result\`, or resume with \`seed\` and \`resume=1\`.`,
    `- [Tune the Signal](${page("/challenge/match")}): Match a tone to the Keeling record by tuning frequency and resonance. A shared scorecard uses \`result\`.`,
    `- [Waveform Ribbons](${page("/challenge/ribbons")}): Follow the seasonal forest inhale by ear. A shared scorecard uses \`result\`.`,
    "",
    "## Pages",
    "",
    `- [Home](${page("/")}): Earth breathes. Four example records and three story chapters.`,
    `- [Listen](${page("/listen")}): Map or NASA media, one data layer, probe audio.`,
    `- [Challenges](${page("/challenge")}): Guess the Signal, Tune the Signal, and Waveform Ribbons.`,
    `- [About](${page("/about")}): How the Mauna Loa CO₂ record is played as music, with provenance and credits.`,
    `- [Contact](${page("/contact")}): The six-person project team. Inquiries: richardhuynh0824@gmail.com.`,
    `- [Story](${page("/story")}): Three chapters of the Mauna Loa CO₂ record.`,
    `- [Sitemap](${page("/sitemap.xml")}): Public URLs.`,
    "",
    "## Optional",
    "",
    `- [Compose a mixtape](${page("/challenge/compose")}): Arrange regions and records, then play or share the mix. Parameter: \`mix\`.`,
    `- [Classic listen globe](${page("/listen/classic")}): Earlier 12-region globe. Parameter: \`sound=on\` or \`sound=off\`.`,
    `- [Full agent guide](${page("/llms-full.txt")}): The same facts, with the page-level Markdown included.`,
    `- [Source code](${GITHUB_REPO}): The public GitHub repository.`,
    "",
  ].join("\n");
}

export function llmsFullTxt(): string {
  const pages = (Object.keys(MARKDOWN_BY_PATH) as MarkdownPath[])
    .map((path) => `## ${page(path)}\n\n${MARKDOWN_BY_PATH[path]}`)
    .join("\n");
  return `${llmsTxt()}\n${pages}`;
}

export function robotsTxt(): string {
  return [
    "User-Agent: *",
    "Allow: /",
    "",
    `# Agent guide: ${page("/llms.txt")}`,
    "",
    `Sitemap: ${page("/sitemap.xml")}`,
    "",
  ].join("\n");
}

export function readableSummaryText(): string {
  return READABLE_SUMMARY.join(" ");
}
