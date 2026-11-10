// «История одной линии» — story player v2.
//
// One master clock (seconds) drives nine segments. Blender chapters are H.264 films drawn into a
// canvas; DOM chapters (sites, worlds, films, decks, demo) live on the same 1440×810 «screen»,
// so every transition can be exact. While a film plays natively, the clock follows the video
// itself (no drift corrections); otherwise it advances with requestAnimationFrame. The player
// can be paused, scrubbed (bar, wheel, swipe, keys) and jumped by chapter; Esc returns to the site.

const M = await fetch('story/manifest.json').then((r) => r.json());
const SW = 1440;
const SH = 810;

// ---------------------------------------------------------------- helpers
const $ = (id) => document.getElementById(id);
// DOM writes that skip unchanged values: the same text written every frame was still laid out again
const setText = (el, v) => { const str = String(v); if (el.textContent !== str) el.textContent = str; };
const setAttr = (el, k, v) => { if (el.getAttribute(k) !== v) el.setAttribute(k, v); };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const fade = (x, a, b, c, d) => Math.min(smooth(a, b, x), 1 - smooth(c, d, x));
const lerpRect = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
// Animated opacity never rests at exactly 1: at 1 Chrome folds the element back into its parent's layer, and
// the next fade lifts it out again and rasterizes it anew (a caption with its blurred backdrop, the 03 site:
// 40–60 ms frames). 0.999 is a quarter of a brightness level — nothing shows. Only for what fades out again:
// a layer of its own costs memory, and many big ones freed together stall the GPU too (05 tiles).
const op = (x) => String(Math.round(clamp(x, 0, 0.999) * 10000) / 10000);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// The machine scene was designed in 200 frames and rendered at 24 fps: same mapping as Blender.
const RT_KEYS = [[1, 1], [78, 149], [160, 355], [200, 470]];
const RT = (f) => {
  for (let i = 1; i < RT_KEYS.length; i++) {
    const [a0, b0] = RT_KEYS[i - 1];
    const [a1, b1] = RT_KEYS[i];
    if (f <= a1) return b0 + ((b1 - b0) * (f - a0)) / (a1 - a0);
  }
  return RT_KEYS[RT_KEYS.length - 1][1];
};

// ---------------------------------------------------------------- films
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const quality = Math.min(innerWidth, innerHeight * 1.78) * dpr <= 1100 ? 960 : 1440;
const vault = document.createElement('div');
// Inside the viewport (2 px, transparent): browsers may suspend decoding of off-screen videos
vault.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1';
document.body.append(vault);
const clips = {};
for (const [name, info] of Object.entries(M.videos)) {
  const el = document.createElement('video');
  el.muted = true;
  el.playsInline = true;
  el.preload = 'auto';
  el.style.cssText = 'width:2px;height:2px'; // drawn into the canvas at its intrinsic size
  vault.append(el);
  clips[name] = { name, el, dur: info.dur, url: `story/video/${name}-${quality}.mp4` };
}
// Films. Desktop: every <video> gets its src — and with it a hardware decoder — under the loader (start),
// and none is torn down while the story plays (keepAlive). Phones: Android reclaims hardware decoders from
// a page that holds too many — with six alive, Chrome on Android lost the playing prologue's decoder
// («video decode error») and the story stopped. There a film gets its src shortly before it is shown
// (FIRST_USE) and gives it back once done (RELEASES): two or three decoders at a time. A seek loads any
// film at once.
const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || Boolean(navigator.userAgentData?.mobile);
const ensureSrc = (clip) => { if (!clip.el.getAttribute('src')) clip.el.src = clip.url; };
const ORDER = Object.keys(clips);
ensureSrc(clips[ORDER[0]]);
// Nothing is freed while the story plays. Chrome drops the decoder of a player that stays paused for
// 15–20 s (checked every 5 s) and builds it again on play; each teardown or rebuild is a GPU stall
// (20–40 ms; 100+ ms when a game shares the GPU). A paused player that seeks counts as active again:
// every 6 s each one with a decoder moves by a millisecond, back and forth (the same frame). Paused,
// the story stops the nudges and lets Chrome free them.
let keptAt = 0;
function keepAlive() {
  const now = performance.now();
  if (now - keptAt < 6000) return; // phones too: there only two or three players hold a decoder at a time
  keptAt = now;
  for (const el of [...Object.values(clips).map((c) => c.el), reelEl]) {
    if (!el.getAttribute('src') || !el.paused || el.seeking || el.readyState < 2) continue;
    const back = el.dataset.kick !== 'back';
    el.dataset.kick = back ? 'back' : 'fwd';
    el.currentTime = Math.max(0, el.currentTime + (back ? -0.001 : 0.001));
  }
}

function releaseMedia(el) {
  if (!el.getAttribute('src')) return;
  el.pause();
  el.removeAttribute('src');
  el.load(); // gives the decoder back now
}

