// Browser-side APCA audit of the rendered page (Bronze Simple Mode, see scripts/apca.mjs).
//
// With the dev server running, in the page console (or via the browser automation tool):
//   const { auditDocument } = await import('/@fs/<absolute path>/scripts/apca-audit.mjs');
//   const report = await auditDocument();
//   console.table(report.failures);
//
// Every visible text run is measured with its computed colour, size, weight, family
// (x-height corrected), cumulative opacity and every background painted beneath it:
// ancestor backgrounds, positioned ::before/::after layers, and linear/radial gradients
// evaluated at the corners and centre of the text box. Text over images, video or canvas
// is evaluated against both a white and a black pixel under the overlays above the media;
// the darker-overlay result is reported in `media` for a visual check.
//
// Roles: SPOT selectors, aria-hidden text and disabled controls are spot text (Lc 30);
// p/li/dd/blockquote/figcaption rendering three or more lines is body text; the rest is content.

import { parseColor, sRGBtoY, APCAcontrast, effectiveSize, bronzeMin } from './apca.mjs';

// Decorative or redundant text on this site (APCA "spot readable": numbering, copyright,
// the illustrative client-space mock-up).
export const SPOT = [
  '[data-apca="spot"]',
  '.section-number',
  '.brand-period',
  '.hero-period',
  '.project-sequence > span:first-child',
  '.client-preview .preview-bar',
  '.client-preview .preview-footer',
  '.site-footer > span:first-of-type',
].join(',');

const SKIP = 'script,style,noscript,template,svg,math,canvas,video,iframe,option';
const MEDIA = 'img,video,canvas,iframe';
const WHITE = [255, 255, 255, 1];
const BLACK = [0, 0, 0, 1];

const css = (el, pseudo) => getComputedStyle(el, pseudo);
const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const over = (fg, bg) => {
  const a = fg[3] ?? 1;
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
};
const absLc = (text, bg) => Math.abs(APCAcontrast(sRGBtoY(over(text, bg)), sRGBtoY(bg)));

function splitTop(value) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const COLOR_RE = /^(rgba?\([^)]*\)|color\(srgb[^)]*\)|transparent)\s*(.*)$/;

function parseGradient(src) {
  const m = src.match(/^(repeating-)?(linear|radial)-gradient\((.*)\)$/s);
  if (!m) return null;
  const parts = splitTop(m[3]);
  const g = { type: m[2], stops: [], tile: false };
  if (!COLOR_RE.test(parts[0])) g.head = parts.shift();
  for (const part of parts) {
    const cm = part.match(COLOR_RE);
    if (!cm) continue; // interpolation hints are ignored
    const color = parseColor(cm[1]);
    const pos = cm[2].split(/\s+/).filter(Boolean);
    const len = g.type === 'linear' ? null : 1;
    for (const p of pos.length ? pos : [null]) g.stops.push({ color, at: p, len });
  }
  return g.stops.length ? g : null;
}

function resolveStops(stops, length) {
  const at = stops.map((s) => {
    if (s.at == null) return null;
    if (s.at.endsWith('%')) return parseFloat(s.at) / 100;
    if (s.at.endsWith('px')) return parseFloat(s.at) / length;
    return null;
  });
  if (at[0] == null) at[0] = 0;
  if (at[at.length - 1] == null) at[at.length - 1] = 1;
  for (let i = 1; i < at.length; i++) {
    if (at[i] == null) {
      let j = i;
      while (at[j] == null) j++;
      for (let k = i; k < j; k++) at[k] = at[i - 1] + ((at[j] - at[i - 1]) * (k - i + 1)) / (j - i + 1);
    }
    at[i] = Math.max(at[i], at[i - 1]);
  }
  return stops.map((s, i) => ({ color: s.color, t: at[i] }));
}

function colorAt(stops, t) {
  if (t <= stops[0].t) return stops[0].color;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (t <= b.t) {
      const f = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
      // Premultiplied interpolation, as browsers do for legacy colours.
      const alpha = a.color[3] + (b.color[3] - a.color[3]) * f;
      if (alpha <= 0) return [0, 0, 0, 0];
      const ch = (k) => (a.color[k] * a.color[3] + (b.color[k] * b.color[3] - a.color[k] * a.color[3]) * f) / alpha;
      return [ch(0), ch(1), ch(2), alpha];
    }
  }
  return stops[stops.length - 1].color;
}

function lengthIn(value, size) {
  if (value.endsWith('%')) return (parseFloat(value) / 100) * size;
  if (value.endsWith('px')) return parseFloat(value);
  return { left: 0, top: 0, center: size / 2, right: size, bottom: size }[value] ?? size / 2;
}

