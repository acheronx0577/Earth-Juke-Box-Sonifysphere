# SonifySphere Design System (Observatory layout, SonifySphere colours and fonts)

> **Sign-off gate:** Hades must sign off on these mocks before any build work starts. Nothing here is approved for implementation yet.

This is the system for future pages:

- **From Orbit Matter Observatory:** layout, section structure, spacing, type scale, frames and motion (`sections/00–11`, cited `[nn]`).
- **From SonifySphere today:** colours and fonts, copied from the repo.
- **Repo:** `/workspace/sonify-pr24`, branch `cursor/globe-atmosphere-8854`, HEAD `dffdcb5`, read only.
- **Paths:** short paths are under `src/`.
- **Working reference:** `mocks/css/tokens.css` (every token with its source), `template.css`, `sonify.css`. The About copy is in `About-Spec.md`.

---

## 1. Colour tokens (unchanged, current SonifySphere)

| Token | Value | Source | Use |
|---|---|---|---|
| `--color-bg` | #060b0b | `app/globals.css:69` | page |
| `--color-ink` | #060b0b | `globals.css:70` | text on cream (nav) |
| `--color-cream` | #fff3ea | `globals.css:71` | text, nav bar, progress fill, focus ring, accent |
| `--color-cream-muted` | rgba(255,243,234,.62) | `globals.css:72` | muted body text, button text |
| `--sonify-label` | #a39c95 | `globals.css:77` | mono labels (index, tags, roles, credits, meta, data callouts) |
| `--color-chrome-gray` | #6b635c | `globals.css:73` | control borders, progress track |
| `--color-panel-dark` | #0a0f0f | `globals.css:74` | notched frames (hero, strip panel, footer) |
| `--color-panel` | #0d1414 | `globals.css:75` | cards |
| `--color-line` | rgba(255,243,234,.14) | `globals.css:76` | hairlines, card edges, scanlines |
| `--fill-unlit` | rgba(255,243,234,.22) | `components/landing/LandingEffects.tsx:149,162` | scroll-fill, unlit chars |
| `--grid-line` | rgba(255,243,234,.035) | `globals.css:333` | 60px grid |
| `--grid-hi-border` / `--grid-hi-bg` | rgba(255,243,234,.45) / .02 | `globals.css:339-340` | grid hover cell |
| `--nav-bg` / `--nav-text` / `--nav-underline` | #fff3ea / #060b0b / #060b0b | `globals.css:690, 718, 736` | notch nav |
| `--progress-fill` / `--progress-track` | #fff3ea / #6b635c | `globals.css:1032` | progress bars |
| `--btn-border` | #6b635c | `components/shared/MiniPlayerPill.tsx:195` | outlined buttons |
| `--btn-hover-bg` | rgba(255,243,234,.08) | `globals.css:385` | hover fill, timer pill |
| `--focus-ring` | 1px solid #fff3ea, offset 3px | `globals.css:1069-1071` | `:focus-visible` |

### Rules

- Cream is the only accent.
- Dark text appears only on cream surfaces (the nav, the primary small button, tier-A marker tags).
- Mono labels use `--sonify-label`. Muted body copy uses `--color-cream-muted`.
- Hairlines are decoration, never a control's only edge. Controls use `--color-chrome-gray` (3.36:1).
- Cards on a panel get a 1px `--color-line` edge, because #0d1414 on #0a0f0f is 1.03:1.
- Labels #a39c95: 7.31:1 on #060b0b, 7.12:1 on #0a0f0f, 6.87:1 on #0d1414. AA pass.

### Contrast (computed)

- Cream text: 17.1–18.2:1 on page and panels.
- Muted text: 7.0–7.2:1.
- Nav ink on cream: 18.2:1.
- Button border: 3.36:1.
- Focus ring: 17–18:1.
- Progress fill vs track: 5.4:1; track vs panel: 3.28:1.
- **Hero over the map** (worst case = text on land, cream 11%, no scrim): cream 14.27, cream-muted 6.35, labels #a39c95 5.74, tags/captions on #060b0b chips 18.16, ink-on-cream tag and button 18.16. Marker borders 4.04–11.59 (≥3 for 1.4.11). Land vs water 1.27 (decorative).
- **Voice table:** cream on #0a0f0f 17.70; labels 7.12–7.31.
- **No AA fails.** Full table: `About-Spec.md §13`.

