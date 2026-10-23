import { assemblyDesigns } from './project-assembly-data.js';

const svgNS = 'http://www.w3.org/2000/svg';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
let generation = 0;

function outline(piece) {
  const points = piece.poly || (() => {
    const [x, y, w, h] = piece.rect;
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  })();
  return `M${points.map(point => point.map(value => value / 100).join(',')).join('L')}Z`;
}

// Each mask follows the original design's content groups, rather than a tile grid.
export function createProjectAssembly(project) {
  const design = assemblyDesigns[project.id];
  const link = document.createElement('a');
  link.className = 'project-image-link';
  link.href = `project.html?project=${encodeURIComponent(project.id)}`;
  link.setAttribute('aria-label', `Подробнее: ${project.name}`);
  link.style.setProperty('--preview-ratio', design.width / design.height);
  link.style.setProperty('--assembly-paper', design.paper);
  link.dataset.assembly = project.id;
  const image = document.createElement('img');
  image.className = 'project-image assembly-reference';
  Object.assign(image, {
    src: project.image, alt: `${project.name} — ${project.type.toLowerCase()}`,
    loading: 'lazy', decoding: 'async', width: design.width, height: design.height,
  });
  const arrow = document.createElement('span');
  arrow.className = 'project-open';
  arrow.textContent = '↗';
  arrow.setAttribute('aria-hidden', 'true');
  link.append(image, arrow);
  return link;
}

export function mountProjectAssemblies(grid) {
  const currentGeneration = ++generation;
  const active = new Set();
  let frame = 0;
  let disposed = false;
  const states = [...grid.querySelectorAll('[data-assembly]')].map(link => ({
    link, article: link.closest('.project-card'),
    design: assemblyDesigns[link.dataset.assembly],
    image: link.querySelector('.assembly-reference'), pieces: [], ready: false, preparing: false,
  }));

  function render(state) {
    if (!state.ready) return;
    const { top } = state.article.getBoundingClientRect();
    const viewport = window.innerHeight;
    // Finish on arrival; the sticky presentation then gives the complete site room to read.
    const progress = reduceMotion.matches || state.link.matches(':focus-within')
      ? 1 : clamp((viewport * .96 - top) / (viewport * .82));
    if (state.progress === progress) return;
    state.progress = progress;
    for (const [index, part] of state.pieces.entries()) {
      const start = part.background ? 0 : .06 + (index - 1) * .035;
      const amount = smooth((progress - start) / (part.background ? .58 : .64));
      const distance = 1 - amount;
      const [x, y, angle] = part.from;
      part.element.style.transform = `translate3d(${x * distance}%, ${y * distance}%, 0) rotate(${angle * distance}deg) scale(${1 - .035 * distance})`;
      part.element.style.opacity = String(smooth((progress - start) / .25));
    }
    state.source.style.opacity = String(.62 * smooth(progress / .18) * (1 - smooth((progress - .56) / .27)));
    state.source.style.transform = `translate3d(${(1 - progress) * 4}%, ${(1 - progress) * 6}%, 0) scale(${1.025 - progress * .025})`;
    // An exact reference seals fractional-pixel seams only after every piece has settled.
    state.image.style.opacity = String(smooth((progress - .94) / .06));
    state.link.classList.toggle('assembly-complete', progress === 1);
    state.link.classList.toggle('assembly-moving', progress > 0 && progress < 1);
  }

  function update() {
    frame = 0;
    if (disposed || document.hidden) return;
    active.forEach(render);
  }
  function schedule() {
    if (!frame && !disposed) frame = requestAnimationFrame(update);
  }

  async function prepare(state) {
    if (state.ready || state.preparing || reduceMotion.matches) return;
    state.preparing = true;
    try { await state.image.decode(); } catch { state.preparing = false; return; }
    state.preparing = false;
    if (state.ready || disposed || currentGeneration !== generation || reduceMotion.matches) return;
    const { link, design } = state;
    const art = document.createElement('div');
    art.className = 'assembly-art';
    art.setAttribute('aria-hidden', 'true');
    const definitions = document.createElementNS(svgNS, 'svg');
    definitions.classList.add('assembly-definitions');
    definitions.setAttribute('width', '0');
    definitions.setAttribute('height', '0');
    const defs = document.createElementNS(svgNS, 'defs');
    definitions.append(defs);
    const source = document.createElement('img');
    source.className = 'assembly-source';
    source.alt = '';
    source.src = design.source.src;
    source.decoding = 'async';
    const [sx, sy, sw, sh] = design.source.rect;
    Object.assign(source.style, {
      left: `${sx}%`, top: `${sy}%`, width: `${sw}%`, height: `${sh}%`,
      objectFit: design.source.fit || 'cover',
    });
    state.source = source;
    art.append(source);
    const background = { name: 'Основа', from: [0, 5, 0], background: true };
    for (const [index, piece] of [background, ...design.pieces].entries()) {
      const id = `assembly-${currentGeneration}-${link.dataset.assembly}-${index}`;
      const mask = document.createElementNS(svgNS, 'clipPath');
      mask.id = id;
      mask.setAttribute('clipPathUnits', 'objectBoundingBox');
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('clip-rule', 'evenodd');
      path.setAttribute('d', piece.background
        ? `M0,0H1V1H0Z${design.pieces.map(outline).join('')}` : outline(piece));
      mask.append(path);
      defs.append(mask);
      const element = document.createElement('div');
      element.className = 'assembly-piece';
      element.style.clipPath = `url(#${id})`;
      element.dataset.part = piece.name;
      if (piece.rect) {
        const [x, y, w, h] = piece.rect;
        element.style.transformOrigin = `${x + w / 2}% ${y + h / 2}%`;
      }
      const fragment = document.createElement('img');
      fragment.src = state.image.currentSrc || state.image.src;
      fragment.alt = '';
      fragment.draggable = false;
      element.append(fragment);
      art.append(element);
      state.pieces.push({ ...piece, element });
    }
    link.prepend(definitions, art);
    state.ready = true;
    render(state);
    link.classList.add('assembly-ready');
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const state = states.find(item => item.article === entry.target);
      if (entry.isIntersecting) { active.add(state); prepare(state); }
      else {
        render(state);
        active.delete(state);
        state.link.classList.remove('assembly-moving');
      }
    }
    schedule();
  }, { rootMargin: '100% 0px' });
  states.forEach(state => observer.observe(state.article));
  function preferenceChanged() {
    for (const state of states) {
      state.progress = undefined;
      if (!state.ready) { if (active.has(state)) prepare(state); }
      else render(state);
    }
    schedule();
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  document.addEventListener('visibilitychange', schedule);
  grid.addEventListener('focusin', schedule);
  grid.addEventListener('focusout', schedule);
  reduceMotion.addEventListener('change', preferenceChanged);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('visibilitychange', schedule);
    grid.removeEventListener('focusin', schedule);
    grid.removeEventListener('focusout', schedule);
    reduceMotion.removeEventListener('change', preferenceChanged);
  };
}
