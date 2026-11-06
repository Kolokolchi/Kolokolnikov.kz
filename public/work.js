import { media } from './work-media.js';
import {
  machines, blisterHistory, engineeringGallery, cgiFilters, cgiItems, motionReel, reels,
  youtubeChannel, youtubeGroups, youtubeNoEmbed, youtubeSdThumbs, brands, decks, timeline, marquee,
} from './work-data.js';

// Home-page galleries for engineering, 3D, motion, brands and decks.
// Everything here is progressive: the page stays readable if a viewer or a video fails.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}
function svg(path) {
  const ns = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(ns, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  const shape = document.createElementNS(ns, 'path');
  shape.setAttribute('d', path);
  icon.append(shape);
  return icon;
}
const PLAY = 'm9 6 9 6-9 6Z';

// Full-bleed section backgrounds use the page width without the scrollbar (100vw includes it
// and would push the page sideways by the scrollbar width).
function syncPageWidth() { document.documentElement.style.setProperty('--page-width', `${document.documentElement.clientWidth}px`); }
syncPageWidth();
window.addEventListener('resize', syncPageWidth, { passive: true });

function asset(id) {
  const item = media[id];
  if (!item) console.warn('Missing media', id);
  return item || {};
}
function picture(id, { alt = '', sizes = '(max-width: 760px) 100vw, 50vw', eager = false, className = '' } = {}) {
  const item = asset(id);
  const img = el('img', className);
  const src = item.src || item.poster || item.pages?.[0]?.src;
  const sm = item.sm || item.pages?.[0]?.sm;
  img.src = sm || src;
  if (sm && src && sm !== src) {
    img.srcset = `${sm} 760w, ${src} ${item.w || item.pages?.[0]?.w || 1600}w`;
    img.sizes = sizes;
  }
  img.width = item.w || item.pages?.[0]?.w || 1600;
  img.height = item.h || item.pages?.[0]?.h || 900;
  img.alt = alt;
  img.decoding = 'async';
  if (!eager) img.loading = 'lazy';
  return img;
}

// Silent loops play only while visible; reduced motion keeps their posters.
const loopObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const video = entry.target;
    if (entry.isIntersecting && !reducedMotion.matches && !document.hidden) {
      if (!video.src && video.dataset.src) video.src = video.dataset.src;
      video.play().catch(() => {});
    } else video.pause();
  }
}, { threshold: 0.35 });
function loopVideo(id, { src, poster, label = '' } = {}) {
  const item = asset(id);
  const video = el('video', 'loop-video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  video.poster = poster || item.poster;
  video.dataset.src = src || item.video;
  video.setAttribute('aria-label', label);
  video.setAttribute('muted', '');
  loopObserver.observe(video);
  return video;
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) $$('video.loop-video').forEach(video => video.pause());
});

