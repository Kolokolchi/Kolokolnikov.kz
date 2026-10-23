---
name: Korney Kolokolnikov portfolio
description: Existing KK identity and the approved home hero and companion composition.
colors:
  bg: "#0c1016"
  surface: "#121820"
  surface-2: "#18212c"
  text: "#edf2f7"
  muted: "#9ca8b6"
  home-muted: "#a3afbd"
  line: "#ffffff17"
  blue: "#4aafff"
  blue-bright: "#a9d9ff"
  lime: "#b1ed45"
  lime-bright: "#daff98"
  orange: "#ff9549"
  orange-bright: "#ffd0a9"
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
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: "2px"
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
  button-primary-hover:
    backgroundColor: "{colors.lime-bright}"
  button-outline:
    textColor: "{colors.text}"
    rounded: "{rounded.home-button}"
    padding: "13px 25px"
  filter-active:
    backgroundColor: "#4aafff15"
    textColor: "{colors.blue-bright}"
    rounded: "{rounded.home-filter}"
    padding: "9px 18px"
---

# Design System: Korney Kolokolnikov portfolio

## Overview

**Creative North Star: "Идея. Форма. Движение."**

The existing home eyebrow supplies this phrase. Preserve the KK mark, Russian copy, dark surfaces and spacious editorial composition. Serif headings and italic emphasis give the home page its voice; Manrope carries navigation, descriptions and controls.

This records the incumbent identity and the approved home extension. The hero pairs copy with one solid KK sculpture; the outlined cat adds a small, independent companion. The detailed surface contract remains in `.impeccable/surfaces/home-hero.md`.

**Key Characteristics:**

- Charcoal surfaces with clear type and generous space.
- Stable blue, lime and orange roles.
- Original KK geometry with metal depth and restrained movement.
- Decorative motion that yields to content, user pause and reduced motion.

## Colors

The frontmatter owns the UI palette. `public/styles.css` defines the shared values; the home stylesheet overrides muted text with `home-muted`.

- **Primary — Blue:** browsing projects and video; bright blue supports emphasis and interactive details.
- **Secondary — Lime:** the client demonstration section and its primary action.
- **Tertiary — Orange:** contact navigation and the contact section.
- **Neutral:** `bg` is the page canvas, `surface` and `surface-2` support panels, `text` is main copy, and muted values and `line` support secondary copy and dividers.

**The Semantic Color Rule.** Keep blue for exploration, lime for client demonstrations and orange for starting a conversation. Section and action accents are local; sculpture lighting cycles do not change the page theme. `public/theme.js` removes the legacy saved theme attribute.

## Typography

Home display, headings and project titles use Georgia with Times New Roman and serif fallbacks. Preserve the italic accent line. Manrope uses the bundled regular, semibold and bold faces for body text and controls. Home eyebrows are uppercase; the frontmatter label token records their desktop treatment.

The display token is the desktop hero heading. At the intermediate breakpoint it becomes `clamp(48px, 6.1vw, 74px)`; on mobile it becomes `clamp(45px, 8.6vw, 60px)`, then `clamp(38px, 10.6vw, 49px)` on narrow phones. The home hero description is smaller than base body copy (14px, line-height 1.8; 12px on mobile and 11px on narrow phones).

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

**Roaming cat.** Use the outlined cat without an added edge line at a safe, real design-element edge, choosing left, right, top or bottom orientation. Clip the silhouette behind that edge so it never draws over the element. It must leave text and controls clear; when no safe anchor exists, keep it hidden. Scrolling hides the cat before any paw appears. Keep a single short trail of at most three alternating steps, spaced 46px apart on desktop or 34px on mobile, approaching the exact element where the cat will appear. Share one destination between the route and reveal; track its actual element position through scrolling. On stopping, finish any remaining steps 120ms apart, allow the final step's 180ms entrance, then fade all prints for 750ms before revealing the cat at that destination. Never reselect a different destination during the fade. Pause, reduced-motion and visibility behavior is recorded with exact timings in the sidecar; the hero pause control governs the scene, while the cat has its own reduced-motion and visibility policy.

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
