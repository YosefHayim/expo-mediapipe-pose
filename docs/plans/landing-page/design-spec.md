# Landing page design spec (expo-mediapipe-pose site)

The site at `site/` becomes a landing page wrapped around the existing playground.
Bar: a polished Framer-template-level page. Real copy only, true to README.md. No invented
numbers, users, reviews or logos. Only true facts (for example "33 body landmarks", "iOS and Android",
"frames stay on the device", "Expo SDK 58").

## Hard rules

- No badge, chip, pill label or eyebrow line above any heading. Sections start with the heading.
  Version and platform facts go in body text, the nav or the footer.
- No emojis anywhere. Custom SVG icons only (from `site/src/landing/icons/icons.tsx`), no icon library.
- Self-host everything. The CSP is `default-src 'self'`: no Google Fonts URL, no CDN. Fonts come from
  npm `@fontsource*` packages imported in CSS (Vite bundles the files).
- Mobile first. No sideways scroll at 320, 375, 768, 1024, 1440. Side gutter 16px under 768px,
  24px at 768-1023, then content max width 1200px centered (hero rule line may span 1320px).
- `prefers-reduced-motion: reduce`: no transforms, no draw-in, no autoplay; final states shown at once.
- Plain, concrete names for files, components and CSS classes (`HeroSkeletonCanvas`, not `Fx`).
- Accessibility: one h1 (hero), real buttons and links, visible focus ring, alt text, aria-labels on icon buttons,
  contrast AA for text.

## Fonts

- Display (h1, h2, h3, big numbers): `Big Shoulders Display` variable, weight 800, sentence case (not all caps).
  Package `@fontsource-variable/big-shoulders-display`.
- Body and UI: `Instrument Sans` variable, 400/500/600. Package `@fontsource-variable/instrument-sans`.
- Readouts, code, numbers in data: `IBM Plex Mono` 400/500. Package `@fontsource/ibm-plex-mono` (latin 400 and 500 only).
- Import only the latin subset files to keep size down.

## Type scale (fluid, 390 to 1440)

| token | phone 390 | desktop 1440 | CSS |
|---|---|---|---|
| h1 | 58 / 0.92 | 120 / 0.92 | `clamp(58px, 35px + 5.9vw, 120px)`, letter-spacing -0.02em |
| h2 | 42 / 0.96 | 68 / 0.96 | `clamp(42px, 32px + 2.48vw, 68px)`, letter-spacing -0.02em |
| h3 | 26 / 1.05 | 30 / 1.05 | `clamp(26px, 24.5px + 0.38vw, 30px)`, letter-spacing -0.02em |
| lead | 17 / 1.6 | 19 / 1.6 | body intro paragraphs |
| body | 16 / 1.6 | 16 / 1.6 | |
| small | 13 / 1.5 | 13 / 1.5 | captions, table notes |
| readout | 12 mono, 0.06em tracking, uppercase | | joint readouts, card indexes |

## Spacing and shape

- Section padding: 120px top and bottom at 1024+, 96px at 768, 72px on phones.
- Section heading block: on 1024+ the h2 sits left (max 7 columns) and the intro paragraph right (max 4 columns),
  bottom-aligned; on phones they stack, 16px apart. 56px (desktop) / 32px (phone) from heading block to content.
- Grid: 12 columns, 24px gap desktop, 16px phone.
- Radius: 4px cards and panels, 6px buttons and inputs, 999px only for the theme switch track.
- Lines: 1px hairlines (`--line`). Very few shadows: none on dark, one soft shadow on light cards on hover.

## Palette (tokens on `:root`, in `site/src/landing/theme/tokens.css`)

Our own hue family: green-black night, sage paper, lime signal, coral joints.

| token | value | use |
|---|---|---|
| `--night` | `#0D1311` | dark grounds, hero |
| `--night-raised` | `#151D1A` | dark cards |
| `--night-line` | `#26322D` | lines on dark |
| `--paper` | `#EDEFE8` | light grounds |
| `--paper-raised` | `#FFFFFF` | light cards |
| `--paper-line` | `#D5DAD0` | lines on light |
| `--text-on-night` | `#EDEFE8` | |
| `--muted-on-night` | `rgba(237, 239, 232, 0.66)` | |
| `--text-on-paper` | `#101614` | |
| `--muted-on-paper` | `#55625C` | |
| `--signal` | `#C8F560` | skeleton bones, primary button fill, highlights on dark |
| `--signal-ink` | `#2E6B1F` | accent text and links on paper (AA) |
| `--joint` | `#FF8A5B` | joint dots, angle arcs, readout ticks |

Primary button: `--signal` fill, `--night` text, 6px radius, 48px tall, 600 weight, arrow icon right that
slides 3px on hover. Secondary button: transparent, 1px line, same size. No dot-in-pill buttons.

Theme: `data-theme="light" | "dark"` on `<html>`. Default follows `prefers-color-scheme`; the toggle saves the choice
in localStorage inside try/catch. Light theme alternates dark and paper sections (as listed below).
Dark theme puts every section on night grounds. The hero is always night.

## Page order (section ids are anchors used by the nav)