function gradientAt(g, box, x, y) {
  const w = box.width;
  const h = box.height;
  const px = x - box.left;
  const py = y - box.top;
  if (g.type === 'linear') {
    let deg = 180;
    const head = (g.head || '').trim();
    if (/deg$/.test(head)) deg = parseFloat(head);
    else if (/turn$/.test(head)) deg = parseFloat(head) * 360;
    else if (/^to /.test(head)) {
      const dirs = { top: 0, right: 90, bottom: 180, left: 270 };
      const words = head.slice(3).split(/\s+/);
      if (words.length === 1) deg = dirs[words[0]];
      else {
        const v = words.includes('top') ? -1 : 1;
        const hzt = words.includes('left') ? -1 : 1;
        deg = (Math.atan2(hzt * h, -v * w) * 180) / Math.PI;
      }
    }
    const r = (deg * Math.PI) / 180;
    const len = Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r));
    const t = ((px - w / 2) * Math.sin(r) - (py - h / 2) * Math.cos(r)) / len + 0.5;
    return colorAt(resolveStops(g.stops, len), t);
  }
  // radial: supports [circle|ellipse] [farthest-corner|closest-side|farthest-side|closest-corner] [at x y]
  const head = (g.head || '').trim();
  const atM = head.match(/at\s+(\S+)(?:\s+(\S+))?/);
  const cx = atM ? lengthIn(atM[1], w) : w / 2;
  const cy = atM ? lengthIn(atM[2] || 'center', h) : h / 2;
  const circle = /circle/.test(head);
  const sizeKey = (head.match(/(closest|farthest)-(side|corner)/) || ['farthest-corner'])[0];
  const sides = [cx, w - cx, cy, h - cy].map(Math.abs);
  let rx;
  let ry;
  if (sizeKey.endsWith('side')) {
    const pick = sizeKey.startsWith('closest') ? Math.min : Math.max;
    rx = pick(sides[0], sides[1]);
    ry = pick(sides[2], sides[3]);
    if (circle) rx = ry = pick(rx, ry);
  } else {
    const pick = sizeKey.startsWith('closest') ? Math.min : Math.max;
    const dx = pick(sides[0], sides[1]);
    const dy = pick(sides[2], sides[3]);
    if (circle) rx = ry = Math.hypot(dx, dy);
    else {
      const sx = pick(sides[0], sides[1]);
      const sy = pick(sides[2], sides[3]);
      const k = Math.SQRT2;
      rx = sx * k;
      ry = sy * k;
    }
  }
  const explicit = head.replace(/at\s+.*/, '').match(/(-?[\d.]+)(px|%)/g);
  if (explicit) {
    rx = lengthIn(explicit[0], w);
    ry = explicit[1] ? lengthIn(explicit[1], h) : rx;
  }
  const t = Math.hypot((px - cx) / (rx || 1), (py - cy) / (ry || 1));
  return colorAt(resolveStops(g.stops, Math.max(rx, ry) || 1), t);
}

function boxOfPseudo(host, s) {
  const hr = host.getBoundingClientRect();
  const hs = css(host);
  if (s.position !== 'absolute' && s.position !== 'fixed') return hr;
  const pad = {
    left: hr.left + parseFloat(hs.borderLeftWidth),
    top: hr.top + parseFloat(hs.borderTopWidth),
    width: host.clientWidth,
    height: host.clientHeight,
  };
  const num = (v) => (v === 'auto' ? null : parseFloat(v));
  const [t, r, b, l, w, h] = [s.top, s.right, s.bottom, s.left, s.width, s.height].map(num);
  const width = w ?? pad.width - (l ?? 0) - (r ?? 0);
  const height = h ?? pad.height - (t ?? 0) - (b ?? 0);
  const left = l != null ? pad.left + l : r != null ? pad.left + pad.width - r - width : pad.left;
  const top = t != null ? pad.top + t : b != null ? pad.top + pad.height - b - height : pad.top;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function layerOf(node, pseudo) {
  const s = css(node, pseudo);
  if (pseudo && (s.content === 'none' || s.content === 'normal' || s.display === 'none')) return null;
  const color = parseColor(s.backgroundColor) || [0, 0, 0, 0];
  const sources = s.backgroundImage === 'none' ? [] : splitTop(s.backgroundImage);
  const box = pseudo ? boxOfPseudo(node, s) : node.getBoundingClientRect();
  const gradients = sources.map((src) => parseGradient(src)).filter(Boolean);
  const image = sources.some((src) => src.startsWith('url('));
  const opacity = pseudo ? parseFloat(s.opacity) : 1;
  if (color[3] === 0 && !gradients.length) return null;
  const sizes = s.backgroundSize.split(',').map((v) => v.trim());
  gradients.forEach((g, i) => {
    const size = sizes[i] || sizes[0];
    const tile = /^\d/.test(size) ? parseFloat(size) : 0;
    if (tile && tile < 120) {
      // Fine repeated texture (the blueprint grid): judge it by its painted share of the tile.
      const stops = resolveStops(g.stops, tile);
      let covered = 0;
      for (let k = 1; k < stops.length; k++) if (stops[k - 1].color[3] > 0) covered += stops[k].t - stops[k - 1].t;
      const strongest = g.stops.reduce((a, s) => (s.color[3] > a[3] ? s.color : a), [0, 0, 0, 0]);
      g.tile = [strongest[0], strongest[1], strongest[2], strongest[3] * Math.min(1, covered)];
    }
  });
  return { node, pseudo, box, color, gradients, image: image && !pseudo, opacity };
}

function inside(box, x, y) {
  return x >= box.left - 0.5 && x <= box.left + box.width + 0.5 && y >= box.top - 0.5 && y <= box.top + box.height + 0.5;
}

function paint(layer, base, x, y) {
  // An ancestor's own background always lies under visible text (even text scrolled inside an
  // overflow container); positioned pseudo-element layers only where their box reaches.
  if (layer.pseudo && !inside(layer.box, x, y)) return base;
  const fade = (c) => [c[0], c[1], c[2], c[3] * layer.opacity];
  let out = layer.color[3] > 0 ? over(fade(layer.color), base) : base;
  // CSS paints the first listed background image on top.
  for (const g of [...layer.gradients].reverse()) {
    const c = g.tile || gradientAt(g, layer.box, x, y);
    out = over(fade(c), out);
  }
  return out;
}

function stackFor(el) {
  // Bottom-up: html … el, each element's own background then its positioned pseudo layers.
  const chain = [];
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) chain.unshift(node);
  return chain.map((node) => ({
    node,
    layers: [layerOf(node), layerOf(node, '::before'), layerOf(node, '::after')].filter(Boolean),
  }));
}