// ---------------------------------------------------------------- stage geometry
const stage = $('stage');
const canvas = $('film');
const ctx = canvas.getContext('2d', { alpha: false });
let canvasPlain = null; // set while the canvas holds nothing but the page colour at its current size (see render)
const screenEl = $('screen');
// Desktop: the screen gets a layer of its own. It follows the film's focus and fits into the free area (03,
// 07, 09) with a new transform every frame, and without a layer each change re-rasterized its content (2700
// tiles over 03's first 1.4 s, ten times the raster work). Phones: no — in Android Chrome the extra layer
// cost more to composite than it saved (03: 52 fps instead of 55).
if (!MOBILE) screenEl.style.willChange = 'transform';
let W = 0;
let H = 0;
let geo = { k: 1, ox: 0, oy: 0, dw: SW, dh: SH };
const portrait = () => W / H < 0.9;
// The DOM chapters' content box (screen coordinates); captions keep the left side
const CONTENT = [560, 105, 780, 600];
// the screen geometry for a frame shift (fx) and a DOM fit (fit), in window px
function geoFor(fx = 0.5, fit = 0) {
  let dw;
  let dh;
  let oy;
  if (portrait()) {
    dh = H * 0.46;
    dw = (dh * SW) / SH;
    oy = H * 0.12;
  } else {
    const s = Math.max(W / SW, H / SH);
    dw = SW * s;
    dh = SH * s;
    oy = (H - dh) / 2;
  }
  let k = dw / SW;
  let ox = clamp(W / 2 - fx * dw, W - dw, 0);
  if (!portrait() && fit > 0) {
    // DOM chapters have no backdrop, so instead of covering the window the content box is
    // fitted into the free area right of the captions (blended back to «cover» for films)
    const gut = clamp(W * 0.055, 16, 88);
    const left = gut + Math.min(560, W * 0.42) + 24;
    const area = [left, 80, W - gut - left, H - 80 - 108];
    const kf = Math.min(area[2] / CONTENT[2], area[3] / CONTENT[3], k);
    const oxf = area[0] + (area[2] - CONTENT[2] * kf) / 2 - CONTENT[0] * kf;
    const oyf = area[1] + (area[3] - CONTENT[3] * kf) / 2 - CONTENT[1] * kf;
    k = lerp(k, kf, fit);
    ox = lerp(ox, oxf, fit);
    oy = lerp(oy, oyf, fit);
  }
  return { k, dw: SW * k, dh: SH * k, oy, ox };
}
function layout(fx = 0.5, fit = 0) {
  geo = geoFor(fx, fit);
  screenEl.style.transform = `translate(${geo.ox}px, ${geo.oy}px) scale(${geo.k})`;
}
let trackW = 0; // the progress track's width (the bar moves in device pixels)
function resize() {
  W = stage.clientWidth;
  H = stage.clientHeight;
  trackW = $('scrub').clientWidth;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvasPlain = null; // setting the size clears the canvas
  buildTicks();
  counterPlaced = false;
  draw();
}
function dissolveEdges() {
  if (!portrait()) return;
  const top = geo.oy;
  const bottom = geo.oy + geo.dh;
  for (const [edge, depth] of [[top - 3, geo.dh * 0.2], [bottom + 3, -geo.dh * 0.34]]) {
    const g = ctx.createLinearGradient(0, edge * dpr, 0, (edge + depth) * dpr);
    g.addColorStop(0, '#0c1016');
    g.addColorStop(0.08, '#0c1016');
    g.addColorStop(0.38, 'rgba(12,16,22,0.75)');
    g.addColorStop(1, 'rgba(12,16,22,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, Math.min(edge, edge + depth) * dpr, W * dpr, Math.abs(depth) * dpr);
  }
}

// ---------------------------------------------------------------- DOM chapters
const layers = Object.fromEntries(['L03', 'L05', 'L06', 'L07', 'L09'].map((id) => [id, $(id)]));
const setLayer = (...ids) => { for (const [k, el] of Object.entries(layers)) el.classList.toggle('on', ids.includes(k)); };
// A film drawn as a rectangle (05: the machine shrinking into the mosaic) gets soft edges, so its own
// lighter floor never reads as a hard box against the page
function featherRect([x, y, w, h], f) {
  const d = Math.min(f, w / 2, h / 2);
  // an edge at or past the window border is not seen: its band shrinks with the visible gap, so a
  // film that covers the window vertically keeps its floor, and the band never pops in
  const dl = Math.min(d, Math.max(0, x));
  const dr = Math.min(d, Math.max(0, canvas.width - x - w));
  const dt = Math.min(d, Math.max(0, y));
  const db = Math.min(d, Math.max(0, canvas.height - y - h));
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [
    [x, 0, x + dl, 0, x, y, dl, h], [x + w, 0, x + w - dr, 0, x + w - dr, y, dr, h],
    [0, y, 0, y + dt, x, y, w, dt], [0, y + h, 0, y + h - db, x, y + h - db, w, db],
  ]) {
    if (rw < 0.5 || rh < 0.5) continue;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#0c1016');
    g.addColorStop(1, 'rgba(12,16,22,0)');
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  }
}
const place = (el, [x, y, w, h], extra = '') => {
  el.style.left = '0px';
  el.style.top = '0px';
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.transform = `translate(${x}px, ${y}px)${extra}`;
};
// The drawn lines — 03's browser frame, 06's strip edge, 07's deck line, 09's demo frame — are stroked on the
// canvas, which is redrawn every frame anyway; their SVG shapes (hidden) only carry the geometry. Drawn as a
// dash on the SVG, every step repainted the page's root layer: 40 ms frames on desktop, lost frames on phones.
let lines = [];
const LINE_HALO = [[36, 0.03], [22, 0.07], [12, 0.16], [6, 0.42], [3, 1]]; // [width, alpha]: glow, then the line
const lineShapes = new Map();
function lineShape(el) {
  const key = el.tagName === 'path' ? el.getAttribute('d') : 'rect'; // 07's line follows the deck
  const known = lineShapes.get(el);
  if (known && known.key === key) return known;
  let path;
  let len;
  if (el.tagName === 'rect') {
    const [x, y, w, h, r] = ['x', 'y', 'width', 'height', 'rx'].map((a) => Number(el.getAttribute(a)));
    path = new Path2D();
    path.roundRect(x, y, w, h, r); // starts at (x + r, y) and runs clockwise, like the SVG rect's own dash
    len = 2 * (w + h) - 8 * r + 2 * Math.PI * r;
  } else {
    path = new Path2D(key);
    len = el.getTotalLength();
  }
  const shape = { key, path, len, color: getComputedStyle(el).stroke };
  lineShapes.set(el, shape);
  return shape;
}
// p: how much of the line is drawn (0–1), alpha: its opacity
const drawLine = (id, p, alpha = 1) => { if (p > 0.001 && alpha > 0.001) lines.push([$(id), clamp(p, 0, 1), alpha]); };
function strokeLines() {
  if (!lines.length) return;
  ctx.save();
  ctx.setTransform(geo.k * dpr, 0, 0, geo.k * dpr, geo.ox * dpr, geo.oy * dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [el, p, alpha] of lines) {
    const { path, len, color } = lineShape(el);
    ctx.setLineDash([p * len, len + 1]);
    ctx.strokeStyle = color;
    for (const [w, a] of LINE_HALO) {
      ctx.globalAlpha = a * alpha;
      ctx.lineWidth = w;
      ctx.stroke(path);
    }
  }
  ctx.restore();
}
// The first stroke with a curve in it needs a new GPU shader: 03's frame line reaching its first rounded
// corner (18.7 s) cost 40 ms on a discrete GPU (the GPU process waiting for ANGLE to compile it). Under the
// loader every kind of line — rounded corner, curve, straight, part and whole dash — is stroked once.
function prewarmStrokes() {
  const round = new Path2D();
  round.roundRect(560, 120, 780, 570, 14);
  const shapes = [[round, 2690], [new Path2D('M950 640 C950 730, 720 710, 720 810'), 300], [new Path2D('M0 236 H1440'), 1440]];
  canvasPlain = null;
  ctx.save();
  ctx.setTransform(geo.k * dpr, 0, 0, geo.k * dpr, geo.ox * dpr, geo.oy * dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#4aafff';
  for (const [path, len] of shapes) {
    for (const p of [0.3, 1]) {
      ctx.setLineDash([p * len, len + 1]);
      for (const [w, a] of LINE_HALO) {
        ctx.globalAlpha = a;
        ctx.lineWidth = w;
        ctx.stroke(path);
      }
    }
  }
  ctx.restore();
}

// 03 — sites assembled from their real layers (same paused-WAAPI approach as the site)
// DOM chapters keep the left ~40% of the screen dark for captions, like the Blender shots
const BROWSER = [560, 120, 780, 570];
const PHONE = [710, 105, 480, 600];
const VIEW_K = 780 / 1440;
for (const f of document.querySelectorAll('.viewport iframe')) f.style.transform = `scale(${VIEW_K})`;
const scenes = { A: { el: $('sceneA'), src: 'assembly-scenes/rpk.html' }, B: { el: $('sceneB'), src: 'assembly-scenes/ankor.html' } };
function setAssembly(s, p) {
  if (!s.layers || s.p === p) return; // the same state again would still restyle the page every frame
  s.p = p;
  for (const l of s.layers) l.animation.currentTime = clamp((p - l.start) / 0.8, 0, 1) * 1000;
}
for (const s of Object.values(scenes)) {
  s.el.addEventListener('load', async () => {
    const doc = s.el.contentDocument;
    if (!doc) return;
    const view = s.el.contentWindow;
    await Promise.allSettled([doc.fonts.ready, ...[...doc.images].map((im) => im.decode())]);
    s.layers = [...doc.querySelectorAll('[data-assembly-layer]')].map((el, index) => {
      const [x = 0, y = 32, angle = 0] = (el.dataset.from || '0,32,0').split(',').map(Number);
      const style = view.getComputedStyle(el);
      const base = style.transform === 'none' ? '' : style.transform;
      const animation = el.animate([
        { transform: `${base} translate3d(${x}px, ${y}px, 0) rotate(${angle}deg)`, opacity: 0 },
        { transform: base || 'none', opacity: Number(style.opacity) },
      ], { duration: 1000, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'both' });
      animation.pause();
      return { animation, start: Math.min(0.2, Number(el.dataset.order ?? index) * 0.02) };
    });
    // Where the header logo lands (measured assembled, then reset)
    setAssembly(s, 1);
    const logo = doc.querySelector('img[alt="RPK"]');
    if (logo) {
      const r = logo.getBoundingClientRect();
      s.logo = [BROWSER[0] + r.left * VIEW_K, BROWSER[1] + 28 + r.top * VIEW_K, r.width * VIEW_K, r.height * VIEW_K];
    }
    setAssembly(s, 0);
    draw();
  }, { once: true });
  s.el.src = s.src;
}

// 03's sites are rasterized ahead. The first raster of the RPK page (GPU raster, measured by trace) cost
// 50–75 ms as it faded in at 19.4 s. Through 01–02 the layer stays on at 0.3 % — under one level of
// brightness over the films (0.15 %) — with both sites assembled (RPK half-transparent over Ankor so neither
// hides the other), and in 03 nothing drops to zero before its turn, so the tiles stay in memory.
const WARM = 0.0015; // under half a level of brightness: nothing shows, yet the browser keeps it drawn
// desktop: 09's demo (a site picture in a lime frame) stays drawn at the prewarm opacity from the start, so
// its first raster happens under the loader — switched on at the road, it cost a 40 ms frame there
if (!MOBILE) {
  $('demo').style.opacity = String(WARM);
  layers.L09.classList.add('warm');
}
function prewarm03() {
  // phones: no — compositing a near-invisible layer every frame halved the frame rate in Android Chrome
  if (MOBILE) { setLayer(null); return; }
  setLayer('L03');
  const browser = $('browser');
  place(browser, BROWSER);
  browser.style.opacity = op(WARM);
  scenes.A.el.style.opacity = '0.5';
  scenes.B.el.style.opacity = op(1);
  setAssembly(scenes.A, 1);
  setAssembly(scenes.B, 1);
  // the RPK mark that flies out of the logos film, at the size it starts with (~4×), and the browser frame
  const r = M.rpk_rect;
  $('rpkFly').style.transform = `translate(${r[0]}px, ${r[1]}px) scale(${r[2] / 212})`;
  $('rpkFly').style.opacity = op(WARM);
  $('phone').style.opacity = '0';
}

// 05's tiles and the lobby render are rasterized during 04 the same way (their first raster as the mosaic
// appears: up to 40 ms on phones)
function prewarm05() {
  if (MOBILE) { setLayer(null); return; } // see prewarm03
  setLayer('L05');
  $('tiles').style.transform = 'scale(1)';
  for (const tile of TILES) {
    if (!tile.el) continue;
    place(tile.el, tile.rect, '');
    tile.el.style.opacity = String(WARM);
  }
  $('pano').style.opacity = String(WARM);
}

// 05 — mosaic of worlds; the machine film shrinks into the centre tile
const LOBBY_IMG = 'story/img/saf-lobby.webp'; // SAF Avenue lobby, CAM_P09, 16:9 crop of the UE path-traced still
const TILE_IMG = ['arch-saf-lobby-1', 'cg-vr-canyon-1', 'cg-mob-heads-1', 'cg-mobika-key', null, 'arch-saf-night', 'cg-metahuman', 'cg-mob-striker', 'arch-saf-north'];
const TILES = [];
{
  const m = 40;
  const g = 16;
  const tw = (SW - 2 * m - 2 * g) / 3;
  const th = (SH - 2 * m - 2 * g) / 3;
  TILE_IMG.forEach((id, i) => {
    const rect = [m + (i % 3) * (tw + g), m + Math.floor(i / 3) * (th + g), tw, th];
    let el = null;
    if (id) {
      el = document.createElement('div');
      el.className = 'tile';
      // tile 0 is zoomed to full screen: it shows the story's 16:9 lobby render (the same file as #pano)
      el.innerHTML = `<img src="${i === 0 ? LOBBY_IMG : `assets/work/${id}-sm.webp`}" alt="" decoding="async">`;
      $('tiles').append(el);
    }
    TILES.push({ rect, el });
  });
}
// zoom the whole mosaic so that tile 0 (SAF lobby) fills the screen
function mosaicRect(rect, z) {
  const [x0, y0, w0, h0] = TILES[0].rect;
  const S = SW / w0; // tile 0 grows to the full width, centred vertically
  const s = lerp(1, S, z);
  const tx = lerp(0, -x0 * S, z);
  const ty = lerp(0, -y0 * S + (SH - h0 * S) / 2, z);
  return [rect[0] * s + tx, rect[1] * s + ty, rect[2] * s, rect[3] * s];
}

// The SAF lobby render is scaled by the tiles' drift (1.03) when it takes over from tile 0, then
// pushes in slowly; the strip's first cell starts at that same size, so 05 → 06 is one picture
const LOBBY_PUSH = 1.035;
const lobbyScale = (tl) => 1.03 * lerp(1, LOBBY_PUSH, ease(smooth(6.0, 8.6, tl)));

// 06 — film strip of real loops
const CELLS = [
  { img: LOBBY_IMG },
  { video: 'v-ztk-opener' }, { video: 'v-a4r-night' }, { video: 'v-astana' },
  { img: 'assets/video/yurt.jpg', src: 'assets/video/yurt.mp4', wide: true },
  { video: 'v-gof-sparks' }, { video: 'v-mobika-opener' },
];
const strip = $('strip');
CELLS.forEach((c) => {
  const el = document.createElement('div');
  el.className = `cell${c.wide ? ' wide' : ''}`;
  const poster = c.img || `assets/work/video/${c.video}.webp`;
  el.innerHTML = `<img src="${poster}" alt="" decoding="async">`;
  c.hasVideo = Boolean(c.video || c.src);
  strip.append(el);
  c.el = el;
});
let stripX = [];
function measureStrip() {
  let x = 26;
  stripX = CELLS.map((c) => { const w = c.wide ? 1080 : 480; const centre = x + w / 2; x += w + 22; return centre; });
}
measureStrip();
const stripRun = (tl) => smooth(1.4, 8.6, tl);
const nearestCell = (centreX) => stripX.reduce((k, x, i) => (Math.abs(x - centreX) < Math.abs(stripX[k] - centreX) ? i : k), 0);
// 06: one reel instead of six loops (scrollytelling/blender/build_reel.py). Six players were six hardware
// decoders: six first plays and six teardowns, each a GPU stall. The reel runs on the story clock from 06
// time REEL_FROM and stands over the cell at the centre; which cell is read off the reel's own frame, so
// picture and cell never part. A cell's poster shows until the reel has a frame.
const REEL_FROM = 1.2;
const cellAt = (tl) => nearestCell(lerp(stripX[0], stripX[stripX.length - 1], stripRun(tl)));
const reelBox = document.createElement('div');
reelBox.className = 'reel';
const reelEl = document.createElement('video');
reelEl.muted = true;
reelEl.playsInline = true;
reelEl.preload = 'auto';
reelBox.append(reelEl);
const ring = document.createElement('div');
ring.className = 'ring';
strip.append(reelBox, ring);
const reel = { name: 'reel', el: reelEl, dur: 7.79, url: `story/video/reel-${quality === 1440 ? 1280 : 640}.mp4` };
let reelCell = -1;
// a film that loses its decoder (Android reclaims them under pressure) loads again and is synced back
// to the story clock, instead of leaving the story buffering for ever
for (const c of [...Object.values(clips), reel]) {
  c.el.addEventListener('error', () => {
    c.retries = (c.retries ?? 0) + 1;
    if (!c.el.getAttribute('src') || c.retries > 3) return;
    releaseMedia(c.el);
    ensureSrc(c);
    draw();
  });
}
function showReel(local) {
  if (local < 0) {
    reelBox.style.opacity = '0';
    ring.style.opacity = '0';
    if (!reelEl.paused) reelEl.pause();
    return;
  }
  syncClip(reel, local);
  const ready = reelEl.readyState >= 2;
  // the frame on screen, + half a frame: build_reel.py cut the segments at frame centres
  const cell = cellAt(REEL_FROM + (ready ? reelEl.currentTime : local) + 0.5 / 24);
  const c = CELLS[cell];
  // never fully off during the chapter: the reel's layer is set up before its first cell
  reelBox.style.opacity = ready && c.hasVideo ? op(1) : String(WARM);
  if (cell === reelCell) return;
  reelCell = cell;
  const w = c.wide ? 1080 : 480;
  const vh = (w * 9) / 16; // the reel is 16:9; the wide cell's 4:1 loop is a band across its middle
  reelBox.style.left = `${stripX[cell] - w / 2}px`;
  reelBox.style.width = `${w}px`;
  reelEl.style.height = `${vh}px`;
  reelEl.style.top = `${(270 - vh) / 2}px`;
}

// 07 — deck fan
const DECKS = ['p-wtk', 'p-icanfly', 'p-togys', 'p-sakai', 'p-gof', 'p-vr-museum', 'p-saf', 'p-detox', 'p-eltanba'];
const LEAD = 4;
const deckEls = DECKS.map((id, i) => {
  const el = document.createElement('div');
  el.className = `deck${i === LEAD ? ' lead' : ''}`;
  el.innerHTML = `<img src="assets/work/decks/${id}-1-sm.webp" alt="" decoding="async">`;
  $('decks').append(el);
  return el;
});

// ---------------------------------------------------------------- segments
const V = M.videos;
// Portrait «smart crop»: piecewise-linear keys [time, x] (x = 0..1 across the 16:9 frame)
const keyed = (keys, x) => {
  if (!keys?.length) return 0.5;
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (x <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], (x - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]));
  }
  return keys[keys.length - 1][1];
};
// exported per film from the luminance centroid; the prologue follows the thin line by hand
const focusAt = (name, ft) => keyed(V[name]?.focus, ft);
const PROLOGUE_FOCUS = [[0, 0.6], [3.0, 0.62], [5.4, 0.42], [8.6, 0.45]];
const machine = M.machine;
const SCREEN_RECT = machine.screen_rect.map((v, i) => v * (i % 2 ? SH : SW));
const TARGET = [SCREEN_RECT[0], SCREEN_RECT[1], SCREEN_RECT[2] - SCREEN_RECT[0], SCREEN_RECT[3] - SCREEN_RECT[1]];
const HAND = 2.0;
const SIGNS = M.road.signs;
// the plate names a sign while it is still ahead and readable: about 2/3 of the gap between signs
const SIGN_LEAD = Math.round(0.65 * (SIGNS[1].frame - SIGNS[0].frame));