/* ---------- Lightbox ---------- */
const lightbox = $('[data-lightbox]');
let lightboxItems = [], lightboxIndex = 0, lightboxReturn = null;
function renderLightbox() {
  const item = lightboxItems[lightboxIndex];
  const holder = $('[data-lightbox-media]', lightbox);
  holder.replaceChildren();
  if (item.youtube) {
    const frame = el('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${item.youtube}?autoplay=1&rel=0&modestbranding=1`;
    frame.title = item.title;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    holder.append(frame);
    holder.className = 'lightbox-media is-embed';
  } else if (item.video) {
    const video = el('video');
    Object.assign(video, { src: item.video, poster: item.poster || '', controls: true, autoplay: !reducedMotion.matches, loop: true, muted: true, playsInline: true });
    video.setAttribute('aria-label', item.title);
    holder.append(video);
    holder.className = 'lightbox-media';
  } else {
    const img = el('img');
    Object.assign(img, { src: item.src, alt: item.title, decoding: 'async' });
    if (item.w) { img.width = item.w; img.height = item.h; }
    holder.append(img);
    holder.className = 'lightbox-media';
  }
  const watch = $('[data-lightbox-watch]', lightbox);
  if (watch) {
    watch.hidden = !item.youtube;
    if (item.youtube) watch.href = `https://www.youtube.com/watch?v=${item.youtube}`;
  }
  $('[data-lightbox-title]', lightbox).textContent = item.title || '';
  $('[data-lightbox-note]', lightbox).textContent = item.note || '';
  $('[data-lightbox-count]', lightbox).textContent = lightboxItems.length > 1 ? `${lightboxIndex + 1} / ${lightboxItems.length}` : '';
  $$('[data-lightbox-prev], [data-lightbox-next]', lightbox).forEach(button => { button.hidden = lightboxItems.length < 2; });
  // Preload the neighbours for a quick step.
  for (const offset of [1, -1]) {
    const next = lightboxItems[(lightboxIndex + offset + lightboxItems.length) % lightboxItems.length];
    if (next?.src) { const preload = new Image(); preload.src = next.src; }
  }
}
function openLightbox(items, index, origin) {
  if (!lightbox?.showModal) {
    const item = items[index];
    window.open(item.youtube ? `https://www.youtube.com/watch?v=${item.youtube}` : item.src || item.video, '_blank', 'noopener');
    return;
  }
  lightboxItems = items;
  lightboxIndex = index;
  lightboxReturn = origin || document.activeElement;
  renderLightbox();
  lightbox.showModal();
  document.documentElement.classList.add('lightbox-open');
}
function stepLightbox(delta) {
  lightboxIndex = (lightboxIndex + delta + lightboxItems.length) % lightboxItems.length;
  renderLightbox();
}
if (lightbox) {
  $('[data-lightbox-prev]', lightbox).addEventListener('click', () => stepLightbox(-1));
  $('[data-lightbox-next]', lightbox).addEventListener('click', () => stepLightbox(1));
  $('[data-lightbox-close]', lightbox).addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
  lightbox.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') stepLightbox(1);
    if (event.key === 'ArrowLeft') stepLightbox(-1);
  });
  let touchX = null;
  lightbox.addEventListener('touchstart', event => { touchX = event.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', event => {
    if (touchX === null) return;
    const dx = event.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50 && lightboxItems.length > 1) stepLightbox(dx < 0 ? 1 : -1);
    touchX = null;
  });
  lightbox.addEventListener('close', () => {
    $('[data-lightbox-media]', lightbox).replaceChildren();
    document.documentElement.classList.remove('lightbox-open');
    lightboxReturn?.focus?.({ preventScroll: true });
  });
}
function lightboxEntry(item) {
  const data = asset(item.id);
  if (data.video) return { video: data.video, poster: data.poster, title: item.title, note: item.note };
  return { src: data.src, w: data.w, h: data.h, title: item.title, note: item.note };
}

/* ---------- Marquee and stats ---------- */
function renderMarquee() {
  const rows = $$('[data-marquee-row]');
  if (!rows.length) return;
  const half = Math.ceil(marquee.length / 2);
  rows.forEach((row, index) => {
    const items = index ? marquee.slice(half) : marquee.slice(0, half);
    const track = el('div', 'reel-track');
    for (const pass of [0, 1]) {
      for (const [id, label, href] of items) {
        const link = el('a', 'reel-tile');
        link.href = href;
        if (pass) { link.setAttribute('aria-hidden', 'true'); link.tabIndex = -1; }
        link.append(picture(id, { sizes: '340px' }), el('span', '', label));
        track.append(link);
      }
    }
    row.append(track);
  });
}
function renderStats() {
  const holder = $('[data-stats]');
  if (!holder) return;
  const ytCount = new Set(youtubeGroups.flatMap(group => group.items.map(item => item[0]))).size;
  // Labels agree with their numbers (1 модель, 3 модели, 5 моделей).
  const stats = [
    [machines.length, ['WebGL-модель оборудования', 'WebGL-модели оборудования', 'WebGL-моделей оборудования']],
    [cgiItems.length, ['работа в 3D и CGI', 'работы в 3D и CGI', 'работ в 3D и CGI']],
    [motionReel.length + reels.length, ['моушн-ролик на странице', 'моушн-ролика на странице', 'моушн-роликов на странице']],
    [brands.length, ['брендовая работа', 'брендовые работы', 'брендовых работ']],
    [decks.length, ['презентация', 'презентации', 'презентаций']],
    [ytCount, ['фильм в подборке YouTube', 'фильма в подборке YouTube', 'фильмов в подборке YouTube']],
  ].map(([value, forms]) => [value, plural(value, forms)]);
  for (const [value, label] of stats) {
    const item = el('div', 'stat');
    const number = el('dd', 'stat-value', '0');
    number.dataset.count = String(value);
    item.append(number, el('dt', '', label));
    holder.append(item);
  }
  const observer = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();
    for (const number of $$('[data-count]', holder)) {
      const target = Number(number.dataset.count);
      if (reducedMotion.matches) { number.textContent = String(target); continue; }
      const start = performance.now();
      const tick = now => {
        const t = Math.min(1, (now - start) / 1100);
        number.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.4 });
  observer.observe(holder);
}