function opacityOf(el, transient) {
  let o = 1;
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    if (transient && node.matches(transient)) continue;
    o *= parseFloat(css(node).opacity);
  }
  return o;
}

function roleOf(el, spot) {
  if (el.closest(spot) || el.closest('[aria-hidden="true"]') || el.matches(':disabled')) return 'spot';
  // The nearest block-level box that holds this text decides: running copy wraps to 3+ lines.
  let block = el;
  while (block.parentElement && /^(inline|contents)$/.test(css(block).display)) block = block.parentElement;
  const s = css(block);
  const line = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.4;
  const copy = block.matches('p,li,dd,blockquote,figcaption') || block.textContent.trim().length >= 120;
  if (copy && block.getBoundingClientRect().height / line >= 2.5) return 'body';
  return 'content';
}

function transformedBetween(node, stop) {
  for (let n = node; n && n !== stop; n = n.parentElement) if (css(n).transform !== 'none') return true;
  return false;
}

// Bounding boxes of rotated (3D) cards overlap their own captions, so for transformed content
// the overlap is confirmed with a real hit test at the text centre.
function confirmedByHitTest(el, media, range) {
  const x0 = scrollX;
  const y0 = scrollY;
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  const r = range.getBoundingClientRect();
  const stack = document.elementsFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
  scrollTo({ left: x0, top: y0, behavior: 'instant' });
  const textAt = stack.findIndex((n) => n === el || n.contains(el) || el.contains(n));
  const mediaAt = stack.indexOf(media);
  return mediaAt !== -1 && (textAt === -1 || mediaAt > textAt);
}

function mediaUnder(el, rect, range) {
  return [...document.querySelectorAll(MEDIA)].find((m) => {
    if (el.contains(m) || m.contains(el)) return false;
    const r = m.getBoundingClientRect();
    const ms = css(m);
    if (!r.width || !r.height || ms.visibility === 'hidden' || ms.display === 'none' || parseFloat(ms.opacity) === 0) return false;
    const w = Math.min(r.right, rect.right) - Math.max(r.left, rect.left);
    const h = Math.min(r.bottom, rect.bottom) - Math.max(r.top, rect.top);
    if (!(w > rect.width * 0.3 && h > rect.height * 0.5)) return false;
    let shared = m.parentElement;
    while (shared && !shared.contains(el)) shared = shared.parentElement;
    if (transformedBetween(m, shared) || transformedBetween(el, shared) || (shared && css(shared).transform !== 'none')) {
      return confirmedByHitTest(el, m, range);
    }
    return true;
  });
}

function describe(el) {
  const part = (node) => {
    let s = node.localName;
    if (node.id) s += '#' + node.id;
    const classes = [...node.classList].filter((c) => !/^(reveal|is-|has-)/.test(c)).slice(0, 2);
    if (classes.length) s += '.' + classes.join('.');
    return s;
  };
  const chain = [];
  for (let node = el; node && node.nodeType === 1 && chain.length < 3; node = node.parentElement) {
    chain.unshift(part(node));
    if (node.id) break;
  }
  return chain.join(' > ');
}

