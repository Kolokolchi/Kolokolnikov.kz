---
name: Korney Kolokolnikov portfolio
description: Existing KK identity and the approved home hero and companion composition.
colors:
  bg: "#0c1016"
  surface: "#121820"
  surface-2: "#18212c"
  text: "#edf2f7"
  muted: "#e3e9ef"
  faint: "#98a1ac"
  line: "#ffffff17"
  line-strong: "#ffffff4d"
  line-input: "#ffffff74"
  blue: "#4aafff"
  blue-bright: "#a9d9ff"
  blue-text: "#d7edff"
  lime: "#b1ed45"
  lime-bright: "#daff98"
  orange: "#ff9549"
  orange-bright: "#ffd0a9"
  orange-text: "#ffe6d3"
  button-ink: "#08111a"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(53px, 6.4vw, 104px)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-.035em"
  headline:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(42px, 4.7vw, 72px)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-2px"
  title:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(27px, 2.6vw, 39px)"
    fontWeight: 400
    letterSpacing: "-.7px"
  body:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "15px"
    lineHeight: 1.7
  label:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: "1.6px"
  copy:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "14px"
    lineHeight: 1.8
  page-display:
    fontFamily: "Unbounded, Arial, sans-serif"
    fontSize: "clamp(32px, 5vw, 65px)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-2px"
rounded:
  home-media: "5px"
  home-button: "32px"
  home-filter: "30px"
  base-button: "6px"
spacing:
  home-gutter: "clamp(24px, 5.5vw, 88px)"
  home-section: "112px"
  home-section-mobile: "75px"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.button-ink}"
    rounded: "{rounded.home-button}"
    padding: "13px 25px"
    fontSize: "15px"
  button-primary-hover:
    backgroundColor: "{colors.lime-bright}"
  button-outline:
    textColor: "{colors.text}"
    rounded: "{rounded.home-button}"
    padding: "13px 25px"
  filter-active:
    backgroundColor: "#4aafff0d"
    textColor: "{colors.blue-text}"
    rounded: "{rounded.home-filter}"
    padding: "9px 18px"
---

# Design System: Korney Kolokolnikov portfolio

## Overview

**Creative North Star: "Идея. Форма. Движение."**

The existing home eyebrow supplies this phrase. Preserve the KK mark, Russian copy, dark surfaces and spacious editorial composition. Serif headings and italic emphasis give the home page its voice; Manrope carries navigation, descriptions and controls.

This records the incumbent identity and the approved home extension. The hero pairs copy with one solid KK sculpture; one graphite cat with large white eyes adds a small, independent companion. The detailed surface contract remains in `.impeccable/surfaces/home-hero.md`.

**Key Characteristics:**

- Charcoal surfaces with clear type and generous space.
- Stable blue, lime and orange roles.
- Original KK geometry with metal depth and restrained movement.
- Decorative motion that yields to content, user pause and reduced motion.

## Colors

The frontmatter owns the UI palette. `public/styles.css` defines the shared values as custom properties (`--text`, `--muted`, `--faint`, `--accent`, `--accent-bright`, `--accent-text`, `--accent-fill`, `--line`, `--line-strong`, `--line-input`); every page and the home sections use them instead of literal greys.

- **Primary — Blue:** browsing projects and video; bright blue supports emphasis and interactive details.
- **Secondary — Lime:** the client demonstration section and its primary action.
- **Tertiary — Orange:** contact navigation and the contact section.
- **Neutral:** `bg` is the page canvas, `surface` and `surface-2` support panels, `text` is main copy, `muted` is secondary copy, `faint` is spot text only, and `line` supports dividers.

**The Semantic Color Rule.** Keep blue for exploration, lime for client demonstrations and orange for starting a conversation. Section and action accents are local; sculpture lighting cycles do not change the page theme. `public/theme.js` removes the legacy saved theme attribute.

## Contrast — APCA

The site follows APCA (the WCAG 3 draft contrast method), Bronze Simple Mode: base algorithm 0.0.98G-4g, levels from "APCA in a Nutshell" (apca-w3 0.1.9). Font sizes are corrected by x-height against the Helvetica reference 0.52 (Manrope 0.54, Unbounded 0.566, Georgia 0.481).