/* ---------- Engineering lab ---------- */
function renderLab() {
  const lab = $('[data-lab]');
  if (!lab) return;
  const tabs = $('[data-lab-tabs]', lab);
  machines.forEach((machine, index) => {
    const button = el('button', 'lab-tab');
    button.type = 'button';
    button.dataset.labModel = machine.id;
    button.setAttribute('aria-pressed', String(index === 0));
    const thumb = picture(machine.poster, { sizes: '120px' });
    button.append(thumb, el('span', '', machine.label));
    tabs.append(button);
  });
  const poster = $('[data-lab-poster]', lab);
  function describe(machine) {
    $('[data-lab-panel-kicker]', lab).textContent = machine.kicker;
    $('[data-lab-kicker]', lab).textContent = machine.label;
    $('[data-lab-title]', lab).textContent = machine.label;
    $('[data-lab-summary]', lab).textContent = machine.summary;
    const facts = $('[data-lab-facts]', lab);
    facts.replaceChildren(...machine.facts.map(([value, label]) => {
      const row = el('div', 'lab-fact');
      row.append(el('dt', '', label), el('dd', '', value));
      return row;
    }));
    $('[data-lab-status]', lab).textContent = machine.status;
    const item = asset(machine.poster);
    if (item.src && !lab.querySelector('.lab-stage.lab-ready')) { poster.src = item.src; poster.alt = `${machine.label}: рендер`; }
    lab.querySelectorAll('[data-lab-model]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.labModel === machine.id)));
  }
  describe(machines[0]);
  // Without WebGL the tabs still switch the rendered poster and the description.
  lab.addEventListener('click', event => {
    const button = event.target.closest('[data-lab-model]');
    if (!button) return;
    const machine = machines.find(item => item.id === button.dataset.labModel);
    if (machine) describe(machine);
  });
  let started = false;
  const observer = new IntersectionObserver(async entries => {
    if (!entries[0].isIntersecting || started) return;
    started = true;
    observer.disconnect();
    try {
      const { createMachineViewer } = await import('./machine-viewer.js');
      const viewer = createMachineViewer(lab, { models: machines, dracoPath: 'assets/draco/', onModel: describe });
      if (!viewer) lab.classList.add('lab-static');
    } catch (error) {
      console.warn('Engineering viewer unavailable', error);
      lab.classList.add('lab-static');
    }
  }, { rootMargin: '600px 0px' });
  observer.observe(lab);
}
function renderBlisterHistory() {
  const list = $('[data-blister-history]');
  if (!list) return;
  const maxMass = Math.max(...blisterHistory.map(item => item.mass));
  blisterHistory.forEach((item, index) => {
    const row = el('li', 'eng-bar');
    row.style.setProperty('--size', String(item.mass / maxMass));
    row.style.setProperty('--delay', `${index * 120}ms`);
    const bar = el('span', 'eng-bar-fill');
    const meta = el('span', 'eng-bar-meta');
    meta.append(el('strong', '', `${item.mass} кг`), el('span', '', `${item.label} · ${item.width} мм`));
    row.append(meta, bar);
    list.append(row);
  });
  new IntersectionObserver((entries, observer) => {
    if (!entries[0].isIntersecting) return;
    list.classList.add('is-visible');
    observer.disconnect();
  }, { threshold: 0.3 }).observe(list);
}
function renderStrip(holder, items) {
  const track = el('div', 'strip-track');
  const entries = items.map(lightboxEntry);
  items.forEach((item, index) => {
    const data = asset(item.id);
    const card = el('button', 'strip-card');
    card.type = 'button';
    card.setAttribute('aria-label', `Открыть: ${item.title}`);
    const frame = el('span', 'strip-media');
    frame.style.setProperty('--ratio', `${data.w || 16} / ${data.h || 9}`);
    if (data.video) frame.append(loopVideo(item.id, { label: item.title }), el('span', 'media-flag', 'Видео'));
    else frame.append(picture(item.id, { sizes: '(max-width: 760px) 80vw, 520px' }));
    const caption = el('span', 'strip-caption');
    caption.append(el('strong', '', item.title), el('span', '', item.note));
    card.append(frame, caption);
    card.addEventListener('click', () => openLightbox(entries, index, card));
    track.append(card);
  });
  const controls = el('div', 'strip-controls');
  for (const [label, dir, path] of [['Назад', -1, 'M15 6l-6 6 6 6'], ['Вперёд', 1, 'M9 6l6 6-6 6']]) {
    const button = el('button', 'strip-arrow');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.append(svg(path));
    button.addEventListener('click', () => track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: reducedMotion.matches ? 'auto' : 'smooth' }));
    controls.append(button);
  }
  holder.append(track, controls);
}