1. `SiteNav` - sticky, night with 8px backdrop blur after 24px scroll. Left: logo (custom SVG mark: three joints and
   two bones) + "expo-mediapipe-pose". Center links: Features, Playground, Browser vs native, Agents, FAQ.
   Right: theme toggle, GitHub icon link, primary button "Try it live". Under 768px: logo, theme toggle and a menu
   button; the menu opens a full-width sheet under the nav with the links stacked large (h3 size) and the button;
   Esc and link click close it; body scroll locked while open; focus moves into the sheet.
2. `#top` Hero (night, full bleed, min-height 100svh minus nav). Stock clip of a person moving, self-hosted, muted,
   looping, playsinline, darkened by a gradient (left side darker for text). A canvas draws the recorded skeleton
   in sync with `video.currentTime`. Signature component (below) on one knee or elbow.
   h1: "Track every joint, live in Expo." Lead: one or two sentences from README facts.
   Buttons: "Try it live" (primary, opens the playground) and a copy-install box
   `npx expo install expo-mediapipe-pose` with a copy icon button. A 1px rule line between h1 and lead, like a
   measuring tape: it carries small tick marks that draw in from left.
3. `#features` Feature gallery (paper in light theme). 9 cards in 3 groups: See it (Live camera, Skeleton style,
   Body mask), Measure it (Angles and distances, Many people, Photo and video), React to it (Rules and feedback,
   Record and replay, Cameras and rates). Group titles are h3 rows, not chips. 1 column under 640, 2 at 640-1023,
   3 at 1024+.
4. `#playground` the existing playground, restyled to these tokens. The model and worker load only when this section
   comes within 600px of the viewport or "Try it live" is pressed.
5. `#browser-vs-native` table (night): what the browser playground shows vs what the native module does.
6. `#integration` existing code section, restyled.
7. `#agents` (paper): SKILL.md, llms.txt, AGENTS.md and the copyable integration prompt.
8. `#faq` (night): accordion, questions moved from the README FAQ.
9. `SiteFooter` (paper): short line about the project, link columns (Docs, Project), license and attribution,
   version from `version.json`. No giant wordmark.

## Signature component: joint readout

A thin 1px leader line from a tracked joint to a small mono label, for example `LEFT KNEE 142°`, plus an arc at the
joint that sweeps to the current angle. The angle is computed each frame from the recorded landmarks
(hip-knee-ankle or shoulder-elbow-wrist). Colors: arc and tick `--joint`, label text `--text-on-night` on a
`--night` 80% plate, 4px radius. It appears in the hero, in the "Angles and distances" card, and as the
section-divider tick rule motif.

## Motion

Kind and pace (keep): soft fade + rise, long and calm.
- Load (hero): group 1 (h1, lead) opacity 0 to 1 and y 24px to 0, 0.8s, delay 0.1s. Group 2 (buttons, install box)
  y 32px, 0.9s, delay 0.7s. Easing `cubic-bezier(0.22, 1, 0.36, 1)`.
- Scroll reveal: same fade + y 24px, 0.8s, stagger 0.08s inside a group, triggered once by one shared
  IntersectionObserver (`threshold 0.15`, `rootMargin 0px 0px -8% 0px`). Component `Reveal` in
  `site/src/landing/motion/reveal.tsx`.
Our own choreography:
- Skeleton bones draw in on hero load (stroke length 0 to full over 1.2s, joints pop in after), then follow the clip.
- Angle arcs sweep from 0 to the value when they first appear.
- Tick rules draw left to right (scaleX 0 to 1, 0.9s) with ticks fading in staggered.
- Icons in gallery cards draw their strokes once on reveal (stroke-dashoffset).
No parallax, no scroll-jacking. Gallery card canvases animate only while on screen.

## Recorded landmarks format (`site/media/*.landmarks.json`)

```json
{ "version": 1, "fps": 30, "width": 1280, "height": 720, "durationMs": 10000,
  "frames": [[x0, y0, v0, x1, y1, v1, "... 33 landmarks, 99 numbers"], []] }
```
Coordinates normalized 0..1 to the video frame, rounded to 4 decimals. An empty array means no pose in that frame.
Frame index = `Math.floor(currentTime * fps) % frames.length`. Only the first person is stored.

## Files (who owns what, to avoid merge conflicts)

- Foundation PR owns: `site/src/landing/theme/*`, `site/src/landing/motion/*`, `site/src/landing/icons/*`,
  `site/src/landing/nav/*`, `site/src/landing/section/*`, `site/src/landing/open-playground.ts`, `site/src/main.tsx`,
  `site/src/landing/landing-page.tsx` (page composition), `site/index.html`, `site/scripts/assets.mjs`,
  `site/src/playground/app.tsx` and `site/src/playground/style.css` (restyle + lazy load), and stub files for every
  later part, each already wired into the page:
  `site/src/landing/hero/hero.tsx`, `site/src/gallery/feature-gallery.tsx`,
  `site/src/landing/compare/browser-native-table.tsx`, `site/src/landing/agents/agents-section.tsx`,
  `site/src/landing/faq/faq-section.tsx`, `site/src/landing/footer/site-footer.tsx`.
- Each later PR edits only its own folder (plus its own CSS file next to its component, imported by it).