- **Text under 15px needs Lc 90, so it stays near white.** On these dark surfaces Lc 90 starts at roughly `#dfe5ec`; secondary text (`muted`) and small accent text (`accent-text`: `#d7edff`, `#daff98`, `#ffe6d3`) sit there. Hierarchy for small text comes from size, weight, case and spacing, not from grey.
- **Lc 75 from 15px, Lc 60 from 24px, Lc 45 from 36px.** `accent-bright` serves 15px+ text and the italic display accents; saturated `accent` is for headlines, icons, dots and the 2px focus ring (non-text, Lc 45+).
- **Type floor.** Content text is never below 12px (`--fs-min`); copy that wraps to three or more lines is at least 14px (`--fs-copy`, body text Lc 90). Only spot text (APCA Lc 30) may be smaller: decorative numbering, the copyright, the client-space mock-up and the faint expertise counters.
- **Filled buttons** keep their accent fill (`accent-fill`: blue-bright, lime, orange-bright) with `button-ink`, which reaches Lc 75+, so their labels are 15px (`--fs-action`); the hover fill is `accent-text` (Lc 90+). Compact toolbars that must keep 12px labels use the `accent-text` fill instead.
- **Overlays.** Badges and captions over images, video and the 3D viewer use scrims of at least 90% (`#0c1016e6`–`f2`, gradients reaching `#070b12d9` by the first text line), so they hold Lc 90 even over a white pixel. Section glows behind text stay dark enough for `muted` (work band from `#112a44`, engineering glow `#0f2740`).
- **Non-text.** Outline-button borders use `line-strong` (Lc 15+), text-field borders `line-input` (Lc 30+); disabled controls keep Lc 30+ (opacity no lower than 0.5).

Checks: `npm run check:apca` (tokens and the 12px floor, also part of `prebuild`) and the rendered-page audit `scripts/apca-audit.mjs`, which measures every visible text run with its real size, weight, opacity, gradients and overlays. With the dev server running, in the browser console: `(await import('/@fs/<project>/scripts/apca-audit.mjs')).auditDocument()`.

## Typography

Home display, headings and project titles use Georgia with Times New Roman and serif fallbacks. Preserve the italic accent line. Manrope uses the bundled regular, semibold and bold faces for body text and controls. Home eyebrows are uppercase; the frontmatter label token records their desktop treatment.

The display token is the desktop hero heading. At the intermediate breakpoint it becomes `clamp(48px, 6.1vw, 74px)`; on mobile it becomes `clamp(45px, 8.6vw, 60px)`, then `clamp(38px, 10.6vw, 49px)` on narrow phones. The home hero description is smaller than base body copy (14px, line-height 1.8, at every width — the APCA copy floor).

**The Home Type Rule.** Scope the serif display treatment to `.wild-home`. Other existing pages retain Unbounded headings; `page-display` records their page-intro role.

## Layout

The home wrapper has a maximum width (1536px) and fluid gutters from the frontmatter. Shared pages retain the base wrapper (1440px maximum, 64px desktop gutters). Home sections use the recorded vertical spacing with individual section overrides in `public/wild.css`.

Desktop hero copy is left aligned (57% width, maximum 780px); the sculpture occupies the right. At the mobile breakpoint the sculpture sits above full-width copy, with hero top padding (305px). The header is 100px tall on desktop and 84px on mobile. The home layout adapts at 1100px, 760px and 480px. Project cards use two columns with alternating vertical offsets (80px desktop; 50px mobile), then one unshifted column at 480px.

## Elevation & Depth

Most content uses low-contrast borders and tonal fields. The client preview has a perspective tilt and a diffuse shadow; the 3D hero uses actual extrusion, bevels, studio reflections and darker side faces. Keep its silhouette legible against the charcoal field. Exact shadow values and scene motion are in `.impeccable/design.json`.

## Shapes

Home buttons and filters are pills; media frames have small corners. Base-page buttons keep their existing smaller corners. Preserve the four original paths in `scripts/brand.mjs`, including their curves. The hero extrudes those contours rather than approximating the identity with type or a replacement emblem.

## Components

**Buttons and navigation.** Home buttons have a minimum height (54px), pill corners and compact Manrope labels. Primary buttons inherit their local semantic accent; the documented primary sample belongs to the lime client section. Outlined buttons keep a fine border. The hero reel link has a circular play icon and a small year label. Navigation is compact on desktop and expands into the existing mobile menu. Preserve visible keyboard focus.