const SEG = [
  { id: '01', title: 'Идея', dur: V.prologue.dur + 0.2, video: ['prologue', 0] },
  { id: '02', title: 'Знак', dur: V.logos.dur, video: ['logos', 0] },
  { id: '03', title: 'Интерфейс', dur: 11.0 },
  { id: '04', title: 'Механизм', dur: HAND + V.machine.dur, video: ['machine', HAND] },
  { id: '05', title: 'Мир', dur: 8.6 },
  { id: '06', title: 'Видео', dur: 10.0 },
  { id: '07', title: 'Презентации', dur: 7.5 },
  { id: '08', title: 'Возможности', dur: V.road.dur, video: ['road', 0] },
  { id: '09', title: 'Финал', dur: 3.6 + V.finale.dur, video: ['finale', 3.6] },
];
let acc = 0;
for (const s of SEG) { s.start = acc; acc += s.dur; }
const DURATION = acc;
// phones: when a film is first shown and how early it gets its decoder; when it gives it back
const player = (name) => (name === 'reel' ? reel : clips[name]);
// [film, when it is first shown, when its decoder is set up]: setting one up stalls a phone for 0.1–0.4 s
// (Android Chrome in the emulator), so each comes at a calm moment — 03's crossfade, 05's resting
// mosaic, 07's resting fan — and is kept alive until its turn (keepAlive)
const FIRST_USE = [['logos', SEG[1].start, 0], ['machine', SEG[3].start, SEG[2].start + 5.0], ['reel', SEG[5].start + REEL_FROM, SEG[4].start + 2.2], ['road', SEG[7].start, SEG[6].start + 2.7], ['finale', SEG[8].start + 3.2, SEG[6].start + 3.7]];
// 07's resting fan holds four decoder events, half a second apart: machine out, road in, reel out, finale in
const RELEASES = [['prologue', SEG[1].start + 1.3], ['logos', SEG[2].start + 3.6], ['machine', SEG[6].start + 2.2], ['reel', SEG[6].start + 3.2]];
const machineFrame = (tl) => (tl - HAND - V.machine.lead) * M.fps;
const segOf = (t) => SEG.find((s) => t < s.start + s.dur) || SEG[SEG.length - 1];
const CHAPTERS = SEG.map((s) => ({ id: s.id, title: s.title, t: s.start }));
// Chapter 05 «Мир» begins with the wipe inside the machine film
CHAPTERS[4] = { id: '05', title: 'Мир', t: SEG[3].start + HAND + V.machine.lead + RT(150) / M.fps };

