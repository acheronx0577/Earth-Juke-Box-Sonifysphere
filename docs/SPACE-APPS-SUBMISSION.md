# NASA Space Apps 2026 — submission working draft

Prepared from the user-supplied Project Submission Guide dated November 13, 2026 and the current project source. This is a reviewable draft, not a submitted form or a claim of eligibility. The authoritative guide is [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/); the selected project direction is [The Earth Information Jukebox](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/).

## Required fields and current evidence

| Field | Draft / status |
|---|---|
| Project name | SonifySphere — Earth Juke Box. App branding is SonifySphere. |
| Official team / Local Event | Pending confirmation from the registered team page; do not infer from a member's name or machine timezone. |
| High-level summary | Draft below. |
| Project demo link | Pending public demo: video ≤30 seconds OR English slide deck ≤7 slides, including title/intro. |
| Final project link | [Production website](https://earth-juke-box.vercel.app) — verify anonymous access before copying into the form. |
| Detailed description | Draft below. |
| Use of SI | Factual draft below; team review required. |
| NASA data | GIBS imagery used; source/credit distinctions below. |
| Partner data / references | NOAA, NSIDC and other references below; confirm each scientific claim. |

## High-level summary draft

SonifySphere lets people explore Earth through an interactive globe, adjustable soundscapes and listening games. Users choose a place and environmental theme, compare sounds, compose a mix or tune a signal. The prototype combines NASA Earth imagery with a browser-based sound vocabulary intended to make environmental patterns more approachable through hearing as well as sight.

## Detailed description draft

The experience begins with an illustrated Earth scene and a choice to enter with or without sound. Listen now provides an image/video upload and NASA Image and Video Library search workspace, horizontal data-layer controls, a visual pixel probe, matched Meteomatics readings when a user supplies coordinates and time, and browser sound controls. The previous globe interface remains at `/listen/classic`. About explains the intended audio concepts and introduces the six-person team. Three dedicated games support recognition, composition and tuning.

The implementation uses Next.js/React, TypeScript, MapLibre/WebGL, GSAP and Tone.js. Browser audio is activated through user interaction. Numeric parameters and curated presets control note frequencies, oscillator characteristics, envelopes and noise/filter settings. Users can learn the sound vocabulary by changing one control at a time and comparing the result.

Scientific scope must be stated accurately: the current Listen workspace samples visual color and brightness at the pointer. It does not infer geolocation or physical measurements from pixels. The user supplies a location and time for numeric Meteomatics requests. NASA CO₂ is linked as a visualization and is not presented as a numeric measurement. This is a visual-to-sound interaction prototype, not a complete EIC science-data ingestion or validation pipeline. Accessibility work includes labeled controls, keyboard interactions and a sound-off path; this is not a certification of full accessibility compliance.

## NASA data / partner references draft

- **NASA imagery actually requested:** Blue Marble through NASA GIBS, configured in `src/components/listen/ExploreMap.tsx`. Explain how the imagery supports the spatial context of the interactive sound experience. [GIBS documentation](https://nasa-gibs.github.io/gibs-api-docs/).
- **NASA media search:** The new Listen workspace searches the NASA Image and Video Library and opens selected assets through its public API. Search results are media records, not georeferenced science values. [NASA Images API documentation](https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf).
- **Meteomatics measurements:** With server credentials and user-supplied latitude, longitude and UTC time, Listen requests air temperature, sea surface temperature, ocean current speed and wind speed. Availability varies by place and time; show only returned readings. [Meteomatics API documentation](https://www.meteomatics.com/en/api/).
- **NASA EPIC / DSCOVR:** credited in the app; distinguish this credit from the GIBS tile source and from the AI-generated hero illustration. [EPIC](https://epic.gsfc.nasa.gov/).
- **NOAA GML:** Mauna Loa CO₂ narrative reference. The displayed values are embedded in the source; a complete live NOAA data ingestion pipeline is not implemented. [NOAA trends](https://gml.noaa.gov/ccgg/trends/).
- **NOAA CPC / NSIDC:** attributed example Niño 3.4 / ice readouts need exact dataset/date/value validation. [CPC](https://www.cpc.ncep.noaa.gov/), [Sea Ice Index](https://nsidc.org/data/seaice_index/).
- **Retained wind helpers:** ARCO-ERA5 and NOAA GFS utilities exist, but the current Listen experience does not fetch or visualize their wind fields. Do not list them as demonstrated live behavior.
- **Other credits:** Codegrid/Orbit Matter, Planet Kosmos, Geist and third-party libraries. Review rights and attribution before declaring all submitted work original. Do not assert that the complete template or third-party assets were authored by the team.

## Use of Super Intelligence (SI) draft

ChatGPT generated the home hero illustration. The chapter artwork and one representative crew portrait are also AI-generated and visibly labeled in the experience. The About credits identify the hero source, and the page metadata records the broader image use. OpenAI Codex assisted with software code, performance optimization, documentation and repository preparation. Project source data and authored sonification presets are not AI-generated. The live Listen probe uses browser Web Audio; an optional, explicitly requested texture loop uses ElevenLabs when enabled and is labeled AI-generated. The classic downloadable WAV mixes are synthesized with Tone.js and contain RIFF INFO provenance stating that those mixes were not generated by an AI audio model. No AI-generated video is included. The team should verify exact tool attribution for the chapter images and review the final disclosure before submission.

## Team copied from About

| Name | Role |
|---|---|
| Richard Huynh | Team Leader |
| Erin Sur | Visual & UI Design |
| Quoc Pham | Audio Architect |
| Ryan Wang | Frontend Engineer |
| Aqila Nasiry | Atmospheric Research |
| Irmuun Temuulel | Systems Engineer |

Source: `src/data/aboutData.ts` → `TEAM`, rendered by `src/components/about/TeamRegistry.tsx`. These are product credits; confirmed event registration cannot be established from this source file alone.

## Demo storyboard — choose one format

### Video outline (maximum 30 seconds)

| Time | Content |
|---|---|
| 0–3s | Project and confirmed team name; introduce the Earth sonification goal. |
| 3–10s | Show Listen, select a region and trigger sound. |
| 10–18s | Compare a season/theme, then show a short Guess/Compose/Match interaction. |
| 18–25s | Explain the actual NASA imagery use and deterministic sound mapping without claiming automatic EIC frame analysis. |
| 25–30s | Show the public project URL and the intended educational benefit. |

This is a storyboard, not a finished demo asset. Use English or add English subtitles if the spoken video uses another language.

### Alternative deck (maximum seven slides)

1. Project and confirmed team/member names.
2. Selected challenge and audience/problem.
3. Globe-to-listening user journey with an actual screenshot.
4. Actual NASA imagery and partner-data scope.
5. Sound mappings and technology architecture.
6. Three games, verification and limitations.
7. Public project/demo links and next steps.

## Submission checklist from the supplied guide

- [ ] Record the official registered team page, Local Event and applicable timezone; confirm all members' eligibility at the same event.
- [ ] Complete every required field in English.
- [ ] Provide a publicly accessible final-project URL and demo URL; test both without login in a private browser.
- [ ] Keep the video within 30 seconds OR the deck within seven English slides, including title/intro slides.
- [ ] Use linked hosting for video/documents; the Space Apps project page accepts supported images up to 10MB, not direct video/document uploads.
- [ ] Review scientific provenance, SI disclosure, external assets and originality statements.
- [ ] Check that demo/final-project media comply with the guide's restriction on likenesses of persons under 18; the code does not establish members' ages.
- [ ] Confirm event-specific judging times with the Local Lead; they may differ from the global window.
- [ ] Guide window: November 14, 2026, 9:00 a.m. through November 15, 2026, 11:59 p.m., in the Local Event timezone; Universal Event uses the Team Owner's residence timezone. Do not substitute this machine's timezone without confirming the event.
- [ ] The owner reviews the Terms/Originality confirmations and submits through the Space Apps project page before the deadline.
- [ ] Verify the submission-success banner and save the final submitted links. Saving a draft is not submitting for judging.

The five stated judging categories are Impact, Creativity, Validity, Relevance and Presentation. The private GitHub repo currently needs an explicit visibility decision if it will be shared as a judge-accessible source artifact. Deploying a public website does not itself publish this private repository or complete the Space Apps submission.
