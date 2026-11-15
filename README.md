# SonifySphere · Earth Juke Box

**Explore Earth through sight and sound.** SonifySphere is an interactive web platform and NASA Earth data sonification engine that transforms satellite imagery, scientific observations, and Earth Information Center (EIC) visualizations into responsive soundscapes and educational listening experiences.

Built for [The Earth Information Jukebox — NASA Space Apps 2026](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/).

---

## Project Links

- **Live Production Site:** [https://www.sonifysphere.earth](https://www.sonifysphere.earth) (deployed on Vercel)
- **Source Repository:** [https://github.com/acheronx0577/earth-juke-box](https://github.com/acheronx0577/earth-juke-box)
- **Listen Workspace Design Report:** Served at `/design/listen-redesign-report.html`
- **Submission Details & Requirements:** [docs/SPACE-APPS-SUBMISSION.md](docs/SPACE-APPS-SUBMISSION.md)
- **Challenge Page:** [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/)

---

## NASA Challenge Compliance: EIC Visual Core

In accordance with the Space Apps Challenge requirements, the visual core of SonifySphere directly integrates and sonifies official **NASA Earth Information Center (EIC)** and **Scientific Visualization Studio (SVS)** assets:

| Asset ID | Title & Scientific Scope | Visual Format & Integration | Sonification Role |
|---|---|---|---|
| **SVS 5101** | **Sea Surface Temperature (Near Real Time, EIC)** | Daily update print still (`sst_mur_most_recent_print.jpg`) | **Default visual core on `/listen`**. Probing derives SST values calibrated against the official color bar. |
| **SVS 5196** | **DYAMOND Global Carbon Dioxide** | 1080p simulation animation & print still | Replaces mock representations with high-resolution global atmospheric CO₂ density probing. |
| **SVS 3912** | **Global Sea Surface Currents & Temperature (ECCO2)** | 2048×1024 equirectangular frames & ocean flow | Animates ocean circulation vectors; speed and thermal gradients modulate audio timbre. |
| **SVS 5011** | **ISS Lightning Events (2017–2023)** | 1080p animation frames from space station optical sensors | Percussive trigger pulses synchronized to detected lightning bursts. |
| **SVS 13786** | **Caldwell 73 Sonification** | Conceptual reference only | Guides the conceptual mapping schema (luminosity to volume, spatial coordinate to pitch). |

### Real-World Value Derivation
Unlike naive pixel-to-frequency conversions, SonifySphere parses the official color bars from SVS visualizations (e.g. SVS 3912 SST, SVS 5196 CO₂ ppm, MERRA-2) into structured value lookup tables. Probe coordinates extract pixel color values, map to calibrated scientific units (°C, ppm, m/s), and clearly label results as *"derived from SVS color bar"*. Masked pixels or land boundaries return `null` rather than misleading zero readings.

---

## Data Providers & API Architecture

SonifySphere orchestrates an ecosystem of public NASA APIs, cloud-native satellite STAC services, and procedural sound engines:

| Provider | Datasets / Services | Integration Strategy |
|---|---|---|
| **NASA SVS / EIC** | SVS 5101, 5196, 3912, 5011, 13786 | Server-proxied streaming via `/api/listen/svs/*` with strict registry validation. |
| **NASA GIBS** | Blue Marble WMTS raster tiles & MERRA-2 air temperature | Interactive WebGL globe rendering (`/api/listen/gibs-colormap/tile`). |
| **NASA EPIC** | DSCOVR whole-Earth polychromatic imagery | Full-disc Earth natural-color frames (`/api/listen/epic`). |
| **NASA EONET v3** | Earth Observatory Natural Event Tracker | Live wildfire, storm, and volcanic event pulses (`/api/listen/events`). |
| **NASA POWER** | Prediction of Worldwide Energy Resources | Automatic, fail-closed meteorological fallback (`/api/listen/power`). |
| **NASA Media Library** | NASA Images and Video Archive | Asset discovery and server-cached previews (`/api/listen/nasa/*`). |
| **Microsoft Planetary Computer** | STAC search & point sampling: `modis-11A1-061`, `modis-14A1-061`, `sentinel-2-l2a`, `landsat-c2-l2`, `era5-pds`, `noaa-cdr-sea-surface-temperature` | Server-side point raster extraction with scale/offset correction (`/api/listen/pc/*`). |
| **Microsoft Azure** | Azure Blob Storage & Queue Storage | Multi-tier satellite scene caching, background jobs, and guest session isolation. |
| **Meteomatics** | Real-time atmospheric & oceanic point queries | Cached observations with instant NASA POWER fallback. |
| **ElevenLabs** | AI text-to-speech & procedural sound textures | Ambient loops (glass, strings, mallet, pulse), strictly labeled as AI-generated. |
| **NOAA GML & CPC** | Mauna Loa CO₂ Keeling Curve & Equal Earth SST | Verified baseline climate datasets and historical reference trends. |
| **NASA GES DISC** | OCO-2 column-averaged CO₂ observations | Reference validation for greenhouse gas density models. |

---

## What You Can Do

| Route | Experience |
|---|---|
| `/` | Interactive 3D Earth globe, audiovisual introduction, dataset catalog, and story journeys. |
| `/listen` | **Listen Workspace**: Explore NASA EIC visual core frames, upload media, probe pixels for calibrated scientific readings, select sound profiles, and listen with zoom-based proximity audio. |
| `/listen/classic` | 12-region interactive globe with seasonal cycles, atmospheric layers, Tone.js voice controls, and downloadable WAV mixes with embedded RIFF INFO metadata. |
| `/about` | Audio theory deep-dive (*Pitch = PPM*, *Pulse = Seasons*, *Click = Records*), full provenance disclosure, team gallery, and interactive credits marquee. |
| `/challenge` | Audio activity hub featuring interactive challenges. |
| `/challenge/guess` | **Guess the Signal**: Identify environmental sound signatures across seeded rounds with instant educational feedback. |
| `/challenge/match` | **Tune the Signal**: Calibrate frequency and resonance (Q factor) to match target planetary audio signatures. |
| `/challenge/compose` | **Compose Track**: Multi-track ambient mixer arranging natural Earth sound sources into custom mixes. |

---

## Security & Architecture Posture

SonifySphere enforces enterprise security and zero-trust engineering standards:

1. **Zero Hardcoded Secrets (Hard Rule):** All API keys and connection strings (`NASA_API_KEY`, `AZURE_STORAGE_CONNECTION_STRING`, `METEOMATICS_*`, `ELEVENLABS_*`) are read strictly from environment variables. Missing credentials trigger graceful, fail-closed degradation (e.g. automatic NASA POWER fallback).
2. **Strict SSRF Immunity:**
   - Image and video proxies (`/api/listen/nasa/image`, `/api/listen/svs/*`, `/api/listen/epic/image`, `/api/listen/gibs-colormap/tile`) strictly enforce protocol (`https:`) and hostname allowlists (`images-assets.nasa.gov`, `svs.gsfc.nasa.gov`, `epic.gsfc.nasa.gov`, `gibs.earthdata.nasa.gov`).
   - SVS requests resolve only against hardcoded, vetted asset IDs in `SVS_REGISTRY`. Client cannot inject arbitrary URLs.
   - NASA asset IDs are sanitized against directory traversal (`..`), path separators, control characters, and null bytes (`isSafeNasaId`).
3. **Client IP Rate-Limiting:** External provider endpoints (`/api/listen/measurements`, `/api/listen/sound-variation`) enforce sliding-window rate limits per client IP, returning standard HTTP 429 and `Retry-After` headers.
4. **Multi-Tier Satellite Caching:**
   - **Tier 1:** In-memory LRU isolate cache (`MeasurementCache`) for sub-millisecond warm-instance responses.
   - **Tier 2:** Microsoft Azure Blob Storage (`satellite-cache`) for persistent, cross-instance scene storage.
   - **Tier 3:** HTTP `Cache-Control: public, s-maxage=2592000, stale-while-revalidate=604800` headers for edge CDN efficiency.
5. **Security Headers:** Global headers enforce `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
6. **Guest Session Tokens:** Anonymous users can enqueue and claim background satellite jobs through server-issued guest session identifiers without requiring third-party authentication or tracking cookies.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15.5.28 (App Router, Node.js runtime route handlers) |
| **Frontend** | React 19.3.1, TypeScript 5.8+, Tailwind CSS 4.1.4 |
| **Typography & Icons** | Geist / Geist Mono (Vercel), Planet Kosmos, Hugeicons |
| **Motion & Smooth Scroll** | GSAP 3.13, Motion 14.14, Lenis 1.3 |
| **Audio Engine** | Tone.js 15.1.22, Web Audio API, procedural oscillators and filters |
| **Mapping & Raster Data** | MapLibre GL 5.24, WebGL2, Zarrita (Zarr v2/v3), pngjs pixel analysis |
| **Cloud & Jobs** | Microsoft Azure Blob Storage, Azure Queue Storage, Microsoft Planetary Computer |
| **Testing & Quality** | Playwright 1.64.1 (@axe-core/playwright), Node test runner, ESLint 10 |

---

## Local Development & Setup

### Prerequisites
- Node.js 20+ (LTS recommended)
- npm 10+

### Installation
```sh
# Clone repository
git clone https://github.com/acheronx0577/earth-juke-box.git
cd earth-juke-box

# Install exact locked dependencies
npm ci
```

### Environment Configuration (Optional)
Create a `.env.local` file in the project root for optional external providers. The core application runs fully offline with simulated fallbacks if keys are omitted:

```env
# Optional: NASA Open APIs (defaults to DEMO_KEY if unset)
NASA_API_KEY=your_nasa_api_key

# Optional: Microsoft Azure Storage for durable satellite scene caching
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net

# Optional: Microsoft Planetary Computer
PLANETARY_COMPUTER_API_KEY=your_pc_key

# Optional: Meteomatics Weather API (NASA POWER automatically serves as fallback if unset)
METEOMATICS_USERNAME=your_username
METEOMATICS_PASSWORD=your_password

# Optional: ElevenLabs AI Narration and Textures
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_SOUND_GENERATION_ENABLED=true

# Canonical URL
NEXT_PUBLIC_SITE_URL=https://www.sonifysphere.earth
```

### Running Locally
```sh
# Start development server
npm run dev

# Or build and run production server
npm run build
npm run start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Quality Verification & Test Suite

SonifySphere maintains a comprehensive, automated test matrix:

```sh
# 1. Typecheck (TypeScript 5.8+)
npm run typecheck

# 2. Linting (ESLint 10)
npm run lint

# 3. Unit tests (Audio logic, reading context, layer ranges, proximity audio)
npm run test:unit

# 4. Planetary Computer multi-collection & security tests
npm run test:planetary-computer

# 5. Azure satellite jobs and caching lifecycle tests
npm run test:satellite-jobs

# 6. NASA SVS media and EIC frame integrity tests
npm run test:svs
npm run test:eic

# 7. Production build verification
npm run build

# 8. Full Playwright E2E test suite (47 tests: contracts, QA, proximity, transitions, assets)
npm run test:e2e
```

---

## Team & Credits

### Team
- **Richard Huynh** — Team Leader (`AcheronX. <richardhuynh53@gmail.com>`)
- **Erin Sur** — Visual & UI Design
- **Quoc Pham** — Audio Architect
- **Ryan Wang** — Frontend Engineer
- **Aqila Nasiry** — Atmospheric Research
- **Irmuun Temuulel** — Systems Engineer

### Disclosures & AI Transparency
- **Scientific Data:** Sourced directly from official NASA, NOAA, and Microsoft Planetary Computer endpoints.
- **Audio Synthesis:** Synthesized programmatically in-browser via Tone.js and Web Audio API from real scientific parameters. Generated WAV files carry RIFF INFO provenance tags.
- **AI Art & Texture Disclosure:** The home hero, chapter artwork and one representative crew portrait are AI-generated and visibly labeled in the experience. ChatGPT generated the home hero. Optional ElevenLabs audio loops are explicitly disclosed and tagged as AI-generated.
- **Design & Layout:** Orbit Matter template architecture by [Codegrid](https://www.codegridweb.com/); FlowingMenu adapted from [React Bits](https://reactbits.dev/).
