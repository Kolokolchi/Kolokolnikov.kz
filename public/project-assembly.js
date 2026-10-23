import { assemblyDesigns } from './project-assembly-data.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = value => Math.max(0, Math.min(1, value));
let generation = 0;

export function createProjectAssembly(project) {
  const design = assemblyDesigns[project.id];
  const link = document.createElement('a');
  link.className = 'project-image-link';
  link.href = `project.html?project=${encodeURIComponent(project.id)}`;
  link.setAttribute('aria-label', `Подробнее: ${project.name}`);
  link.style.setProperty('--preview-ratio', design.width / design.height);
  link.style.setProperty('--assembly-paper', design.paper);
  link.dataset.assembly = project.id;
  const fallback = document.createElement('img');
  fallback.className = 'project-image assembly-fallback';
  Object.assign(fallback, {
    src: project.image, alt: `${project.name} — ${project.type.toLowerCase()}`,
    loading: 'lazy', decoding: 'async', width: design.width, height: design.height,
  });
  const arrow = document.createElement('span');
  arrow.className = 'project-open';
  arrow.textContent = '↗';
  arrow.setAttribute('aria-hidden', 'true');
  link.append(fallback, arrow);
  return link;
}

export function mountProjectAssemblies(grid) {
  const currentGeneration = ++generation;
  const active = new Set();
  let frame = 0;
  let disposed = false;
  const states = [...grid.querySelectorAll('[data-assembly]')].map(link => ({
    link, design: assemblyDesigns[link.dataset.assembly], layers: [], ready: false,
  }));
  const byLink = new Map(states.map(state => [state.link, state]));

  function render(state) {
    if (!state.ready) return;
    const { top, height } = state.link.getBoundingClientRect();
    const viewport = innerHeight;
    const travel = Math.min(viewport * .72, height + viewport * .1);
    const progress = reduceMotion.matches || state.link.matches(':focus-within')
      ? 1 : clamp((viewport * .95 - top) / travel);
    if (state.progress === progress) return;
    state.progress = progress;
    for (const layer of state.layers) {
      // Paused WAAPI effects follow scroll; the continuous backdrop is untouched.
      layer.animation.currentTime = clamp((progress - layer.start) / .68) * 1000;
    }
    state.link.classList.toggle('assembly-complete', progress === 1);
  }

  function update() {
    frame = 0;
    if (disposed || document.hidden) return;
    active.forEach(render);
  }
  function schedule() {
    if (!frame && !disposed) frame = requestAnimationFrame(update);
  }
  function scale(state) {
    if (!state.iframe) return;
    state.iframe.style.transform = `scale(${state.link.clientWidth / state.design.width})`;
  }

  function prepare(state) {
    if (state.iframe || disposed) return;
    const iframe = document.createElement('iframe');
    iframe.className = 'assembly-native-frame';
    iframe.title = 'Визуальная композиция проекта';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    iframe.setAttribute('sandbox', 'allow-same-origin');
    iframe.width = state.design.width;
    iframe.height = state.design.height;
    iframe.addEventListener('load', async () => {
      if (disposed || currentGeneration !== generation) return;
      const doc = iframe.contentDocument;
      if (!doc) return;
      const elements = [...doc.querySelectorAll('[data-assembly-layer]')];
      if (elements.length < 4) return;
      await Promise.allSettled([doc.fonts.ready, ...[...doc.images].map(image => image.decode())]);
      if (disposed || currentGeneration !== generation || state.ready) return;
      const view = iframe.contentWindow;
      const ease = getComputedStyle(grid).getPropertyValue('--ease-out').trim() || 'cubic-bezier(.23,1,.32,1)';
      for (const [index, element] of elements.entries()) {
        const [x = 0, y = 32, angle = 0] = (element.dataset.from || '0,32,0').split(',').map(Number);
        const style = view.getComputedStyle(element);
        const base = style.transform === 'none' ? '' : style.transform;
        const opacity = Number(style.opacity);
        const animation = element.animate([
          { transform: `${base} translate3d(${x}px, ${y}px, 0) rotate(${angle}deg)`, opacity: 0 },
          { transform: base || 'none', opacity },
        ], { duration: 1000, easing: ease, fill: 'both' });
        animation.pause();
        const order = Number(element.dataset.order ?? index);
        state.layers.push({ animation, start: Math.min(.28, order * .028) });
      }
      state.ready = true;
      scale(state);
      render(state);
      state.link.classList.add('assembly-ready');
    }, { once: true });
    state.iframe = iframe;
    iframe.src = state.design.scene;
    state.link.prepend(iframe);
    scale(state);
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const state = byLink.get(entry.target);
      if (entry.isIntersecting) { active.add(state); prepare(state); }
      else { render(state); active.delete(state); }
    }
    schedule();
  }, { rootMargin: '90% 0px' });
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) scale(byLink.get(entry.target));
    schedule();
  });
  states.forEach(state => { observer.observe(state.link); resizeObserver.observe(state.link); });
  function preferenceChanged() {
    states.forEach(state => { state.progress = undefined; render(state); });
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
    resizeObserver.disconnect();
    states.forEach(state => state.layers.forEach(layer => layer.animation.cancel()));
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('visibilitychange', schedule);
    grid.removeEventListener('focusin', schedule);
    grid.removeEventListener('focusout', schedule);
    reduceMotion.removeEventListener('change', preferenceChanged);
  };
}
