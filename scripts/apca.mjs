// APCA (Accessible Perceptual Contrast Algorithm) for this portfolio.
//
// Contrast maths: APCA-W3 base algorithm 0.0.98G-4g with the SA98G constants
// published in apca-w3 0.1.9 (Andrew Somers / Myndex). This file reimplements
// only the published formula for checking web content; it has no dependencies.
//
// Conformance target: APCA "Bronze Simple Mode" use-case levels from
// "APCA in a Nutshell" (apca-w3 0.1.9, docs/APCA_in_a_Nutshell.md), which the
// author states can be used on their own, without the font lookup table.
// Font sizes there assume a reference x-height; per the same document we scale
// the CSS size by the font's real x-height (Times New Roman 0.45 → +16%,
// so the reference is ~0.52, the Helvetica/Arial x-height).

const SA98G = {
  mainTRC: 2.4,
  sRco: 0.2126729, sGco: 0.7151522, sBco: 0.072175,
  normBG: 0.56, normTXT: 0.57, revTXT: 0.62, revBG: 0.65,
  blkThrs: 0.022, blkClmp: 1.414,
  scaleBoW: 1.14, scaleWoB: 1.14,
  loBoWoffset: 0.027, loWoBoffset: 0.027,
  deltaYmin: 0.0005, loClip: 0.1,
};

/** sRGB 0–255 → APCA screen luminance Y. */
export function sRGBtoY([r, g, b]) {
  const c = (v) => Math.pow(v / 255, SA98G.mainTRC);
  return SA98G.sRco * c(r) + SA98G.sGco * c(g) + SA98G.sBco * c(b);
}

/** Signed Lc: positive = dark text on light, negative = light text on dark. */
export function APCAcontrast(txtY, bgY) {
  if ([txtY, bgY].some((y) => Number.isNaN(y) || y < 0 || y > 1.1)) return 0;
  const clamp = (y) => (y > SA98G.blkThrs ? y : y + Math.pow(SA98G.blkThrs - y, SA98G.blkClmp));
  txtY = clamp(txtY);
  bgY = clamp(bgY);
  if (Math.abs(bgY - txtY) < SA98G.deltaYmin) return 0;
  if (bgY > txtY) {
    const sapc = (Math.pow(bgY, SA98G.normBG) - Math.pow(txtY, SA98G.normTXT)) * SA98G.scaleBoW;
    return sapc < SA98G.loClip ? 0 : (sapc - SA98G.loBoWoffset) * 100;
  }
  const sapc = (Math.pow(bgY, SA98G.revBG) - Math.pow(txtY, SA98G.revTXT)) * SA98G.scaleWoB;
  return sapc > -SA98G.loClip ? 0 : (sapc + SA98G.loWoBoffset) * 100;
}

/** Parses #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() (comma or space syntax), color(srgb …), transparent. */
export function parseColor(input) {
  const s = String(input).trim().toLowerCase();
  if (s === 'transparent') return [0, 0, 0, 0];
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    const ch = (v) => (v.endsWith('%') ? (parseFloat(v) * 255) / 100 : parseFloat(v));
    const a = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    return [ch(parts[0]), ch(parts[1]), ch(parts[2]), a];
  }
  m = s.match(/^color\(srgb\s+([^)]+)\)$/);
  if (m) {
    const [rgb, alpha] = m[1].split('/');
    const [r, g, b] = rgb.trim().split(/\s+/).map((v) => parseFloat(v) * 255);
    return [r, g, b, alpha === undefined ? 1 : parseFloat(alpha)];
  }
  return null;
}

/** Composites a possibly translucent colour over an opaque one in sRGB space, as browsers do. */
export function blend(fg, bg) {
  const a = fg[3] ?? 1;
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(1);
}

/** Lc for text (may be translucent) over an opaque background; accepts colour strings or arrays. */
export function lc(text, background) {
  const bg = typeof background === 'string' ? parseColor(background) : background;
  const fgRaw = typeof text === 'string' ? parseColor(text) : text;
  const fg = blend(fgRaw, bg);
  return APCAcontrast(sRGBtoY(fg), sRGBtoY(bg));
}

// x-height / em, measured from the OS/2 tables of the fonts the site renders.
export const X_HEIGHT = {
  manrope: 0.54,
  unbounded: 0.566,
  georgia: 0.481,
  'times new roman': 0.448,
  arial: 0.519,
  helvetica: 0.523,
};
export const REFERENCE_X_HEIGHT = 0.52;

/** CSS px → APCA reference px for the first known family in a font-family list. */
export function effectiveSize(px, family = '') {
  const names = String(family).split(',').map((f) => f.trim().replace(/^["']|["']$/g, '').toLowerCase());
  const known = names.find((n) => n in X_HEIGHT);
  return known ? (px * X_HEIGHT[known]) / REFERENCE_X_HEIGHT : px;
}

/**
 * Minimum |Lc| under APCA Bronze Simple Mode.
 * role: 'body' (columns/blocks of fluent text), 'content' (any other text meant to be read),
 *       'spot' (placeholder, disabled, copyright-type and decorative text),
 *       'fine' (outline icons, fine pictograms, thin focus rings), 'solid' (mostly solid icons ≥4px),
 *       'divider' (non-semantic non-text ≥6px).
 * Returns null when the size/weight is below every level for that role (text must grow or become spot text).
 */
export function bronzeMin({ size = 16, weight = 400, role = 'content' } = {}) {
  if (role === 'spot' || role === 'solid') return 30;
  if (role === 'fine') return 45;
  if (role === 'divider') return 15;
  const at = (px, w) => size >= px - 0.01 && weight >= w;
  if (role === 'body') {
    if (at(24, 300) || at(18, 400) || at(16, 500) || at(14, 700)) return 75;
    if (at(18, 300) || at(14, 400)) return 90;
    return null;
  }
  if (at(36, 400) || at(24, 700)) return 45;
  if (at(48, 200) || at(36, 300) || at(24, 400) || at(21, 500) || at(18, 600) || at(16, 700)) return 60;
  if (at(24, 300) || at(15, 400) || at(16, 500) || at(14, 700)) return 75;
  if (at(24, 200) || at(18, 300) || at(12, 400)) return 90;
  return null;
}