**Filters and cards.** Filters have a minimum height (44px); the selected state uses a translucent blue field, bright text and a fine border. Home project cards pair a minimally rounded image with an uppercase category, serif title and quiet slash-separated tags. Fine-pointer hover enlarges the image gently; reduced motion removes that enlargement.

**Hero sculpture.** Render one volumetric mark from the four brand contours. The two colored contours share their movement and retain their connection. Use only gentle layer movement, small damped pointer response and restrained scroll reframing. The blue, lime and orange material palettes are the existing brand asset palettes, separate from UI accent tokens. Keep the existing SVG fallback visible until the first successful WebGL draw and restore it on context loss or initialization failure.

**Roaming cat.** Use the exact black cat with white outlines and large oval eyes from the user's six-panel reference, preserved in `public/assets/cat/reference.jpg`. `public/cat-drawings.js` isolates its original pixels with SVG silhouettes; do not redraw the face or include the sample blocks and edge lines. Use panel 1 for a top peek, panels 2/4 for right/left peeks, panel 3 for paired head and tail, panel 5 for lounging and panel 6 for the glide. The upside-down pose is panel 3 rotated 180 degrees. Side peeks and paired poses show the head and tail at opposite edges of the same element on one axis; the front paws may grip over the edge. Store the side and fractional attachment point, recalculate from the live element bounds, and follow layout changes without rebuilding the artwork. Follow the edge during the hide transition and during reduced-motion scrolling. Exclude perspective-rotated edges from rectangular placement. An occasional full-body glide is allowed only in a verified empty side corridor. The gliding cat can be caught and carried by the scruff, then set down on another anchor edge in a safe regular pose (see the surface contract). Keep text and controls clear; if no safe candidate exists, stay hidden. Scrolling hides the cat before any paw appears. Keep a single trail of at most three alternating steps (46px desktop, 34px mobile) leading to the exact future head position. Track the shared destination through scrolling, finish remaining steps 120ms apart after stopping, allow the final step's 180ms entrance, then fade all prints for 750ms before revealing the cat there. Never reselect its destination or pose during the fade. Reduced motion uses a static cat and no prints.

## Extended portfolio sections (November 2026)

The home page now runs 01 Sites → 02 Engineering → 03 3D/CGI → 04 Video → 05 Brands → 06 Decks → 07 About → 08 Demos → 09 Contact. Styles live in `public/work.css`, behaviour in `public/work.js`, copy and ordering in `public/work-data.js`; media ids resolve through the generated `public/work-media.js`.

- **Reel band and stats.** Two opposing marquee rows of real work tiles under the intro, then six serif counters computed from the data file. Reduced motion stops the rows and makes them scrollable.
- **Engineering lab.** WebGL viewer (`src/machine-viewer.js`) for CAD exports: model tabs, assembly slider that replays manifest steps, section cut, shell solid/X-ray/hidden, part tooltip with material, reset, fullscreen. A blueprint grid sits behind the section. The rendered poster stays until the first draw and returns on context loss. Wheel zoom only after the visitor clicks the model; touch keeps vertical page scrolling (`touch-action: pan-y`).
- **360° panorama.** `src/pano-viewer.js`, poster first, slow idle pan unless reduced motion, plain wheel never hijacks the page.
- **Bento grids** (3D and brands) use `wide`, `tall` and `square` tiles with dense packing; captions sit on a dark gradient. Logos on dark artwork use `dark: true` (contained, padded).
- **Motion.** The existing stage plays a playlist with a thumbnail rail; vertical films sit in phone frames; YouTube opens in a lightbox through `youtube-nocookie.com` only after a click. Uploads with embedding disabled open on YouTube.
- **Lightbox.** One `<dialog>` for images, loops, deck pages and YouTube; arrows, swipe and Escape.

Accent rule is unchanged: engineering, 3D, brands and decks are exploration (blue); demos stay lime; contact stays orange. Silent loops play only while visible and pause for reduced motion or a hidden tab.

## Do's and Don'ts

### Do:

- **Do** preserve the original four KK contours and the connected colored portion.
- **Do** keep existing Russian copy and controls readable on desktop and mobile.
- **Do** retain the SVG fallback and a static reduced-motion sculpture.
- **Do** defer the cat when a safe real element edge is unavailable.

### Don't:

- **Don't** turn semantic section accents into a global theme cycle.
- **Don't** spread the home serif override to other pages.
- **Don't** show the cat and visible pawprints together.
- **Don't** cover text or controls with decorative elements.