/* ---------- 3D / CGI ---------- */
function bentoCard(item, entries, index) {
  const data = asset(item.id);
  const card = el('button', `bento-card bento-${item.size || 'wide'}${item.dark ? ' bento-dark' : ''}`);
  card.type = 'button';
  card.dataset.cat = item.cat || '';
  card.setAttribute('aria-label', `Открыть: ${item.title}`);
  const frame = el('span', 'bento-media');
  if (data.video) frame.append(loopVideo(item.id, { label: item.title }), el('span', 'media-flag', 'Видео'));
  else frame.append(picture(item.id, { sizes: item.size === 'wide' ? '(max-width: 760px) 100vw, 50vw' : '(max-width: 760px) 50vw, 25vw' }));
  const caption = el('span', 'bento-caption');
  caption.append(el('strong', '', item.title), el('span', '', item.note));
  card.append(frame, caption);
  card.addEventListener('click', () => openLightbox(entries(), index(), card));
  return card;
}
function renderCgi() {
  const grid = $('[data-bento="cgi"]');
  const filters = $('[data-cgi-filters]');
  if (!grid) return;
  let current = 'all';
  const visible = () => cgiItems.filter(item => current === 'all' || item.cat === current);
  function draw() {
    const items = visible();
    grid.replaceChildren(...items.map((item, i) => bentoCard(item, () => items.map(lightboxEntry), () => i)));
    $('[data-cgi-count]').textContent = `${items.length} ${plural(items.length, ['работа', 'работы', 'работ'])}`;
  }
  for (const [id, label] of cgiFilters) {
    const button = el('button', `filter${id === current ? ' active' : ''}`, label);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(id === current));
    button.addEventListener('click', () => {
      current = id;
      $$('.filter', filters).forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
      draw();
    });
    filters.append(button);
  }
  draw();
}
function plural(n, forms) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}
function renderPano() {
  const pano = $('[data-pano]');
  if (!pano) return;
  const thumbs = $('[data-pano-thumbs]');
  const stills = [
    { id: 'arch-saf-lobby-1', title: 'Лобби — зона ожидания', note: 'Unreal Engine 5.8, path tracing' },
    { id: 'arch-saf-lobby-2', title: 'Лобби — галерея', note: 'Unreal Engine 5.8, path tracing' },
    { id: 'arch-saf-lobby-3', title: 'Коридор', note: 'Unreal Engine 5.8, path tracing' },
    { id: 'arch-saf-lobby-4', title: 'Лифтовой холл', note: 'Unreal Engine 5.8, path tracing' },
  ];
  const entries = stills.map(lightboxEntry);
  stills.forEach((item, index) => {
    const button = el('button', 'pano-thumb');
    button.type = 'button';
    button.setAttribute('aria-label', `Открыть кадр: ${item.title}`);
    button.append(picture(item.id, { sizes: '160px' }));
    button.addEventListener('click', () => openLightbox(entries, index, button));
    thumbs?.append(button);
  });
  let started = false;
  new IntersectionObserver(async (records, observer) => {
    if (!records[0].isIntersecting || started) return;
    started = true;
    observer.disconnect();
    try {
      const { createPanoViewer } = await import('./pano-viewer.js');
      createPanoViewer(pano, { src: pano.dataset.src });
    } catch (error) {
      console.warn('Panorama unavailable', error);
    }
  }, { rootMargin: '500px 0px' }).observe(pano);
}