// Each segment draws itself for a local time tl and returns the film to show (if any).
const caps = [...document.querySelectorAll('.cap[data-seg]')];
const special = Object.fromEntries([...document.querySelectorAll('[data-cap]')].map((el) => [el.dataset.cap, el]));
// 04: the parts counter goes right under the caption column, never over its text. Pinned to the
// bottom it covered the caption's last lines on 720–768 px high windows. Measured on resize.
let counterPlaced = false;
function placeCounter() {
  counterPlaced = true;
  const box = special.count;
  if (portrait()) { box.style.top = ''; box.style.bottom = ''; return; }
  const caps = [special.m04, special.m05];
  const capTop = Math.min(...caps.map((el) => el.offsetTop - el.offsetHeight / 2)); // they sit at top 50%, translateY(-50%)
  const capBottom = Math.max(...caps.map((el) => el.offsetTop + el.offsetHeight / 2));
  const h = box.offsetHeight;
  let top = capBottom + 46;
  if (top + h > H - 132) top = Math.max(76, capTop - h - 46); // no room below: above the caption
  box.style.top = `${Math.round(top)}px`;
  box.style.bottom = 'auto';
}
document.fonts?.ready.then(() => { counterPlaced = false; trackW = $('scrub').clientWidth; draw(); });

function render03(tl) {
  setLayer('L03');
  const a = scenes.A;
  const b = scenes.B;
  // RPK logo leaves the logos film and lands in the site header
  const fly = $('rpkFly');
  const from = M.rpk_rect;
  const to = a.logo || [BROWSER[0] + 60, BROWSER[1] + 50, 110, 42];
  const f = ease(smooth(0.8, 2.3, tl));
  const r = lerpRect(from, to, f);
  fly.style.transform = `translate(${r[0]}px, ${r[1]}px) scale(${r[2] / 212})`;
  fly.style.opacity = op(tl < 2.4 ? Math.max(WARM, smooth(0.05, 0.6, tl)) : 1 - smooth(2.4, 3.1, tl)); // dissolves in over the 3D mark first
  drawLine('bframe', smooth(0.7, 2.0, tl), smooth(0.6, 0.8, tl) * (1 - smooth(2.3, 2.9, tl)));
  // site fades out → the empty frame reshapes into a phone → the phone screen lights up
  const browser = $('browser');
  const morph = ease(smooth(8.6, 9.7, tl));
  place(browser, lerpRect(BROWSER, PHONE, morph));
  browser.style.borderRadius = `${lerp(14, 26, morph)}px`;
  browser.style.opacity = op(tl < 9.7 ? Math.max(WARM, smooth(1.6, 2.3, tl)) : 1 - smooth(9.7, 9.85, tl));
  browser.querySelector('.tabbar').style.opacity = op(1 - smooth(8.4, 8.8, tl));
  const edge = smooth(8.2, 8.7, tl);
  browser.style.boxShadow = `0 0 0 2px rgba(74, 175, 255, ${edge}), 0 0 22px rgba(74, 175, 255, ${0.55 * edge}), 0 30px 80px #000a`;
  a.el.style.opacity = op(tl < 5.0 ? Math.max(WARM, smooth(1.9, 2.3, tl)) : 1 - smooth(5.0, 5.6, tl));
  b.el.style.opacity = op(tl < 8.1 ? Math.max(WARM, smooth(5.0, 5.6, tl)) : 1 - smooth(8.1, 8.6, tl));
  setAssembly(a, smooth(2.0, 5.0, tl) * 1.0);
  setAssembly(b, smooth(5.4, 8.0, tl));
  setText($('tabName'), tl < 5.3 ? 'rpk.kz' : 'ankor.kz');
  const phone = $('phone');
  place(phone, PHONE);
  phone.style.opacity = op(smooth(9.6, 9.75, tl));
  phone.style.borderRadius = '26px';
  phone.querySelector('img').style.opacity = op(smooth(9.7, 10.3, tl));
  phone.style.backgroundColor = '#05080c';
  // the frame shift moves together with the fit, so the RPK of the film and of the DOM coincide
  const settle = ease(smooth(0.3, 1.6, tl));
  // the flat mark has covered the 3D one before the film under it goes: no grey midpoint
  return { v: tl < 1 ? 'logos' : null, t: V.logos.dur, alpha: 1 - smooth(0.5, 0.95, tl), fx: lerp(0.5, 0.58, settle), fxp: lerp(focusAt('logos', V.logos.dur), 0.66, settle), fit: settle };
}

