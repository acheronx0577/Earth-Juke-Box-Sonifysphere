# Website performance audit and weather-map comparison

Date: 2026-11-14. Source base: b59aed34a27a05651df7d2b2126305c610b2772d.

## Final decision: sound-only wind

The user chose to remove visual wind instead of accepting its rendering/quality tradeoffs. Listen no longer imports the wind renderer, allocates its particle textures, creates an animation overlay, or requests live wind fields/statistics. The wind slider continues to change the existing audio parameters and is labelled WIND SOUND. Region picking, drawing, datasets, weather presets, seasons, timeline, and playback remain available.

The now-unused client particle renderer and wind-data hooks were removed during cleanup. The independent server routes and wind-processing utilities remain available for future work; the current Listen UI does not request them. Git history retains the removed implementation.

## Why it became slow after startup

Once the wind field arrived, the previous custom layer called Map.triggerRepaint on every animation frame. This continuously redrew the satellite globe and outlines even with a stationary camera. The inspected in-app browser reported Microsoft Basic Render Driver through ANGLE: software graphics rendering.

At 1452 × 843 CSS pixels and DPR 1.4, the original implementation measured 8.85 UI frames/s with wind, versus 138.7 frames/s with wind off. The p95 frame interval was 178 ms with wind and 7 ms without. An independently animated wind-canvas prototype improved performance, but was discarded after the user's sound-only decision. Those prototype results are not measurements of the final implementation.

This explains the activation-related slowdown. It does not establish that every browser uses software rendering or that the original site suffered a steadily growing heap leak.

The final foreground sample measured 142.8 UI frames/s and a 7 ms p95 interval, with zero wind requests and only the base-map canvas. That sample used a changed browser viewport (1037 × 602 CSS pixels, DPR 1.96), so it is not a controlled before/after FPS ratio. A separate regression test confirmed zero stationary-map draw calls after initialization, including after changing WIND SOUND to 100%.

## Applied website optimizations

| Change | Evidence / behavior |
| --- | --- |
| Remove visual wind and weather-data requests | No particle simulation or continuous map repaint loop; sound intensity remains adjustable. |
| Seasonal images | Five PNGs: 617,931 → 71,006 bytes, unchanged dimensions. |
| Home, About, and Challenge images | Thirteen optimized image groups replace fourteen originals: 9,787,553 → 2,240,856 bytes. One identical image is shared by URL. |
| Overall public assets | 17,818,605 → 9,724,983 bytes: 8,093,622 bytes saved, or 45.4%. These are deployed static-file totals, not the transfer size of one page. |
| Image quality | Photo dimensions preserved; quality 90 or 96 WebP, with minimum measured photo PSNR 38.29 dB. Four chart conversions preserve visible pixel colours and alpha exactly. Transparent hidden RGB bytes may differ. Original/optimized comparison montage visually inspected. |
| Lazy images | Below-fold About routine/team photos and home CTA illustrations defer loading and decode asynchronously. |
| Audio startup | Both automatic Tone imports removed. The roughly 78.8 KB compressed audio chunk is requested through playback actions instead of initial page load; browser inspection confirmed it absent before playback. |
| Audio timer lifetime | Completed ensemble timer IDs are removed from the active set, preventing the bookkeeping list from growing throughout a long session. |
| Hero GPU work | Idle breathing renders at up to 30 fps; pointer interaction retains up to 60 fps. Its timing, appearance, and existing visibility/reduced-motion behavior remain. |
| Carousel work | Autoplay does not advance hidden/offscreen carousels. |
| About scrolling | Counter transitions are created only when their target actually changes. |
| Listen startup | Disable the global smooth-scroll ticker and navigation-link prefetching while viewing the map. |

The production build reports about 218 KB initial Listen JavaScript, versus 226 KB before these changes. MapLibre is still dynamically loaded and transfers about 273 KB compressed in this local build.

## Public weather-map implementation comparison

Inspected public pages and their delivered JavaScript on 2026-11-14. Private server code and native app implementations were not inspected. No proprietary source was copied into application code.

| Site | Observed implementation |
| --- | --- |
| Windy.com | Its gl-particles module in release 51.4.4.ind.c444 independently controls density, width, and speed; amount is viewport/zoom dependent and capped at 15,000, with further mobile reduction. GPU particle state and cached back textures are used. It still requests MapLibre repaints, so independent canvases are not universal. |
| Windy.app | The delivered WindMap module defaults to 50 × 50 particle slots and 700 particles per megapixel, varies visible density with viewport/zoom, caches uniforms, and creates its own windy-particles-overlay canvas. Trail buffers use CSS-sized rather than full DPR-sized dimensions. |
| Earth / Nullschool | Historical public source separates static geography, wind animation, and colour canvases; targets a 40 ms frame delay; reduces mobile density; batches drawing by colour; yields during interpolation. The current live page ships a newer WebGL-capable implementation with multiple canvas sizes, so historical code is not proof of every current detail. |