/* ---------- Motion ---------- */
function renderMotion() {
  const video = $('#motion-preview');
  const rail = $('[data-motion-rail]');
  if (!video || !rail) return;
  const progress = $('[data-motion-progress]');
  const items = motionReel.map(item => {
    const data = item.src ? {} : asset(item.id);
    return { ...item, src: item.src || data.video, poster: item.poster || data.poster, duration: data.duration };
  });
  let current = 0;
  function select(index, { play = true } = {}) {
    current = (index + items.length) % items.length;
    const item = items[current];
    const wasPlaying = !video.paused;
    video.poster = item.poster;
    video.src = item.src;
    video.setAttribute('aria-label', `Беззвучное превью: ${item.title}`);
    video.closest('.motion-stage').classList.toggle('motion-wide', Boolean(item.wide));
    $('[data-motion-kicker]').textContent = item.kicker;
    $('[data-motion-title]').textContent = item.title;
    $('[data-motion-note]').textContent = item.note;
    $$('.motion-chip', rail).forEach((chip, chipIndex) => {
      chip.setAttribute('aria-current', String(chipIndex === current));
      if (chipIndex === current && rail.scrollWidth > rail.clientWidth) {
        rail.scrollTo({ left: chip.offsetLeft - rail.clientWidth / 2 + chip.clientWidth / 2, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      }
    });
    if (play && (wasPlaying || !reducedMotion.matches)) video.play().catch(() => {});
  }
  items.forEach((item, index) => {
    const chip = el('button', 'motion-chip');
    chip.type = 'button';
    chip.setAttribute('role', 'listitem');
    const img = el('img');
    Object.assign(img, { src: item.poster, alt: '', loading: 'lazy', decoding: 'async', width: 320, height: 180 });
    chip.append(img, el('span', '', item.title));
    chip.addEventListener('click', () => { select(index); video.play().catch(() => {}); });
    rail.append(chip);
  });
  video.addEventListener('ended', () => select(current + 1));
  video.addEventListener('timeupdate', () => {
    if (progress && video.duration) progress.style.transform = `scaleX(${video.currentTime / video.duration})`;
  });
  $('[data-motion-prev]')?.addEventListener('click', () => select(current - 1));
  $('[data-motion-next]')?.addEventListener('click', () => select(current + 1));
  select(0, { play: false });
}
function renderReels() {
  const holder = $('[data-reels]');
  if (!holder) return;
  const entries = reels.map(lightboxEntry);
  reels.forEach((item, index) => {
    const card = el('button', 'reel-card');
    card.type = 'button';
    card.setAttribute('aria-label', `Открыть: ${item.title}`);
    const phone = el('span', 'reel-phone');
    phone.append(loopVideo(item.id, { label: item.title }));
    const caption = el('span', 'reel-caption');
    caption.append(el('strong', '', item.title), el('span', '', item.note));
    card.append(phone, caption);
    card.addEventListener('click', () => openLightbox(entries, index, card));
    holder.append(card);
  });
}
function renderYoutube() {
  const tabs = $('[data-yt-tabs]');
  const grid = $('[data-yt-grid]');
  if (!tabs || !grid) return;
  $('[data-yt-stats]').textContent = `${youtubeChannel.subscribers} подписчиков · ${youtubeChannel.videos} видео`;
  let current = youtubeGroups[0].id;
  function draw() {
    const group = youtubeGroups.find(item => item.id === current);
    const embeddable = group.items.filter(([id]) => !youtubeNoEmbed.includes(id));
    const entries = embeddable.map(([youtube, title, duration, year]) => ({ youtube, title, note: `${duration} · ${year}` }));
    grid.replaceChildren(...group.items.map(([id, title, duration, year]) => {
      const external = youtubeNoEmbed.includes(id);
      const card = el(external ? 'a' : 'button', 'yt-card');
      if (external) {
        card.href = `https://www.youtube.com/watch?v=${id}`;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.setAttribute('aria-label', `Смотреть на YouTube: ${title}`);
      } else {
        card.type = 'button';
        card.setAttribute('aria-label', `Смотреть: ${title}`);
      }
      const cover = el('span', 'yt-cover');
      const img = el('img');
      Object.assign(img, { src: `https://i.ytimg.com/vi/${id}/${youtubeSdThumbs.includes(id) ? 'hqdefault' : 'hq720'}.jpg`, alt: '', loading: 'lazy', decoding: 'async', width: 1280, height: 720, referrerPolicy: 'no-referrer' });
      img.addEventListener('error', () => { if (!img.dataset.fallback) { img.dataset.fallback = '1'; img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; } }, { once: false });
      const play = el('span', 'yt-play');
      play.append(svg(PLAY));
      cover.append(img, play, el('span', 'yt-duration', duration));
      const info = el('span', 'yt-info');
      info.append(el('strong', '', title), el('span', '', external ? `${year} · на YouTube ↗` : year));
      card.append(cover, info);
      if (!external) {
        const index = embeddable.findIndex(([item]) => item === id);
        card.addEventListener('click', () => openLightbox(entries, index, card));
      }
      return card;
    }));
  }
  for (const group of youtubeGroups) {
    const button = el('button', `filter${group.id === current ? ' active' : ''}`);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(group.id === current));
    button.append(document.createTextNode(group.title), el('span', '', String(group.items.length)));
    button.addEventListener('click', () => {
      current = group.id;
      $$('.filter', tabs).forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
      draw();
    });
    tabs.append(button);
  }
  draw();
}

/* ---------- Brands, decks, timeline ---------- */
function renderBrands() {
  const grid = $('[data-bento="brands"]');
  if (!grid) return;
  const entries = brands.map(lightboxEntry);
  grid.replaceChildren(...brands.map((item, index) => bentoCard(item, () => entries, () => index)));
}
function renderDecks() {
  const shelf = $('[data-decks]');
  if (!shelf) return;
  const track = el('div', 'deck-track');
  decks.forEach(deck => {
    const pages = asset(deck.id).pages || [];
    if (!pages.length) return;
    const card = el('button', 'deck-card');
    card.type = 'button';
    card.setAttribute('aria-label', `Открыть презентацию: ${deck.title}`);
    const stack = el('span', 'deck-stack');
    const cover = el('span', 'deck-cover');
    const first = pages[0];
    stack.style.setProperty('--ratio', `${first.w} / ${first.h}`);
    // Following pages sit behind the cover and fan out as the deck is dealt.
    pages.slice(1, 3).forEach((page, i) => {
      const sheet = el('span', 'deck-sheet');
      sheet.style.setProperty('--sheet', String(i + 1));
      sheet.style.backgroundImage = `url("${page.sm}")`;
      stack.append(sheet);
    });
    const img = el('img');
    Object.assign(img, { src: first.sm, alt: '', loading: 'lazy', decoding: 'async', width: first.w, height: first.h });
    cover.append(img);
    if (pages.length > 1) cover.append(el('span', 'deck-pages', `${pages.length} стр.`));
    stack.append(cover);
    const caption = el('span', 'deck-caption');
    caption.append(el('strong', '', deck.title), el('span', '', deck.note));
    card.append(stack, caption);
    const entries = pages.map((page, i) => ({ src: page.src, w: page.w, h: page.h, title: deck.title, note: i ? `${deck.note} · страница ${i + 1}` : deck.note }));
    card.addEventListener('click', () => openLightbox(entries, 0, card));
    track.append(card);
  });
  shelf.append(track);
  dealDecks(shelf, track);
  // Drag-to-scroll for mouse users; touch and trackpads scroll natively.
  let down = null, moved = false;
  track.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse') return;
    down = { x: event.clientX, left: track.scrollLeft };
    moved = false;
  });
  window.addEventListener('pointermove', event => {
    if (!down) return;
    const dx = event.clientX - down.x;
    if (Math.abs(dx) > 6) { moved = true; track.classList.add('is-dragging'); }
    track.scrollLeft = down.left - dx;
  });
  window.addEventListener('pointerup', () => { down = null; setTimeout(() => track.classList.remove('is-dragging'), 0); });
  track.addEventListener('click', event => { if (moved) { event.preventDefault(); event.stopPropagation(); moved = false; } }, true);
}
// Scroll-linked "deal": the covers start as one pile at the first slot and spread into the
// row while the shelf scrolls through the viewport (same window as the site assemblies:
// start once the shelf is fully visible, finish over the next 40% of the viewport).
function dealDecks(shelf, track) {
  const cards = [...track.children];
  if (!cards.length) return;
  function measure() {
    const firstLeft = cards[0].offsetLeft;
    cards.forEach((card, index) => {
      const distance = card.offsetLeft - firstLeft;
      card.style.setProperty('--dx', `${-Math.min(distance, track.clientWidth * 1.1)}px`);
      card.style.setProperty('--rot', `${((index * 37) % 13) - 6}deg`);
    });
  }
  function update() {
    const rect = track.getBoundingClientRect();
    const viewport = innerHeight;
    let progress = 1;
    if (!reducedMotion.matches) {
      const center = rect.top + rect.height / 2;
      const startAt = Math.max(viewport * .35, Math.min(viewport * .7, viewport - rect.height / 2 - 32));
      const endAt = startAt - viewport * .4;
      progress = Math.max(0, Math.min(1, (startAt - center) / (startAt - endAt)));
    }
    cards.forEach((card, index) => {
      const delay = Math.min(index, 9) * .045;
      const local = Math.max(0, Math.min(1, (progress - delay) / (1 - 9 * .045)));
      card.style.setProperty('--deal', (1 - Math.pow(1 - local, 3)).toFixed(3));
    });
    shelf.classList.toggle('decks-dealt', progress >= 1);
  }
  measure();
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', () => { measure(); update(); });
  reducedMotion.addEventListener('change', update);
}
function renderTimeline() {
  const list = $('[data-timeline]');
  if (!list) return;
  for (const [year, title, text] of timeline) {
    const item = el('li');
    item.append(el('span', 'timeline-year', year), el('strong', '', title), el('p', '', text));
    list.append(item);
  }
}