// Films with a caption column (04 machine, 09 finale K): covering the window put the subject under the
// captions on 16:10 and 4:3 windows (in 09 the scrim cut the K's arm in the very last frame). The film
// moves instead into the free area right of the captions, never larger than «cover», shrinking if the
// subject does not fit; the edges it opens are feathered into the page. Boxes are shares of the frame.
const FILM_FEATHER = 120;
// the whole film in window px for a frame shift and DOM fit
function filmWin(fx = 0.5, fit = 0) {
  const g = geoFor(fx, fit);
  return [g.ox, g.oy, g.dw, g.dh];
}
// window px → the film rect render() expects (screen units over the geometry of fx and fit)
function toScreen([x, y, w, h], fx = 0.5, fit = 0) {
  const g = geoFor(fx, fit);
  return [(x - g.ox) / g.k, (y - g.oy) / g.k, w / g.k, h / g.k];
}
function placeBox([bx, by, bw, bh], widest = bw) {
  const ck = Math.max(W / SW, H / SH);
  const gut = clamp(W * 0.055, 16, 88);
  const left = gut + Math.min(560, W * 0.42) + 16;
  const area = [left, 64, W - gut / 2 - left, H - 64 - 96];
  const k = Math.min(ck, area[2] / (widest * SW), area[3] / (bh * SH));
  const fw = SW * k;
  const fh = SH * k;
  const x = Math.max(area[0] + area[2] / 2 - (bx + bw / 2) * fw, W - fw); // never a gap on the right
  let y = area[1] + area[3] / 2 - (by + bh / 2) * fh;
  if (fh >= H) y = clamp(y, H - fh, 0);
  return [x, y, fw, fh];
}
// the film as the geometry draws it (m = 0) → its subject placed right of the captions (m = 1)
const placed = (box, m, fx = 0.5, fit = 0, widest = box[2]) =>
  (portrait() ? filmWin(fx, fit) : lerpRect(filmWin(fx, fit), placeBox(box, widest), m));

// 01: the K until the camera pans (f1–84, with the line's first metres)
const PRO_BOX = [0.36, 0.19, 0.5, 0.66];
// 04: the machine over the whole assembly (f95–470)
const MACH_BOX = [0.35, 0.14, 0.41, 0.74];
const machineWin = (m) => placed(MACH_BOX, m);
const machineRect = (m = 1) => toScreen(machineWin(m));
// 09: the K drifts left while the orange line flies in (film frame → x from, x to); the film follows it,
// so the K holds its place right of the contacts. Scale comes from the widest box: no zoom.
const K_TRACK = [[1, 0.48, 0.99], [30, 0.45, 0.96], [60, 0.39, 0.89], [90, 0.355, 0.84], [132, 0.35, 0.83]];
const K_Y = [0.21, 0.63];
function kBox(ft) {
  const fr = ft * M.fps + 1;
  let i = 1;
  while (i < K_TRACK.length - 1 && fr > K_TRACK[i][0]) i++;
  const [f0, a0, b0] = K_TRACK[i - 1];
  const [f1, a1, b1] = K_TRACK[i];
  const u = clamp((fr - f0) / (f1 - f0), 0, 1);
  const a = lerp(a0, a1, u);
  return [a, K_Y[0], lerp(b0, b1, u) - a, K_Y[1]];
}

function render04(tl) {
  const h = clamp(tl / HAND, 0, 1);
  if (h < 1) {
    setLayer('L03');
    $('browser').style.opacity = '0';
    $('rpkFly').style.opacity = '0';
    const e = ease(h);
    const phone = $('phone');
    place(phone, lerpRect(PHONE, TARGET, e));
    phone.style.borderRadius = `${lerp(26, 6, e)}px`;
    phone.style.opacity = op(1 - smooth(0.86, 1, h));
    const content = 1 - smooth(0.5, 0.9, h);
    phone.querySelector('img').style.opacity = op(content);
    phone.style.backgroundColor = `rgba(5, 8, 12, ${content.toFixed(3)})`;
  } else {
    prewarm05();
  }
  const f = machineFrame(tl);
  showCap(special.m04, fade(f, RT(14), RT(30), RT(128), RT(146)));
  showCap(special.m05, smooth(RT(152), RT(168), f) * (1 - smooth(V.machine.dur - 0.6, V.machine.dur, tl - HAND)));
  showPlain(special.dim, fade(f, RT(42), RT(56), RT(98), RT(112)));
  if (!counterPlaced) placeCounter();
  showPlain(special.count, fade(f, RT(58), RT(70), RT(158), RT(170)));
  const fi = clamp(Math.round(f), 0, machine.parts_landed.length - 1);
  setText($('parts'), machine.parts_landed[fi]);
  let steps = 0;
  for (const [, [, end]] of Object.entries(machine.steps)) if (end <= fi + 1) steps++;
  setText($('step'), steps);
  // the move rides the camera's own flight from the screen to the blueprint (render frames ~40–110)
  const m = ease(smooth(RT(22), RT(58), f));
  if (!portrait()) {
    // the size chip stands under the machine's feet (frame y ≈ 0.8 while it shows), not over them
    const [wx, wy, ww, wh] = machineWin(m);
    special.dim.style.transform = `translate(${Math.round(wx + (MACH_BOX[0] + MACH_BOX[2] / 2) * ww)}px, ${Math.round(wy + 0.845 * wh)}px) translateX(-50%)`;
  }
  // negative until the hand-over ends: the film waits paused on its first frame (syncClip clamps the
  // target to 0) instead of playing and being pulled back to 0 every 0.35 s, which also made the
  // story clock jump 0.1–0.3 s at the start of the film
  return { v: 'machine', t: tl - HAND, alpha: smooth(0.6, 1.7, tl), rect: machineRect(m), feather: portrait() ? 0 : FILM_FEATHER * m, fxp: h < 1 ? lerp(0.66, focusAt('machine', 0), ease(h)) : focusAt('machine', tl - HAND), fit: 1 - ease(h) };
}

function render05(tl) {
  setLayer('L05');
  const z = ease(smooth(4.0, 5.8, tl));
  // the mosaic's slow drift (+3 % about the screen centre) scales the whole layer on the GPU; resizing every
  // tile instead re-rasterized eight images with their shadows on every frame of it
  const drift = 1 + 0.03 * smooth(1.6, 4.0, tl);
  $('tiles').style.transform = `scale(${drift.toFixed(5)})`;
  TILES.forEach((tile, i) => {
    if (!tile.el) return;
    const appear = smooth(0.5 + i * 0.07, 1.3 + i * 0.07, tl);
    place(tile.el, mosaicRect(tile.rect, z), ` scale(${lerp(0.9, 1, appear)})`);
    tile.el.style.opacity = String(Math.max(WARM, appear)); // fades in, never out: at 0.999 eight zoomed tiles kept layers of their own, freed at once at 05 → 06
  });
  const pano = $('pano');
  pano.style.opacity = String(Math.max(WARM, smooth(5.2, 6.0, tl))); // fades in only (see the tiles)
  // the lobby render takes over from the zoomed tile (same picture, same place, sharper), then pushes in
  pano.querySelector('img').style.transform = `scale(${lobbyScale(tl).toFixed(4)})`;
  // the machine film shrinks into the centre tile, then rides the zoom out of frame
  const shrink = ease(smooth(0.1, 1.6, tl));
  const centre = mosaicRect(TILES[4].rect, z);
  const c = [SW / 2 + (centre[0] - SW / 2) * drift, SH / 2 + (centre[1] - SH / 2) * drift, centre[2] * drift, centre[3] * drift];
  return { v: 'machine', t: V.machine.dur, rect: lerpRect(machineRect(), c, shrink), feather: lerp(portrait() ? 0 : FILM_FEATHER, 70, shrink), alpha: 1 - smooth(5.4, 6.0, tl), fxp: lerp(focusAt('machine', V.machine.dur), 0.5, shrink) };
}

function render06(tl) {
  setLayer('L06');
  // the lobby render becomes the first frame of the strip, then the strip runs left
  const intro = ease(smooth(0, 1.6, tl));
  const run = stripRun(tl);
  const first = stripX[0];
  const last = stripX[stripX.length - 1];
  const centreX = lerp(first, last, run);
  // geometric zoom: a linear one in scale crawls at first and rushes at the end
  const s0 = (SW / 480) * lobbyScale(99);
  const scale = s0 * Math.pow(1 / s0, intro);
  // origin = the cells' vertical centre, which already sits on the screen centre (y 405)
  strip.style.transformOrigin = '0 169px';
  strip.style.transform = `translate(${SW / 2 - centreX * scale}px, 0px) scale(${scale})`;
  strip.style.opacity = op(1 - smooth(9.0, 10.7, tl)); // finishes over the start of 07
  drawLine('stripEdge', smooth(0.9, 2.2, tl) * (1 - smooth(8.6, 9.4, tl)));
  // the cell nearest the centre plays: its ring, and the reel over it
  const live = nearestCell(centreX);
  const turn = tl > REEL_FROM && tl < 9.0;
  const lw = CELLS[live].wide ? 1080 : 480;
  ring.style.width = `${lw}px`;
  ring.style.transform = `translateX(${stripX[live] - lw / 2}px)`;
  ring.style.opacity = turn && CELLS[live].hasVideo ? op(1) : String(WARM);
  showReel(turn ? tl - REEL_FROM : -1);
  return null;
}