Primary sources:

- [Windy.com particle module](https://www.windy.com/v/51.4.4.ind.c444/plugins/gl-particles.js)
- [Windy particle settings](https://docs.windy-plugins.com/api/interfaces/DataSpecifications.CustomParticles.html)
- [Windy.app wind module](https://windy.app/widgets-code/map/dist/lib/WindMap.45fe3a77482da7c2fabb.js)
- [Earth implementation notes](https://github.com/cambecc/earth#implementation-notes)
- [Earth historical animation source](https://github.com/cambecc/earth/blob/master/public/libs/earth/1.0.0/earth.js)
- [MapLibre repaint API](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#triggerrepaint)

## Idle-work follow-up

The cursor previously continued its animation loop whenever it was locked to a control, and spun continuously over empty space. A browser probe observed 557 callbacks in four seconds. It now stops once its springs settle; free rotation rests after pointer inactivity. Pointer input, target resizing, scrolling, camera movement, and visibility changes wake it. Hidden documents cancel pending cursor frames. Hover snapping remains available.

Map marker placement is coalesced into one callback per frame, without the redundant zoom subscription. Region hit testing also uses the latest pointer position at most once per frame; leaving the map cancels pending hover work.

The controlled cursor regression confirms zero animation callbacks after settling over a button, after moving to another button, and over empty background, with wake-up on movement. The map regression confirms zero stationary draw calls. A live follow-up sample containing physical pointer movement was excluded from idle measurements.

Verification for this follow-up: production build, lint/type validation, and 13 focused tests passed in 47 seconds. The old About/Challenge full-suite selector limitations still apply.

## Asset warming and active-hover follow-up

The Home preloader now waits for hero image decoding, then uses an idle callback to warm five small season images, four weather icons, and the shared MapLibre module. It does not wait for these optional resources before revealing Home. Data Saver and 2G connections skip warming. The shared import promise and browser image/HTTP caches reuse the work on navigation; no map instance, workers, audio graph, or wind requests are created by warming. No service worker or long-lived cache policy was added to stable asset URLs, so normal server cache validation still applies. Satellite tiles remain on demand because the visible camera and viewport determine which tiles are needed.

Two separate runtime problems were found:

- The cursor's fixed four-step spring integration was unstable at its 50ms frame cap. A live cursor had transforms millions of pixels off-screen. Integration now subdivides into steps no larger than 1/240 second. Cursor/card rectangles are read before writes, corner overlap is calculated from the existing transform math, and unnecessary post-write hit tests are removed. Its fixed root no longer covers the entire viewport.
- Region hover changed WebGL feature state, repainting the satellite globe. Cursor-only movement produced 358 UI frames in 3.5 seconds, while map highlighting with the cursor hidden produced 129. Hover now uses a cached projected SVG coastline. Back-facing vertices are omitted using MapLibre's transform occlusion test; camera movement invalidates the projection cache. Selection keeps its existing map outline/glow. Hover state is local to ExploreMap, and the unused transparent region-fill source is removed. Only changed selection IDs update feature state; style transitions are immediate.

Same-window comparison: 1452×843 CSS pixels, DPR 1.4, Microsoft Basic Render Driver, the same 3.5-second synthetic pointer trajectory and 8ms requested input interval. Original active-hover sample: 88 UI frames (~25 FPS), p95 frame interval 76.4ms. Final sample: 332 frames (~95 FPS), p95 14ms. These are local browser samples, not a cross-device guarantee. Neither globe pixel ratio nor imagery resolution was reduced.

Verification: production build, TypeScript, and full lint passed. Four new/extended performance regressions cover stationary rendering plus zero satellite draw calls across two geographic hover regions, cursor sleep/wake, stable on-screen cursor bounds under simulated slow frames, and Home-to-Listen asset warming without creating a map/audio engine. Fifteen focused checks passed across runs (14 in the broad focused run plus the corrected map-readiness check). The map hit-target check now waits for its projected marker to become visible before measuring coverage; it previously raced the asynchronous renderer import. Existing unrelated full-suite limitations below remain.

## Orbit Matter page-transition adaptation

Inspected `D:\Code\Projects\Coursework\CGMWTNOV2025\orbit-matter\js\transition.js`, its CSS, and its preloader. The source uses randomly staggered grid blocks, full-document navigation, and session flags; it does not preload destination assets or install a cache. The reference project was left unchanged.

Juke Box now uses the same visual motif with Next.js client navigation. At the user's request, timing and geometry match the reference: fixed 60px tiles, centered overflow offsets and one extra row; cover/reveal tweens use duration 0.05, ease power2.inOut, and random stagger with amount 0.5 and each 0.01. Navigation waits 300ms after covering; reveal waits another 300ms after destination readiness. Tiles are created only during navigation and removed afterward. Hover, keyboard focus, and touch intent warm the destination's route and selected images. Home warms Listen after the hero is decoded. The covered interval waits for known first-view assets and Listen map initialization, with a 1.2-second readiness ceiling and a 6-second overall overlay reset. The first Home intro is skipped on later visits in the same tab session. Reduced motion skips grid animation. External links, downloads, modified clicks, anchors, and same-page query changes keep normal behavior.

The shared image-decode promise cache is capped at 24 URLs; route-prefetch bookkeeping is capped at 16 entries and throttled per URL. Browser HTTP cache validation and Next.js route caching remain responsible for network reuse and freshness. There is no service worker, offline cache, precreated hidden map, or eager audio loading. Data Saver/2G connections skip speculative warming. The chapter badge respects the shared navigation handler rather than scheduling a second router push.

Verification includes client-document preservation and image-transfer reuse, slow-image readiness, failed-image recovery, keyboard focus, Back navigation, reduced motion, mobile menu navigation, skipped repeat intro, the existing zero-globe-draw hover regression, slow-frame cursor stability, and site asset smoke checks. Built-in browser inspection observed the grid covering, then About revealing with its hero ready; returning to Listen left the map initialized, overlay hidden, and zero transition tiles.

## Remaining measured opportunities

The site-wide UI palette was changed at the user's request to Orbit Matter's exact neutral dark colors (#141414 base, #262626 panels), while keeping off-white (#f2f2f0) and neutral grays. Transition tiles were subsequently lightened slightly to #202020 at the user's request. The reference dark values were verified in Orbit Matter's globals.css (--base-400 and --base-300); its cream and orange were not copied. This covers CSS, inline/Tailwind styles, SVG interface assets, map backdrop/sky, Challenge card shader bezels and text effects, and game feedback. Satellite/photographic imagery and data legends keep their informational colors. Desktop and mobile first-view checks covered eight routes each, finding zero tinted dark UI surfaces or runtime errors. A busy-frame preload probe also showed requestIdleCallback being scheduled but never invoked; its optional warm-up callback now has a 2.5-second deadline.

- Land/ocean geometry totals about 227 KB uncompressed and contributes to Listen's route chunk. Separate loading or careful quantization could reduce startup parsing; boundary picking needs accuracy checks before changing geometry.
- Remaining large/unreferenced asset candidates require checking dynamic paths and SVG references before deletion. Optional orchestra MP3s total about 3.57 MB and must not be counted as every page's initial download.
- Orchestra setup currently prepares decoded sample buffers before creating samplers from the URLs; investigate buffer reuse to reduce audio memory.
- Further geometry simplification or spatial indexing may improve picking on slow CPUs; the pointer and marker updates are already coalesced per frame.
- Responsive image variants, WOFF2 font conversion, and content-based asset filenames/caching are further options. Avoid changing cache lifetime on stable URLs without a reliable invalidation strategy.

## Verification limits

Final publication checks: production build with lint and TypeScript validation passed; 20 focused desktop/mobile tests passed in 1.8 minutes. These cover dataset switching, region selection, sharing, sound gestures, timeline, theme controls, reduced motion, cursor stability/sleep, zero satellite redraws on hover, asset warming, transition readiness/recovery/cache reuse, and Home/About/Challenge asset smoke checks. Repository workflow inventory contains no GitHub Actions workflows.

Production build, lint, and TypeScript checks are used alongside focused Listen and site asset checks. The existing broad suite has stale About-team and Challenge-hub selectors after previous redesigns; it is not an all-green full-suite result. The new idle-map regression checks that moving the wind slider creates no wind requests or continuous stationary-map draws.

The final cleanup removed the two newly unreachable wind client modules and separated hover projection from DOM painting. `fallow audit --gate new-only` passes with advisories, zero introduced dead-code errors, and zero introduced complexity errors. Existing complexity, unused legacy components, style-token drift advisories, and inherited duplicates remain outside this change's cleanup scope. All deleted image URLs were checked against runtime source: no stale references remain.

Preview: http://127.0.0.1:3000/listen. Publication scope: commit and push to main; no hosted deployment verification is included.