/* ---------- Tilt for cards (fine pointers only) ---------- */
function enableTilt() {
  if (!finePointer.matches || reducedMotion.matches) return;
  document.addEventListener('pointermove', event => {
    const card = event.target.closest?.('.deck-card, .reel-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty('--tilt-x', `${(-y * 6).toFixed(2)}deg`);
    card.style.setProperty('--tilt-y', `${(x * 8).toFixed(2)}deg`);
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    const card = event.target.closest?.('.deck-card, .reel-card');
    if (card && !card.contains(event.relatedTarget)) { card.style.removeProperty('--tilt-x'); card.style.removeProperty('--tilt-y'); }
  });
}

for (const step of [renderMarquee, renderStats, renderLab, renderBlisterHistory, renderCgi, renderPano, renderMotion, renderReels, renderYoutube, renderBrands, renderDecks, renderTimeline, enableTilt]) {
  try { step(); } catch (error) { console.error(step.name, error); }
}
// The hero reel button plays the CGI showreel in place; its link stays the no-JS fallback.
$('.reel-button')?.addEventListener('click', event => {
  if (!lightbox?.showModal || event.metaKey || event.ctrlKey || event.shiftKey) return;
  event.preventDefault();
  openLightbox([{ youtube: 'xG_HKSOHpkA', title: 'CGI Showreel', note: 'Подборка компьютерной графики · 4:15 · 2021' }], 0, event.currentTarget);
});
const strip = $('[data-strip="engineering"]');
if (strip) renderStrip(strip, engineeringGallery);
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) $$('video.loop-video').forEach(video => video.pause()); });
