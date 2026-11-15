# SonifySphere · Earth Juke Box

**Explore Earth through sight and sound.** SonifySphere is an interactive web prototype that combines an Earth globe, sound controls and listening games to help people explore environmental concepts.

Built for [The Earth Information Jukebox — NASA Space Apps 2026](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/). Earth Juke Box is the repository/workspace name; the application currently presents itself as SonifySphere.

## Project links

- [Source repository](https://github.com/acheronx0577/earth-juke-box)
- [Production website](https://earth-juke-box.vercel.app)
- [Listen workspace design report](public/design/listen-redesign-report.html) (served at `/design/listen-redesign-report.html` when the app runs)
- Project demo: pending — a public video of at most 30 seconds or an English deck of at most seven slides is required by the supplied submission guide.
- [Submission draft and requirements](docs/SPACE-APPS-SUBMISSION.md)
- [NASA Space Apps submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)

The repository is currently private. Judges must be able to open the final project and demo without signing in. A private source link alone does not satisfy that requirement.

## What you can do

| Page | Experience |
|---|---|
| `/` | Enter with or without sound; explore the visual introduction, datasets and story sections. |
| `/listen` | Upload an image or video, search NASA media, probe its visual pattern, view matched Meteomatics readings, and choose a live sound profile. Optional ElevenLabs texture generation requires server credentials. |
| `/listen/classic` | Explore the earlier twelve-region map, datasets, seasons, voices, and sharing controls. |
| `/about` | Learn the intended sound mappings, inspect the record presentation, and meet the team. |
| `/challenge`, `/story` | Browse three activity cards using the animated gallery. |
| `/challenge/guess` | Guess the Signal: identify sound signatures in seeded rounds with explanatory feedback. |
| `/challenge/compose` | Compose Track: arrange environmental sound sources into a mix and share its configuration. |
| `/challenge/match` | Tune the Signal: adjust frequency and Q to match a target. |

The gallery lists Guess the Signal, Tune the Signal, and Waveform Ribbons. Waveform Ribbons opens Listen. Compose Track stays at `/challenge/compose` and is not shown on the carousel.

## How sound works

The classic map uses Tone.js/Web Audio for synthesis and optional orchestral samples. Layer, region, year, season and weather selections feed deterministic pitch, envelope, oscillator, noise and filter settings. The three voice concepts presented in About are pitch for concentration, pulse for seasonal variation and clicks for record events. The new Listen workspace samples image or video color and brightness under the probe and maps the selected visual or measured layer to a browser oscillator. Instrument and variation chips change its sound.

Pixels provide visual features, not scientific measurements or coordinates. Numeric Meteomatics readings require a user-supplied latitude, longitude and UTC time; they are not inferred from the media. The app does not ingest a complete live climate time series. This prototype demonstrates an interaction and sound vocabulary; it is not a calibrated scientific analysis tool.

## Data and visual sources

| Source | Current use and scope |
|---|---|
| [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/) | Blue Marble raster imagery is requested by the interactive globe. See `src/components/listen/ExploreMap.tsx`. |
| [NASA Image and Video Library](https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf) | Search and selected media assets in the new Listen workspace. This public API does not use the NASA Open APIs key. Media records are not numeric science readings. |
| [Meteomatics Weather API](https://www.meteomatics.com/en/api/) | Optional matched air temperature, sea surface temperature, ocean current speed and wind speed, requested server-side with the user's coordinates and UTC time. Availability varies by place and time. |
| [NASA EPIC / DSCOVR](https://epic.gsfc.nasa.gov/) | Credited Earth-image reference in the product. This credit is separate from the actual GIBS globe imagery. |
| [NOAA Global Monitoring Laboratory](https://gml.noaa.gov/ccgg/trends/) | Reference for the Mauna Loa CO₂ narrative and attribution. Displayed figures are embedded in the application rather than fetched as a complete NOAA time series. NOAA is not NASA. |
| [NOAA Climate Prediction Center](https://www.cpc.ncep.noaa.gov/) and [NSIDC Sea Ice Index](https://nsidc.org/data/seaice_index/) | Attributions appear on selected example regional readouts. Their values and dates need source validation before scientific claims in a submission. |
| [ARCO-ERA5](https://github.com/google-research/arco-era5), [NOAA GFS Open Data](https://registry.opendata.aws/noaa-gfs-bdp-pds/) | Retained server-side wind utilities. The current Listen UI does not request wind fields or run visual wind particles. |

Regional example values are labeled where implemented. Some 2026 figures, counts and labels in the interface have not been independently validated. Do not describe all displayed figures as verified observations or all four selectable layers as complete regional datasets; unsupported regional layers show “No data.”

The home hero artwork is an AI-generated illustration with a visible `AI-GENERATED ART · CHATGPT` watermark. Team photographs and scientific Earth imagery remain separate assets. The About credits and page metadata identify ChatGPT's image use and OpenAI Codex's code/documentation assistance. Live probe audio is synthesized in the browser. An optional ElevenLabs action can generate a sound loop after a user click when enabled on the server. Classic downloadable WAV mixes carry RIFF INFO metadata describing their procedural origin. No AI-generated video is included.

## Tech stack

Versions below come from `package-lock.json`, rather than the version ranges in `package.json`.

| Layer | Technology |
|---|---|
| Application | Next.js 15.5.28 App Router, React / React DOM 19.3.1, TypeScript 5.9.3 |
| Styling | Tailwind CSS 4.3.3, CSS, SVG; Geist / Geist Mono and Planet Kosmos |
| Motion | GSAP 3.15.0 / ScrollTrigger, Lenis 1.3.27, Motion 14.14.0 |
| Graphics | MapLibre GL JS 5.24.0, WebGL2 and projected SVG overlays |
| Audio | Tone.js 15.1.22, browser Web Audio API and bundled sample assets |
| Retained data utilities | Zarrita 0.7.5, fetch, Node.js server route handlers |
| Quality | Playwright 1.64.1, ESLint 9.39.5, TypeScript and production builds |
| Hosting | Vercel production deployment connected to this repository's `main` branch |

## Team

Names, roles and portraits are taken from the actual About-page data in [`src/data/aboutData.ts`](src/data/aboutData.ts), rendered by `TeamRegistry`.

| Team member | Role |
|---|---|
| Richard Huynh | Team Leader |
| Erin Sur | Visual & UI Design |
| Quoc Pham | Audio Architect |
| Ryan Wang | Frontend Engineer |
| Aqila Nasiry | Atmospheric Research |
| Irmuun Temuulel | Systems Engineer |

Official Space Apps team registration, Local Event and team-page URL still need to be recorded. Personal GitHub handles have not been inferred from names.

## Run locally

Use a Node.js version supported by the locked Next.js release and npm. Install from the lockfile:

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Next.js. For a production build and local server:

```sh
npm run build
npm run start
```

The main experience does not require credentials or a database. Internet access is needed for external imagery, remote fonts during builds and optional data routes. Audio starts through a user gesture; browser autoplay restrictions apply.

For optional measurements and sound generation in a Codespace or deployment, set `METEOMATICS_USERNAME`, `METEOMATICS_PASSWORD`, `ELEVENLABS_API_KEY`, and `ELEVENLABS_SOUND_GENERATION_ENABLED=true` as server environment variables. Keep them out of Git and client code. The public NASA media search and browser sound work without these credentials; the NASA Open APIs key is not used by this media search.

## Verify

```sh
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npx playwright test e2e/listen-idle.spec.ts e2e/page-transitions.spec.ts e2e/site-assets.spec.ts
```

The prior source snapshot passed 20 focused desktop/mobile checks covering Listen controls, audio gestures, sharing, cursor/hover work, asset warming, transitions and image loading. Some older broad-suite expectations reference superseded About/Challenge layouts; the entire test suite is not claimed green. See [the performance report](docs/Listen-Performance.md).

## Architecture and performance

- `src/app/`: route composition, shared layout and retained wind API handlers.
- `src/components/`: Home, Listen, About, games and shared UI.
- `src/context/SonifyPlayerContext.tsx`: shared sound state and playback orchestration.
- `src/data/`: labels, team, presets, geography and sample manifests.
- `src/lib/`: synthesis, signal/game logic, asset warming and data helpers.
- `public/`: image, SVG, font, portrait and audio assets.

Visual wind simulation is removed; wind remains a sound control. Globe hover uses cached projected SVG outlines instead of repainting the satellite canvas. Cursor animation sleeps when settled. Asset warming and route prefetching prepare likely destinations; transition waits are bounded. PNG/JPEG conversions reduced the measured public-asset total by about 45%, without counting dependencies or build caches as website payload.

## Credits and AI assistance

NASA and NOAA data/image references are listed above. The source credits the Orbit Matter template by [Codegrid](https://www.codegridweb.com/), [Planet Kosmos by Mads Rydahl](https://www.planet.dk/fonts/), and [Geist by Vercel](https://vercel.com/font). Third-party libraries retain their respective licenses. No blanket license or ownership claim over third-party assets is implied.

Codex assisted with code changes, performance work, documentation and repository preparation in this project. Product credits identify the hero illustration as ChatGPT-generated. The team should review the detailed SI disclosure in the submission draft and add any other tools actually used. The live Listen probe is synthesized in the browser. An optional, user-triggered ElevenLabs loop is available only when the server has credentials and `ELEVENLABS_SOUND_GENERATION_ENABLED=true`.

## Submission status

The production target is [earth-juke-box.vercel.app](https://earth-juke-box.vercel.app). Demo media, official team/event identifiers, validated scientific provenance and the final Space Apps form remain pending. This README does not mean the project has been submitted for judging.