function render07(tl) {
  if (tl < 0.8) { render06(10 + tl); setLayer('L06', 'L07'); } else setLayer('L07');
  $('L07').style.opacity = op(1);
  const fan = ease(smooth(0.2, 1.4, tl));
  const lead = ease(smooth(4.4, 6.2, tl));
  deckEls.forEach((el, i) => {
    const k = i - LEAD;
    const breathe = Math.sin((tl + i) * 0.9) * 0.6 * smooth(1.4, 2.0, tl);
    if (i === LEAD) {
      const r = lerpRect([780, 250, 240, 300], [560, 186, 780, 439], lead);
      place(el, r, ` rotate(${breathe * (1 - lead)}deg)`);
      el.style.transformOrigin = '50% 50%';
      el.style.zIndex = '20';
      el.style.opacity = op(smooth(0.15, 0.75, tl) * (1 - smooth(6.5, 7.1, tl))); // only the line is left at the cut
    } else {
      place(el, [780, 250, 240, 300], ` rotate(${k * 10 * fan + breathe}deg) translateY(${-Math.abs(k) * 6 * fan}px)`);
      el.style.zIndex = String(10 - Math.abs(k));
      el.style.opacity = op((1 - smooth(4.2, 5.4, tl)) * smooth(0.2, 0.8, tl));
    }
  });
  drawLine('deckLine', smooth(6.2, 7.3, tl));
  // from the deck down to the screen centre, where the road's centre line begins
  const y0 = lerp(550, 625, lead);
  $('deckLine').setAttribute('d', `M950 ${y0} C950 ${y0 + 90}, 720 ${y0 + 70}, 720 810`);
  const out = ease(smooth(7.0, 7.5, tl));
  return { fx: lerp(0.58, 0.5, out), fxp: lerp(0.66, 0.5, out), fit: 1 - out };
}

function render08(tl) {
  // the deck's line dissolves into the road's centre marking
  if (tl < 1.0) {
    render07(7.5);
    $('L07').style.opacity = op(1 - smooth(0.15, 1.0, tl));
    for (const l of lines) l[2] *= 1 - smooth(0.15, 1.0, tl); // the deck line fades with the deck
  } else {
    setLayer(null);
  }
  const f = tl * M.fps;
  let idx = -1;
  SIGNS.forEach((s, i) => { if (f >= s.frame - SIGN_LEAD) idx = i; });
  const box = special.mile;
  if (idx >= 0) {
    setText($('mileHead'), SIGNS[idx].title);
    setText($('mileNote'), SIGNS[idx].note);
  }
  // the plate repeats the sign being passed; it starts once the chapter caption has gone (ends at 2.3 s)
  const on = Math.max(2.3 * M.fps, SIGNS[0].frame - SIGN_LEAD); // after the chapter caption, with the first sign
  showPlain(box, smooth(on, on + 0.4 * M.fps, f) * (1 - smooth(V.road.dur - 1.2, V.road.dur - 0.5, tl)));
  return { v: 'road', t: tl, alpha: smooth(0.05, 0.9, tl), fxp: lerp(0.5, focusAt('road', tl), smooth(0, 1, tl)) };
}

function render09(tl) {
  setLayer(tl < 3.9 ? 'L09' : null);
  drawLine('demoFrame', smooth(0.2, 1.3, tl) * (1 - smooth(1.6, 2.1, tl)));
  $('demo').style.opacity = op(tl < 3.0 ? Math.max(MOBILE ? 0 : WARM, smooth(0.9, 1.6, tl)) : 1 - smooth(3.0, 3.7, tl));
  const into = ease(smooth(0.1, 0.8, tl));
  if (tl < 3.2) return { v: 'road', t: V.road.dur, alpha: 1 - smooth(0, 0.7, tl), fx: lerp(0.5, 0.58, into), fxp: lerp(focusAt('road', V.road.dur), 0.66, into), fit: into };
  const back = ease(smooth(3.0, 3.9, tl));
  // the K goes straight from the demo's fitted frame to its place right of the captions: it never
  // passes under the fading «Ваш проект» caption, and the contacts (4.6) find it already there
  const m = ease(smooth(3.2, 4.4, tl));
  const fit = 1 - back;
  const rect = toScreen(placed(kBox(Math.max(0, tl - 3.6)), m, 0.6, fit, K_TRACK[0][2] - K_TRACK[0][1]), 0.6, fit);
  return { v: 'finale', t: tl - 3.6, alpha: smooth(3.2, 3.9, tl), fx: 0.6, rect, feather: portrait() ? 0 : FILM_FEATHER * m, fxp: lerp(0.66, focusAt('finale', tl - 3.6), back), fit };
}

const RENDER = {
  '01': (tl) => {
    prewarm03();
    // the opening K stands right of the title (its scrim used to cut the K's white arm); the film
    // returns to «cover» while the camera pans after the line leaves the blade (3.6–4.8 s)
    const m = 1 - ease(smooth(3.6, 4.8, tl));
    return { v: 'prologue', t: tl, alpha: 1, rect: m > 0 ? toScreen(placed(PRO_BOX, m)) : null, feather: portrait() ? 0 : FILM_FEATHER * m, fxp: keyed(PROLOGUE_FOCUS, tl) };
  },
  '02': (tl) => {
    prewarm03();
    // the prologue's line dissolves under the logos film (it used to cut to black for ~0.5 s)
    const under = { v: 'prologue', t: V.prologue.dur, alpha: 1 - smooth(0, 1.1, tl) };
    return { v: 'logos', t: tl, alpha: 1, under, fxp: lerp(keyed(PROLOGUE_FOCUS, 99), focusAt('logos', tl), smooth(0, 0.8, tl)) };
  },
  '03': render03, '04': render04, '05': render05, '06': render06, '07': render07, '08': render08, '09': render09,
};

// ---------------------------------------------------------------- captions
// Every caption carries its own dark backdrop (story.css .cap::before), so text stays readable over any frame
function showCap(el, o) {
  const narrow = W < 760;
  el.style.opacity = op(o);
  el.style.visibility = o > 0.001 ? 'visible' : 'hidden';
  const low = narrow || el.classList.contains('cap-low');
  el.style.transform = low ? `translateY(${(1 - o) * 14}px)` : `translateY(calc(-50% + ${(1 - o) * 18}px))`;
}
function showPlain(el, o) {
  el.style.opacity = op(o);
  el.style.visibility = o > 0.001 ? 'visible' : 'hidden';
}

// ---------------------------------------------------------------- clock
let t = 0;
let playing = false;
let glideTo = null; // wheel/swipe target (see glideBy)
let glideRaf = 0;
let glideLast = 0;
function stopGlide() { if (glideRaf) cancelAnimationFrame(glideRaf); glideTo = null; glideRaf = 0; glideLast = 0; }
let autoplay = !reduced && params.get('autoplay') !== '0';
let last = 0;
let ready = false;
let revealed = false; // the loader leaves only once the first frames are playing
function activeVideo() {
  const s = segOf(t);
  if (!s.video) return null;
  const [name, offset] = s.video;
  const local = t - s.start - offset;
  if (local < 0 || local >= clips[name].dur - 0.05) return null;
  return { clip: clips[name], offset: s.start + offset };
}
function play() {
  stopGlide();
  if (t >= DURATION - 0.05) t = 0;
  playing = true;
  document.body.classList.remove('paused');
  $('play').setAttribute('aria-label', 'Пауза');
  last = performance.now();
  requestAnimationFrame(tick);
  armIdle();
}
function pause() {
  playing = false;
  document.body.classList.add('paused');
  $('play').setAttribute('aria-label', 'Смотреть');
  for (const c of Object.values(clips)) if (!c.el.paused) c.el.pause();
  if (!reelEl.paused) reelEl.pause();
  wake();
  draw();
}
function tick(now) {
  if (!playing) return;
  // Up to 0.25 s per frame: slow devices still play in real time (hidden tabs pause separately)
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  const act = activeVideo();
  let waiting = false;
  if (act) {
    const el = act.clip.el;
    if (el.readyState < 3) waiting = true;
    else if (!el.paused && !el.seeking) t = act.offset + el.currentTime; // the film is the clock
    else t = Math.min(DURATION, t + dt);
  } else {
    t = Math.min(DURATION, t + dt);
  }
  document.body.classList.toggle('buffering', waiting);
  $('loader').classList.toggle('done', !waiting && ready && revealed);
  if (t >= DURATION) { t = DURATION; pause(); }
  render();
  if (playing) requestAnimationFrame(tick);
}
function seek(next, keepPlaying = false) {
  stopGlide();
  t = clamp(next, 0, DURATION);
  if (!keepPlaying && playing) pause();
  draw();
}

