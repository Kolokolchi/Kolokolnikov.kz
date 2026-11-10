// Static APCA gate for the portfolio stylesheets (Bronze Simple Mode, see scripts/apca.mjs).
//   npm run check:apca
// 1. Colour tokens: every text/fill/line token is measured against the page surfaces it is used on.
// 2. Type floor: no font-size below the content minimum (12px) outside the declared spot-text rules.
// The rendered-page audit (scripts/apca-audit.mjs) covers composition: gradients, overlays, media.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { lc, parseColor, blend } from './apca.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');

function tokens(css, selector) {
  const start = css.indexOf(selector + '{');
  if (start < 0) throw new Error(`Missing ${selector} in stylesheet`);
  const body = css.slice(start + selector.length + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+)/g)].map((m) => [m[1], m[2].trim()]));
}

const failures = [];
const report = [];
function expect(label, value, min) {
  const ok = value >= min;
  report.push(`${ok ? 'ok  ' : 'FAIL'} ${label}: Lc ${value.toFixed(1)} (min ${min})`);
  if (!ok) failures.push(label);
}
const solid = (color, bg) => blend(parseColor(color), parseColor(bg));
const text = (color, bg) => Math.abs(lc(solid(color, bg), parseColor(bg)));

// --- 1. Tokens -------------------------------------------------------------------------------
const styles = await read('public/styles.css');
const base = tokens(styles, ':root');
// Opaque surfaces that carry text. The section glows are gradients: their brightest stop must
// still hold --text; where secondary text actually lands on them is checked by apca-audit.mjs.
const surfaces = {
  bg: base.bg,
  surface: base.surface,
  'surface-2': base['surface-2'],
  card: '#111a24',
  'lab-panel': '#0d151f',
  'client-band': '#18221b',
};
const glows = { 'work-glow (wild.css)': '#112a44', 'eng-glow (work.css)': '#0f2740' };
const ink = '#08111a';
for (const [name, bg] of Object.entries(surfaces)) {
  expect(`--text on ${name} (any size)`, text(base.text, bg), 90);
  expect(`--muted on ${name} (12–14px text)`, text(base.muted, bg), 90);
  expect(`--faint on ${name} (spot text)`, text(base.faint, bg), 30);
}
for (const [name, bg] of Object.entries(glows)) expect(`--text on brightest ${name}`, text(base.text, bg), 90);
expect('--line-strong on bg (outline buttons, Lc 15)', text(base['line-strong'], base.bg), 15);
expect('--line-input on bg (field borders)', text(base['line-input'], base.bg), 30);
for (const accent of ['blue', 'lime', 'orange']) {
  const t = { ...base, ...tokens(styles, `[data-accent="${accent}"]`) };
  for (const name of ['bg', 'surface', 'lab-panel', 'client-band']) {
    expect(`${accent} --accent-text on ${name} (12–14px)`, text(t['accent-text'], surfaces[name]), 90);
    expect(`${accent} --accent-bright on ${name} (15px+)`, text(t['accent-bright'], surfaces[name]), 75);
  }
  expect(`${accent} --accent on bg (2px focus ring, fine non-text)`, text(t.accent, base.bg), 45);
  expect(`${accent} ink on --accent-fill (15px+ labels)`, lc(ink, t['accent-fill']), 75);
  expect(`${accent} ink on --accent-text (hover, compact labels)`, lc(ink, t['accent-text']), 90);
}

// --- 2. Type floor ---------------------------------------------------------------------------
// Spot text (APCA Lc 30, no fluent reading): decorative numbering, the client-space mock-up,
// the old hero art caption and the faint expertise counters.
const SPOT_RULES = [
  /\.preview-bar\b/, /\.preview-footer\b/, /\.art-caption\b/, /summary::before/,
];
const files = ['public/styles.css', 'public/wild.css', 'public/work.css', 'public/video.css', 'public/showcase.css', 'public/story/story.css',
  'public/project-assembly.css', 'public/scroll-cat.css', 'app/globals.css'];
for (const file of files) {
  const css = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    for (const fs of m[2].matchAll(/font-size:\s*([\d.]+)px/g)) {
      const px = parseFloat(fs[1]);
      if (px >= 12) continue;
      if (SPOT_RULES.some((re) => re.test(selector))) continue;
      failures.push(`${file}: ${selector} font-size ${px}px < 12px`);
      report.push(`FAIL ${file}: "${selector}" uses ${px}px (content text minimum is 12px)`);
    }
  }
}

console.log(report.join('\n'));
if (failures.length) {
  console.error(`\nAPCA check failed: ${failures.length} problem(s).`);
  process.exit(1);
}
console.log(`\nAPCA check passed (${report.length} checks).`);