---

## 2. Type

### Font tokens (unchanged, current SonifySphere)

| Token | Stack | Weight | Source |
|---|---|---|---|
| `--font-display` | `"Geist", ui-sans-serif, system-ui, sans-serif` | 700 | `components/about/AboutHeroSection.tsx:44` (font-sans font-bold); stack `globals.css:64` |
| `--font-body` | same | 400 | `globals.css:127`; Geist 400–700 loaded in `app/layout.tsx:11-15` |
| `--font-mono` | `"Geist Mono", ui-monospace, SFMono-Regular, monospace` | 400 / 500 / 700 (nav 700) | `app/layout.tsx:17-21`, `globals.css:65`, `:715` |
| `--font-wordmark` | `"PlanetKosmos", "Planet Kosmos", sans-serif` | 400 | `public/fonts/PlanetKosmos.ttf`, `globals.css:39-60`, `components/landing/FooterSection.tsx:123` |
| (existing) SCHABO | `"SCHABO", sans-serif` via `.font-schabo` | 400/500/700 faces | `public/fonts/SCHABO-Condensed.woff`, `globals.css:3-28`, preload `app/layout.tsx:79`. Existing display font on /challenge (`app/challenge/page.tsx`), 404 (`app/not-found.tsx:14`), landing teaser (`components/landing/IntroAndTeaserSection.tsx`) and play frame (`components/play/PlayFrame.tsx`). Stays as is on those pages. |

### Scale (Observatory) `[11]`

Line-height 0.85 for headings, 1.1 for body. Headings are uppercase.

| Role | Clamp | 1440 / 1024 / 390 | Tracking |
|---|---|---|---|
| h1 | `clamp(4rem,10vw,10rem)` | 144 / 102 / 64 | `--ls-h1: clamp(-2.4px,-0.17vw,-0.8px)` |
| h3 | `clamp(2.5rem,6.5vw,5rem)` | 80 / 67 / 40 | `--ls-h3: clamp(-1.2px,-0.083vw,0px)` |
| card h3 | `clamp(1.5rem,4vw,2rem)` | 32 / 32 / 24 | `--ls-card-h3` |
| body | `clamp(1.125rem,.75vw,1.25rem)` | 18 | 0 |
| body lg | `clamp(1.375rem,.95vw,1.45rem)` | 22 | 0 |
| label (mono, uppercase) | `clamp(.8rem,.75vw,.85rem)` | 12.8 | 1.8px on buttons |

### Geist fit rules

These apply wherever a long word or tight box breaks. Details are in `About-Spec.md §1 Fit changes`.