// ---------------------------------------------------------------- render
let queued = false;
function draw() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; render(); });
}
function syncClip(clip, local) {
  ensureSrc(clip);
  const el = clip.el;
  const target = clamp(local, 0, Math.max(0, clip.dur - 0.04));
  const live = playing && local >= 0 && local < clip.dur - 0.05;
  if (live) {
    if (el.paused) {
      if (Math.abs(el.currentTime - target) > 0.05) el.currentTime = target;
      el.play().catch(() => {});
    } else if (Math.abs(el.currentTime - target) > 0.35) {
      el.currentTime = target; // only after a seek or a stall
    }
  } else {
    if (!el.paused) el.pause();
    if (!el.seeking && Math.abs(el.currentTime - target) > 0.02) el.currentTime = target;
  }
}
for (const c of Object.values(clips)) c.el.addEventListener('seeked', () => draw());

function render() {
  if (!W) return;
  lines = [];
  if (!MOBILE && t < SEG[8].start) $('demo').style.opacity = String(WARM);
  const s = segOf(t);
  const tl = t - s.start;
  for (const c of caps) {
    // desktop: a caption's layer (text and blurred backdrop) is rasterized in the 3 s before it shows,
    // at the prewarm opacity, one or two at a time; its first raster cost ~40 ms on a 2.6× screen
    const tIn = c.dataset.in ? SEG.find((g) => g.id === c.dataset.seg).start + Number(c.dataset.in) : NaN;
    const warm = !MOBILE && t >= tIn - 3 && t < tIn;
    if (c.dataset.seg !== s.id || !c.dataset.in) {
      if (warm) showCap(c, WARM);
      else if (c.dataset.seg !== s.id || !c.dataset.cap) showCapOff(c);
      continue;
    }
    showCap(c, Math.max(warm ? WARM : 0, fade(tl, Number(c.dataset.in), Number(c.dataset.in) + 0.6, Number(c.dataset.out) - 0.6, Number(c.dataset.out))));
  }
  for (const key of ['dim', 'count', 'mile']) if (!(s.id === '04' && key !== 'mile') && !(s.id === '08' && key === 'mile')) showPlainOff(special[key]);
  if (s.id !== '04') { showCapOff(special.m04); showCapOff(special.m05); }
  const film = RENDER[s.id](tl);
  // DOM chapters sit on the right of the screen: in portrait, centre on that content instead
  layout(portrait() && film?.fxp ? film.fxp : (film?.fx ?? 0.5), film?.fit ?? 0);

  // film
  const wanted = film?.v ? clips[film.v] : null; // a segment may only shift the frame (fx)
  // film.under: the previous film held on a frame and dissolving under this one (no dip to black)
  const under = film?.under && film.under.alpha > 0.001 ? film.under : null;
  const underClip = under ? clips[under.v] : null;
  if (MOBILE) {
    for (const [name, at, from] of FIRST_USE) if (t >= from && t < at + 1) ensureSrc(player(name));
    for (const [name, at] of RELEASES) {
      const p = player(name);
      if (t >= at && t < at + 3 && p !== wanted && p !== underClip) releaseMedia(p.el);
    }
  }
  keepAlive();
  for (const c of Object.values(clips)) {
    if (c === wanted) syncClip(c, film.t);
    else if (c === underClip) syncClip(c, under.t);
    else if (!c.el.paused) c.el.pause();
  }
  // While a video seeks it has no frame: keep the last painted one instead of flashing to black
  const frameReady = wanted && wanted.el.readyState >= 2 && !wanted.el.seeking;
  const underReady = underClip && underClip.el.readyState >= 2 && !underClip.el.seeking;
  // No film on the canvas (the DOM chapters): the page colour and maybe a line standing still. Drawn again every
  // frame, the same picture made the browser send and composite a full-screen texture for nothing.
  const plain = !(frameReady && film.alpha > 0.001) && !underReady
    ? `${canvas.width}×${canvas.height} ${geo.k} ${geo.ox} ${geo.oy} ${lines.map(([el, p, a]) => `${el.id}:${lineShape(el).key}:${p.toFixed(4)}:${a.toFixed(3)}`).join(' ')}`
    : null;
  if ((!wanted || frameReady) && !(plain && plain === canvasPlain)) {
    canvasPlain = plain;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0c1016';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (frameReady && film.alpha > 0.001) {
      const [x, y, w, h] = film.rect || [0, 0, SW, SH];
      const px = [(geo.ox + x * geo.k) * dpr, (geo.oy + y * geo.k) * dpr, w * geo.k * dpr, h * geo.k * dpr];
      ctx.globalAlpha = film.alpha;
      ctx.drawImage(wanted.el, ...px);
      ctx.globalAlpha = 1;
      if (film.feather > 0.5) featherRect(px, film.feather * geo.k * dpr);
    }
    strokeLines();
    if (underReady) {
      // both films are light lines on the page colour: «lighten» keeps the background exact
      ctx.globalCompositeOperation = 'lighten';
      ctx.globalAlpha = under.alpha;
      ctx.drawImage(underClip.el, geo.ox * dpr, geo.oy * dpr, SW * geo.k * dpr, SH * geo.k * dpr);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    dissolveEdges();
  }

  // chrome
  const share = t / DURATION;
  // the bar moves in whole device pixels: a new width every frame re-laid out and repainted the controls
  const bar = `${Math.round(share * trackW * dpr) / dpr}px`;
  if ($('fill').style.width !== bar) { $('fill').style.width = bar; $('knob').style.left = bar; }
  setText($('time'), `${fmt(t)} / ${fmt(DURATION)}`);
  setAttr(scrub, 'aria-valuenow', t.toFixed(1));
  setAttr(scrub, 'aria-valuetext', `${fmt(t)} из ${fmt(DURATION)}`);
  const ch = [...CHAPTERS].reverse().find((c) => t >= c.t - 0.01) || CHAPTERS[0];
  setText($('chapterNow'), `${ch.id} · ${ch.title}`);
  for (const el of $('ticks').children) el.classList.toggle('past', t >= Number(el.dataset.t));
}
function showCapOff(el) { if (el.style.visibility !== 'hidden') { el.style.opacity = '0'; el.style.visibility = 'hidden'; } }
function showPlainOff(el) { showCapOff(el); }