export async function revealAll({ step = 0.8, wait = 60 } = {}) {
  const start = scrollY;
  const stride = Math.max(innerHeight * step, 400); // a hidden pane can report innerHeight 0
  for (let y = 0; y < document.documentElement.scrollHeight; y += stride) {
    scrollTo({ top: y, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, wait));
  }
  scrollTo({ top: start, behavior: 'instant' });
  await new Promise((r) => setTimeout(r, wait));
}

export async function auditDocument({
  root = document.body,
  spot = SPOT,
  transientOpacity = '.reveal-pending',
  reveal = true,
} = {}) {
  if (reveal) await revealAll();
  const seen = new Map();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.data.trim() && !n.parentElement.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (seen.has(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rect = range.getBoundingClientRect();
    const s = css(el);
    const visible = rect.width > 1 && rect.height > 1 && s.visibility !== 'hidden' &&
      el.checkVisibility?.({ visibilityProperty: true, checkVisibilityCSS: true }) !== false;
    if (!visible) continue;
    const opacity = opacityOf(el, transientOpacity);
    if (opacity < 0.02) continue;
    const fill = parseColor(s.webkitTextFillColor);
    const raw = fill && fill[3] === 0 ? null : parseColor(s.color);
    const text = raw && [raw[0], raw[1], raw[2], raw[3] * opacity];
    const stack = stackFor(el);
    const under = mediaUnder(el, rect, range);
    // WebGL canvases cannot be sampled; they are listed for a visual check instead.
    const media = under && under.localName !== 'canvas' ? under : null;
    const split = media ? stack.findLastIndex(({ node }) => node.contains(media)) : -1;
    const points = [
      [rect.left + 1, rect.top + 1], [rect.right - 1, rect.top + 1],
      [rect.left + 1, rect.bottom - 1], [rect.right - 1, rect.bottom - 1],
      [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2],
    ];
    let worst = { lc: Infinity, bg: null };
    let mediaWorst = null;
    for (const [x, y] of points) {
      for (const pixel of media ? [WHITE, BLACK] : [null]) {
        let bg = WHITE;
        stack.forEach(({ layers }, i) => {
          for (const layer of layers) {
            // Overlays of the shared ancestor sit above the media; its own background sits below.
            if (i === split && layer.pseudo && pixel) continue;
            bg = paint(layer, bg, x, y);
          }
          if (i === split && pixel) {
            const r = media.getBoundingClientRect();
            if (inside(r, x, y)) bg = pixel;
            for (const layer of layers.filter((l) => l.pseudo)) bg = paint(layer, bg, x, y);
          }
        });
        if (!text) continue;
        const value = absLc(text, bg);
        if (pixel) {
          if (!mediaWorst || value < mediaWorst.lc) mediaWorst = { lc: value, bg };
        } else if (value < worst.lc) worst = { lc: value, bg };
      }
    }
    if (media) worst = mediaWorst || worst;
    const px = parseFloat(s.fontSize);
    const weight = parseInt(s.fontWeight, 10) || 400;
    const size = effectiveSize(px, s.fontFamily);
    const role = roleOf(el, spot);
    const need = bronzeMin({ size, weight, role });
    seen.set(el, {
      selector: describe(el),
      sample: n.data.trim().replace(/\s+/g, ' ').slice(0, 48),
      role,
      px: +px.toFixed(2),
      size: +size.toFixed(1),
      weight,
      color: text && worst.bg ? hex(over(text, worst.bg)) : 'gradient/clip text',
      raw: s.color,
      bg: worst.bg ? hex(worst.bg) : null,
      lc: Number.isFinite(worst.lc) ? +worst.lc.toFixed(1) : null,
      need,
      media: under ? describe(under) : null,
      gradientText: !text,
      top: Math.round(rect.top + scrollY),
    });
  }
  const items = [...seen.values()];
  const failing = (i) => i.need === null || i.lc === null || i.lc < i.need;
  const fails = items.filter((i) => !i.gradientText && failing(i));
  const group = (list) => {
    const g = new Map();
    for (const i of list) {
      const k = [i.selector, i.color, i.bg, i.px, i.weight, i.role].join('|');
      const prev = g.get(k);
      if (prev) prev.count++;
      else g.set(k, { ...i, count: 1 });
    }
    return [...g.values()].sort((a, b) => a.top - b.top);
  };
  return {
    page: location.pathname + location.search,
    viewport: `${innerWidth}x${innerHeight}`,
    checked: items.length,
    failing: fails.length,
    failures: group(fails),
    gradientText: group(items.filter((i) => i.gradientText)),
    items,
  };
}