- Tracking −0.04em on display text that overruns (the repo's own value, `AboutHeroSection.tsx:44`).
- Strip-card titles: `clamp(2rem,3.9vw,3.5rem)`.
- Wordmark: 4vw desktop / 8vw phone.
- Under 360px: step display sizes down.
- Write CO₂ in headings as `CO<span class="sub2">2</span>`.

---

## 3. Spacing and grid `[11]`

- **Steps:** 4 · 12 · 16 · 24 · 40 · 48 · 96 · 120 · 160px.
- **Gutter:** 1rem. **Panel padding:** 6rem desktop, 1rem phone.
- **Max widths:** container 2000; nav 448; footer max-height 1200.
- **Grid:** 60px cells in `--grid-line` (`LandingEffects.tsx:9`, `globals.css:333`). The hover cell is highlighted for 300ms (`LandingEffects.tsx:10`).
- **Radii:** .25rem pill; .5rem image; .75rem card.

---

## 4. Frames and borders `[04] [06] [10] [11]`

### Big frame (hero, panels, footer)

- 64px cuts; top notch 480→432px wide, 44px deep.
- Polygon: `4rem 0, calc(50% − 15rem) 0, calc(50% − 13.5rem) 2.75rem, calc(50% + 13.5rem) 2.75rem, calc(50% + 15rem) 0, calc(100% − 4rem) 0, 100% 4rem, 100% calc(100% − 4rem), calc(100% − 4rem) 100%, 4rem 100%, 0 calc(100% − 4rem), 0 4rem`.
- The repo already ships this exact polygon as `--clip-orbit-matter-console` (`globals.css:78-91`).
- Fill: `--color-panel-dark`.

### Other frames

- **Media card:** 32px octagon chamfer `[09]`, fill `--color-panel`.
- **Phone:** big frames and CTA cards drop the clip `[11]`.
- **Borders:** `--color-line` for decoration; `--color-chrome-gray` for control edges.

---

## 5. Components

### Nav `[02]`

- Observatory notch trapezoid: max 448 × 32, top 1rem.
- Fill `--nav-bg`; mono 700 uppercase links in `--nav-text`.
- Active page: 2px `--nav-underline`.
- 44px hit areas.
- Phone: "SonifySphere / Menu" `<button aria-expanded>`, with a 0.3s clip-path overlay.
- **About first screen:** hidden (`translate(-50%,-160%)`, opacity 0). The hero's MENU (top-left) and wordmark (top-right) own the corners. It slides in (0.4s `cubic-bezier(.65,0,.35,1)`) once `scrollY > heroHeight − 80`. MENU on the hero opens this same nav. z-index 20, above the hero scrim. Other pages: unchanged.

### Map hero (About) — layout from WWF Oceans Futures (hero-refs/06)

Replaces the Observatory hero frame on About. The big frame still exists for the strip panel and footer.

- **Section:** 100svh (min 600), full-bleed, no frame, `overflow:hidden`, on `--color-bg`.
- **Map:** slot `hero-map`, the repo's /listen `map.svg` geometry in our tokens (land `#fff3ea` at 11%, water transparent, basin borders cream 12% dashed, graticule cream 5%).
  - Frame `width:max(100vw,160svh)`, aspect 1440/900, centred.
  - Phone: shifted to `translate(-50%,-53%)` so the central Pacific (Arctic, Mauna Loa, Niño 3.4) is on screen; −60% at ≤359.
- **Scrim:** bottom `rgba(6,11,11,.94 → .78 at 20% → 0 at 46%)` + top `.7 → 0 at 13%`. Phone bottom `.96 → .85 at 34% → 0 at 56%`.
- **Corners:** MENU (Geist 700 22/18px, uppercase, cream, 44px target) top-left; wordmark SVG 28/22px tall top-right. Padding 24×48 / 20×32 (1001–1279) / 16×24 (phone). Same corners as 06; not mirrored.
- **Bottom-left:** h1 two-tone ("How it" `--color-cream-muted` / "sounds" cream), Observatory h1 scale 144 / 102.4 / 64. "Scroll to explore ↓" mono label in `--sonify-label`.
- **Bottom-right:** mono stat label (`--sonify-label`). Number `clamp(2.5rem,5.6vw,5rem)` (80 / 57 / 40), lh .9, −0.04em, two lines (from cream-muted / to cream). Then `btn-sm` primary **Hear it** + secondary **Open the map →**, gap 8px.
- **Phone:** headline, stat and buttons stack left-aligned. Buttons share one row (flex 1).
- Values per width and motion: `About-Spec.md §5`.

### Map marker + tag (new component)

| Part | Tier A (real shipped value) | Tier B (region, repo value is EXAMPLE) |
|---|---|---|
| Square | 52px (44px phone), 1px cream .8 border | 36px, 1px cream .45 border |
| Hatch | `repeating-linear-gradient(135deg, cream .32 0 1px, transparent 1px 6px)` | same at .22 |
| Tag (bottom-right corner, half outside) | 22px, cream fill, ink Geist Mono 700 12px | 20px, `--color-bg` fill, cream .45 border, cream 11px |
| Caption | 12px mono uppercase cream on a `--color-bg` chip with a `--color-line` edge, 18px right (phone: under the tag); hidden ≤359 | none |
| Tip (hover / focus / open) | `--color-panel-dark`, 1px cream .45 border, 12–14px padding, 250–300px: name (cream 700), value + source (`--sonify-label`) | same, with "Region on the /listen map" |
| Press = **select, no sound** | 2px cream border, denser hatch (cream .6, 1px / 4px), focus moves to the marker (focus ring), tip pinned open with "■ Selected · press again to clear", `aria-pressed=true`. One selected at a time; press again to clear | same; the tag flips to the cream / ink tier-A look |

- **Rules:**
  - Squares only, never circles.
  - Hit area ≥44×44 (`::after`).
  - Focus ring = `--focus-ring` on the square.
  - Tips right of 70% open leftward.
  - Tag, caption and tip are `aria-hidden`; the `<button>` `aria-label` carries the name, value, source and the action.
- **Data:** only datasets and regions the repo ships (`About-Spec.md §5` table), kept in `mocks/hero-data.js`. Phone shows tier A only.
- **Motion:** squares stagger in (scale .6 → 1, 0.06s, 0.45s power3.out), then the tag clip-reveals left to right, then the caption flickers. Reduced motion: static.

### Voice table (About intro, new component)

- A ruled grid. Desktop columns: row labels 176px (136px at 1001–1279) + 3 × 1fr. Rows: Voice / Tracks / Sounds like / Hear.
- **Cells:** 1px `--color-line` rules, padding 24px (20px). Voice row on `--color-panel-dark` with mono index + h3 (80 / 66.56 / 40).
- **Copy:** Geist 400 20px cream. Labels mono `--sonify-label`.
- **Glyph:** 48px (36px phone), cream, full cell width:
  - rise = repo waveform bars (`aboutData.ts:110-175`)
  - sine = schematic
  - ticks = schematic
- **Hear:** `btn-sm` per voice. On phone it becomes a 44×44 icon button in the card header (`aria-label`).
- **Phone:** each voice becomes a bordered card: header (index + name + Hear), then "Tracks" / "Sounds like" labelled rows and the glyph.
- **Motion:** rules draw (scaleX), cells slide (stagger .1 rows / .12 columns), glyphs wipe in. Reduced motion: static.

### Button (`a.btn` shape; build as `<button>`) `[00]`

- 65px tall, min-width 200.
- Mono 400, 1.8px tracking, `--color-cream-muted` text.
- Fill `--color-bg`, border `--btn-border`, cream corner lines.
- **Hover:** lines move to the corners; text cream + `--glow`; 0.3s ease.
- **Focus:** `--focus-ring`.
- **Small (`btn-sm`, new):** 44px tall, padding 0 20px, 1.4px tracking, corner ticks 28px / 12px. **Primary** variant: `--color-cream` fill and border, `--color-ink` text (18.16:1); playing bars ink; loading ink at 72%. Secondary: the normal `a.btn` colours.

### Card `[06]`

- `--color-panel` with a 1px `--color-line` edge; radius .75rem; padding 1.5rem.
- Index + tag (muted), icon slot 30%, title, body, action.

### Card strip `[06]`

- **3 cards** (Data / Map / Play, numbered 01–03 / 03). Track `calc(175% − .75rem)` (phone `calc(300% + 3rem)`), so card width is unchanged. Gap 1.5rem; linear x.
- Pin **2×vh** (applied, Arthur 4:36 PM), down from 5×vh: travel is now 900px @1440 and 700px @390 (was 3040 / 1750). See `About-Spec.md §7`. Mock hook: `data-pin-vh="2"` on the section, plus `?stripy=<px>`.
- 4px progress bar: `--progress-fill` on `--progress-track`.

### Record field (About §8, new component)

- A data chart drawn as an inline SVG at the container's pixel size; mono 12px labels (11px for tags).
- **Rules:**
  - Plot only values the repo publishes. Each point carries its file citation in `mocks/record-data.js`.
  - Any connecting line between points is dotted and labelled "straight line between published points, not the monthly curve".
  - Counts (months) are drawn as marks, never as invented values.
- **Parts:**
  - ppm gridlines (cream .08) with `--sonify-label` mono labels
  - 10–12px cream **square** points with an 18px cream letter tag (ink Geist Mono 700)
  - dotted cream .22 drop lines
  - a 1px-per-month bar field (cream .2; January .55, 4px taller) with decade labels
  - a square bracket + connector + zoom panel (`--color-panel-dark`, cream .45 edge) for points that are too close together
- **Notes row:** 3 columns at every width (A Mar 1958 / B May 2026 record / C Sep 2026 latest). Each has a `--color-line` top rule and a square tag; date in mono label colour; value Geist 700 `clamp(2.5rem,4.4vw,4rem)` with mono "ppm" (phone: 26px value, "ppm" on its own line, 12px date and role); role mono cream-muted.
- **Caption row:** mono `--sonify-label`, space-between (stacked on phone).
- **Motion:** gridlines fade → bar field clip-sweeps → points pop with segments drawing → zoom panel → notes slide. Reduced motion: static.
- **A11y:** `role="img"` + full `aria-label`; the notes repeat every value as text.

### Team arc `[08]`

- Pin 7×vh, 150px counter, arc formula (`About-Spec.md §9`).
- Marks: `--color-panel` with cream bars, no sepia.

### Notes / alerts

- Mono 12.8px `--color-cream` with a "!" marker, `role="status"`, under the control.
- No colour-only meaning.

### Footer `[10]`

- Notched `--color-panel-dark` panel: h3 + actions, credits, muted mono links, `--font-wordmark` wordmark.

---

## 6. Motion `[00]` (Observatory, unchanged)

| Rule | Value |
|---|---|
| Lenis | duration 1.2 / 0.8, lerp 0.1 / 0.075, syncTouch, gsap ticker, lagSmoothing(0) |
| slide | lines yPercent 100→0, 0.75s power3.out, stagger .1, "top 70%", once |
| flicker | chars 0.05s power2.inOut, random stagger .5, "top 85%" |
| scroll-fill | not used on About any more (intro replaced). Kept as a system rule for other pages |
| map hero intro | map fade + land draw-in 1.2s power2.out → headline slide 0.4s → markers 0.9s + 0.06s stagger → tags clip-reveal → stat and buttons 1.1–1.35s |
| record field | grid fade 0.4s → month field clip-sweep 1.2s power2.out → points pop .3s stagger .15 + segments draw → zoom panel 0.5s → notes slide |
| voice table | rules scaleX 0.6s → cells slide stagger .1 / .12 → glyph wipe 0.8s |
| pins | strip 2×vh (3 cards), team 7×vh, linear scrub |
| small UI | 0.3s ease (buttons), 0.3s power1.out (counter), 0.5s power1.out (CTA lines) |

**Reduced motion:**

- Lenis off; reveals show their end state.
- The strip becomes a scroll-snap row; the arc becomes a grid; the CTA is static.
- Scanlines and playing bars still.
- Map hero: map, markers, tags and captions shown at once; no draw-in or stagger. Voice table static. Nav swap instant.
- Transitions become a 150ms fade.

---

## 7. Sound controls

- **No autoplay.** Audio starts only from a press (click / Enter / Space) on a Hear control. The AudioContext is created or resumed inside that handler.
- **States:** idle ▶ → loading "Starting…" (muted, `aria-busy`) → playing (cream, glow, cream bars, `aria-pressed=true`) → error ("!" note).
- One source at a time; press again to stop. This covers hero Hear it and the three intro voice buttons. **Hero map markers make no sound** (press = select). Hover and focus never play.
- The mini-player uses the same states with 44×44 targets.

---

## 8. Responsive

- **One breakpoint:** 1000px `[00]`. Clamps scale type.
- **Phone:**
  - Map hero: Pacific crop, 3 tier-A markers, headline → stat → buttons stacked (320: 2 markers, no captions).
  - Voice table becomes 3 stacked cards; other columns stack.
  - Strip cards 326×540; team cards 375×500.
  - CTA cards visible below the copy.
- **Fit changes:** 1001–1279px card titles, phone counter, under 360px steps (`About-Spec.md §1`).
- **Reflow:** no horizontal scroll at 320. Flying and pinned layers sit in `overflow-x: clip` sections.

---

## 9. Old → new

Colours and fonts are unchanged. Only non-colour items change.

| Item | Old (repo today) | New | Pages affected |
|---|---|---|---|
| Colours (all tokens in §1) | current SonifySphere | **unchanged (current SonifySphere)** | — |
| Fonts (Geist, Geist Mono, Planet Kosmos, SCHABO where it is used today) | current SonifySphere | **unchanged (current SonifySphere)** | — |
| Heading scale | About h1 148px / −6px, h2 32–40px (`AboutHeroSection.tsx:44`, `AboutMapBand.tsx:6`) | Observatory scale: h1 `clamp(4rem,10vw,10rem)`, h3 `clamp(2.5rem,6.5vw,5rem)`, lh .85, uppercase | About, and any page adopting the system |
| Page structure | current About sections | map hero (WWF Oceans Futures layout) → voice table → Observatory strip (3 cards: data / map / play) → headline + Mauna Loa record field (no map) → team arc → CTA (card 06 keeps the map) → footer | About |
| About hero | framed globe hero, "How it sounds", pill buttons | full-bleed /listen map with square data markers, MENU + wordmark corners, stacked headline, 315.71 → 432.34 ppm stat, Hear it + Open the map | About only |
| About nav | always visible | hidden on the hero's first screen, slides in after it | About only |
| Motion | current About reveals | Observatory slide / flicker / scroll-fill / pins (§6) + reduced-motion fallbacks | About |
| Buttons | cream pill buttons (`PrimaryPillButton`) | `a.btn` 65px corner-line button in our colours | About; later landing, /listen, Challenges |
| Nav shape | 28rem × 2rem cream trapezoid (`globals.css:661-692`) | Observatory 448 × 32 trapezoid: same size and colours, adds the 44px hit area | all |
| Mini-player targets | 36px | 44×44 | all |

---

## 10. Swapping fonts and images

**Fonts**

1. Change one token in `css/tokens.css`: `--font-display`, `--font-body`, `--font-mono` or `--font-wordmark`. Weights are in `--font-display-weight`, `--font-body-weight` and `--font-nav-weight`.
2. Update the `@import` / `@font-face` lines at the top of `tokens.css`. In the app, these are `app/layout.tsx` (next/font) and `globals.css:3-60`.
3. Keep a same-class fallback stack.
4. Re-check the Geist fit rules (§2). They exist because Geist 700 is wide; a narrower face may not need them.
5. Update the footer "[ Type: … ]" credit, which is plain content.

No component CSS names a font; everything goes through `var(--font-*)`.

**Images**

1. Put the file in `assets/slots/`.
2. Edit that slot's `src` / `focal` / `fit` / `alt` in `slots.js`. Markup only says `<img data-slot="…">`.
3. Follow the slot's aspect ratio, minimum size and format (`About-Spec.md §14`):
   - hero-map: SVG 1440×900 frame (marker positions are % of it). To swap the map, keep the same projection and frame, or recompute `hero-data.js`.
   - map-visual: no longer used on About (§8 is the record field). The chart has no image slot; its data lives in `record-data.js`.
   - strip-01…06: 1:1 SVG, #fff3ea strokes.
   - cta-logo: 1:1.
   - cta-01…06: 1368×720 WebP.
   - wordmark: SVG.
4. Team marks are generated from names. Photos can later use the same 425:575 slot, with the Observatory sepia filter for photos only.

---

## 11. References for the new hero and intro (all opened)

- **Hero layout:** 06 WWF Oceans Futures: https://www.oceansfutures.org/ · https://www.awwwards.com/sites/wwf-oceans-futures (HM, Mar 5, 2024) · `hero-refs/06-wwf-oceans-futures.png`
- **Hero sound gate / mono control:** Chladni: https://chladni-plate-experiment.vercel.app/ · https://www.awwwards.com/sites/chladni-a-geometry-of-sound (HM, Oct 10, 2026)
- **Mono data readout:** Spectral Field: https://www.robfwa.com/ · https://www.awwwards.com/sites/spectral-field (HM, Jul 19, 2026)
- **Intro, three-column how-it-works (Mobbin):** Epidemic Sound https://mobbin.com/sites/sections/be226de3-cd2f-4c03-846e-c4ca6d3b74f9 · Profound https://mobbin.com/sites/sections/bcbd4f60-c3c6-4f28-9bba-ddc882809df7

## 12. Open questions for Hades

**Resolved by Arthur (4:27 PM):**

- Niño 3.4 stays +2.84 °C. The map SVG layer label "+1.6 °C example" is stale.
- The 9 tier-B markers stay.
- The §8 map is replaced by the record field.
- The strip is trimmed to 3 cards.
- Markers have no sound (press = select).

**Resolved by Arthur (4:36 PM):**

- The record field drops the 1990 / 354 ppm point: 3 points, re-lettered A–C.
- Strip pin is 2×vh.

**Still open:**

1. **Preloader rings:** the copied preloader uses rings and discs (circles). Keep them exactly, or swap in bars to match the team marks?
2. **Team roles:** what are the roles for Erin Sur, Quoc Pham, Ryan Wang, Aqila Nasiry and Irmuun Temuulel? They are blank and flagged now. Should the name-letter marks stay, or are photos coming?