// ---------------------------------------------------------------- loading
const scrub = $('scrub');
function buildTicks() {
  const box = $('ticks');
  box.innerHTML = '';
  // Titles only where every label has room; otherwise the numbers (the title is in the top bar)
  const track = Math.max(1, scrub.clientWidth || W * 0.7);
  let gap = Infinity;
  for (let i = 1; i < CHAPTERS.length; i++) gap = Math.min(gap, ((CHAPTERS[i].t - CHAPTERS[i - 1].t) / DURATION) * track);
  const compact = gap < 128;
  const bare = gap < 24; // too tight even for numbers: marks only, the top bar names the chapter
  for (const c of CHAPTERS) {
    const s = document.createElement('span');
    s.textContent = bare ? '' : compact ? c.id : `${c.id} ${c.title}`;
    s.title = `${c.id} · ${c.title}`;
    s.style.left = `${(c.t / DURATION) * 100}%`;
    s.dataset.t = String(c.t);
    box.append(s);
  }
}
function buffered() {
  let have = 0;
  let total = 0;
  for (const c of Object.values(clips)) {
    total += c.dur;
    const b = c.el.buffered;
    for (let i = 0; i < b.length; i++) have += b.end(i) - b.start(i);
  }
  return total ? clamp(have / total, 0, 1) : 0;
}
function onProgress() {
  const share = buffered();
  setText($('loadpct'), `${Math.round(share * 100)}%`);
  document.querySelector('.loader-line i').style.width = `${share * 100}%`;
  $('buffer').style.width = `${share * 100}%`;
}
for (const c of Object.values(clips)) {
  c.el.addEventListener('progress', onProgress);
  c.el.addEventListener('loadeddata', () => { onProgress(); draw(); });
}
// ---------------------------------------------------------------- input
const chapterIndex = () => CHAPTERS.reduce((k, c, i) => (t >= c.t - 0.05 ? i : k), 0);
function toChapter(step) {
  const cur = chapterIndex();
  const target = step < 0 && t - CHAPTERS[cur].t > 1.5 ? CHAPTERS[cur].t : CHAPTERS[clamp(cur + step, 0, CHAPTERS.length - 1)].t;
  seek(target + 0.01, playing);
}
function exit() {
  const back = document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1;
  if (back) history.back(); else location.assign(new URL('./', location.href).href);
}
const toggle = () => { if (playing) pause(); else play(); };
$('play').addEventListener('click', toggle);
$('prev').addEventListener('click', () => toChapter(-1));
$('next').addEventListener('click', () => toChapter(1));
for (const b of document.querySelectorAll('[data-action="replay"]')) b.addEventListener('click', () => { seek(0); play(); });
for (const a of document.querySelectorAll('[data-exit]')) a.addEventListener('click', (ev) => { ev.preventDefault(); exit(); });

function seekFromPointer(ev) {
  const r = scrub.getBoundingClientRect();
  seek(((ev.clientX - r.left) / r.width) * DURATION);
}
scrub.addEventListener('pointerdown', (ev) => { scrub.setPointerCapture(ev.pointerId); seekFromPointer(ev); });
scrub.addEventListener('pointermove', (ev) => { if (scrub.hasPointerCapture(ev.pointerId)) seekFromPointer(ev); });
scrub.addEventListener('keydown', (ev) => {
  const stepKeys = { ArrowLeft: -2, ArrowRight: 2, PageDown: 5, PageUp: -5 };
  if (ev.key in stepKeys) { ev.preventDefault(); ev.stopPropagation(); seek(t + stepKeys[ev.key]); }
  if (ev.key === 'Home') { ev.preventDefault(); seek(0); }
  if (ev.key === 'End') { ev.preventDefault(); seek(DURATION); }
});
// Wheel and swipe move a target time and the story glides to it (~0.1 s), instead of jumping:
// a mouse-wheel notch used to skip 1.2 s (~30 film frames) in one step
function glideStep(now) {
  const ms = glideLast ? Math.min(50, now - glideLast) : 16;
  glideLast = now;
  t += (glideTo - t) * (1 - Math.exp(-ms / 70));
  const done = Math.abs(glideTo - t) < 0.003;
  if (done) t = glideTo;
  render();
  if (done) { glideTo = null; glideRaf = 0; glideLast = 0; } else glideRaf = requestAnimationFrame(glideStep);
}
function glideBy(dt) {
  if (playing) pause();
  glideTo = clamp((glideTo ?? t) + dt, 0, DURATION);
  if (!glideRaf) glideRaf = requestAnimationFrame(glideStep);
}
stage.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const px = ev.deltaY * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? innerHeight : 1);
  glideBy(clamp(px, -240, 240) * 0.004); // a notch (100 px) = 0.4 s
}, { passive: false });
let touchY = null;
stage.addEventListener('touchstart', (ev) => { if (!ev.target.closest('a, button')) touchY = ev.touches[0].clientY; }, { passive: true });
stage.addEventListener('touchmove', (ev) => {
  if (touchY === null) return;
  const y = ev.touches[0].clientY;
  glideBy((touchY - y) * 0.02);
  touchY = y;
}, { passive: true });
stage.addEventListener('touchend', () => { touchY = null; });
stage.addEventListener('click', (ev) => { if (!ev.target.closest('a, button')) toggle(); });
addEventListener('keydown', (ev) => {
  const onButton = ev.target instanceof Element && ev.target.closest('button, a');
  if ((ev.key === ' ' && !onButton) || ev.key === 'k') { ev.preventDefault(); toggle(); }
  else if (ev.key === 'ArrowLeft' && !ev.target.closest?.('[role="slider"]')) { ev.preventDefault(); toChapter(-1); }
  else if (ev.key === 'ArrowRight' && !ev.target.closest?.('[role="slider"]')) { ev.preventDefault(); toChapter(1); }
  else if (ev.key === 'Escape') exit();
  wake();
});

let idleTimer = 0;
function wake() { document.body.classList.remove('idle'); armIdle(); }
function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (playing && !document.querySelector('.controls:hover, .controls :focus-visible, .cap-final:hover')) document.body.classList.add('idle');
  }, 2600);
}
addEventListener('pointermove', wake);
setTimeout(() => $('hint').classList.add('gone'), 7000);
let resumeOnShow = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden && playing) { resumeOnShow = true; pause(); } else if (!document.hidden && resumeOnShow) { resumeOnShow = false; play(); }
});

// ---------------------------------------------------------------- start
scrub.setAttribute('aria-valuemax', DURATION.toFixed(1));
addEventListener('resize', resize);
resize();
// Test hooks: ?t=42 opens paused at 42 s; add &play=1 to play from there
if (params.has('t')) { t = clamp(Number(params.get('t')), 0, DURATION); autoplay = params.has('play'); setTimeout(() => start(), 0); }
if (reduced && !params.has('t')) t = DURATION;
// The story starts after a warm-up under the loader, so none of this lands on the story itself:
// - 03's sites are rasterized: prewarm03 draws them from the first frame, but only a loaded page has
//   something to draw; that raster costs 100–200 ms when the GPU is busy;
// - every film's decoder is set up (and then kept: see keepAlive);
// - the browser's one-time media start-up: the first play() (150–200 ms in a fresh browser, the GPU
//   process querying hardware video profiles), then back to frame 0 and ready again — a seek in flight
//   would read as buffering and bring the loader back.
// start() is called from several places (canplay, ?t, the 8 s fallback); only the first call counts.
let starting = false;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const nextFrame = () => Promise.race([new Promise((done) => requestAnimationFrame(done)), wait(200)]);
async function waitFor(ok, ms) {
  const end = performance.now() + ms;
  while (!ok() && performance.now() < end) await wait(30);
}
// n frames in a row shorter than 25 ms, or the time runs out: a GPU process still busy with start-up
// work (raster, decoders, shaders) shows up as longer frames, and the loader stays until it is over
async function calmFrames(n, ms) {
  const end = performance.now() + ms;
  let calm = 0;
  let last = performance.now();
  while (calm < n && performance.now() < end) {
    await nextFrame();
    const now = performance.now();
    calm = now - last < 25 ? calm + 1 : 0;
    last = now;
  }
}
async function start() {
  if (starting) return;
  starting = true;
  await waitFor(() => Object.values(scenes).every((sc) => sc.layers), 4000);
  const players = MOBILE ? [clips.prologue, clips.logos] : [...Object.values(clips), reel];
  players.forEach(ensureSrc);
  const pro = clips.prologue.el;
  try {
    await Promise.race([pro.play(), wait(2000)]);
    pro.pause();
    pro.currentTime = 0;
  } catch {
    // autoplay refused: the story's own play() asks again
  }
  // a slow network: the rest streams while the story plays
  await waitFor(() => pro.readyState >= 3 && !pro.seeking && players.every((c) => c.el.readyState >= 2), quality === 1440 ? 3000 : 1500);
  // a frame of its own: the full-canvas fill of the next draw() would let the browser drop the strokes unsent
  prewarmStrokes();
  await nextFrame();
  draw();
  await calmFrames(3, 700);
  ready = true;
  // playback starts under the loader: its first frames (the decoder starting to output) are the heaviest.
  // The prologue's first 0.12 s are the empty page, so up to that much may play unseen.
  if (autoplay) {
    play();
    await calmFrames(2, 120);
  }
  revealed = true;
  $('loader').classList.add('done');
  if (!autoplay) draw();
}
const first = clips.prologue.el;
if (first.readyState >= 3) start();
else first.addEventListener('canplay', start, { once: true });
setTimeout(start, 8000); // never keep the visitor waiting forever
