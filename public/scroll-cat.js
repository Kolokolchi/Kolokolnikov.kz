// The companion and its tracks take turns: the cat rests, the paws walk.
const MAX_PRINTS = 6;
const HIDE_DURATION = 120;
const IDLE_DELAY = 220;
const FADE_DURATION = 750;
const STEP_DISTANCE = 126;
const ANCHOR_SELECTORS = '.project-image-link, .motion-stage, .client-preview, .expertise-list, .hero-motion-tools, .hero-work-link, .reel-button, main > section, .section-heading, .work-toolbar, .contact-links, .intro-disciplines, .site-footer';
const OBSTACLE_SELECTORS = 'h1, h2, h3, p, a, button, summary, .project-image-link, .motion-stage, .client-preview, .site-header, .site-footer';

const catDrawing = `<svg class="scroll-cat__drawing" viewBox="0 0 112 176" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
  <g class="scroll-cat__silhouette" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M104 42C99 30 91 23 82 19L75 6C73 2 69 3 68 8L65 28C54 28 44 32 36 39L20 28C16 25 12 27 13 33L16 58C10 70 13 83 20 97L47 154C52 165 61 168 68 157L100 107C111 89 113 61 104 42Z"/>
    <path d="m22 48-2-11 11 8M74 24l-1-11 7 12"/>
    <g class="scroll-cat__face">
      <path d="M35 65c-1-9 7-11 10-2M70 49c-1-9 7-11 10-2"/>
      <path d="M56 70c1 4 3 7 7 8m-1-10 1 10m0 0c5 1 8-1 10-5"/>
      <path d="M55 64c2-4 8-6 11-3 2 3-1 7-4 8-3 0-7-2-7-5Z" fill="currentColor" stroke="none"/>
      <path d="m28 80 8-3m42-14 8-3" stroke-opacity=".38"/>
    </g>
    <path d="M103 82c-7-4-12-1-12 5s6 8 13 7M104 101c-7-4-12-1-12 5s6 8 13 7"/>
  </g>
</svg>`;

const pawDrawing = `<svg viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
  <g stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 24c2-3 3-7 8-7s6 4 8 7c2 3 6 5 4 9-2 4-7 2-12 2s-10 2-12-2c-2-4 2-6 4-9Z"/>
    <ellipse cx="7" cy="16" rx="3.4" ry="4.9" transform="rotate(-29 7 16)"/>
    <ellipse cx="14" cy="8" rx="3.4" ry="5" transform="rotate(-10 14 8)"/>
    <ellipse cx="23" cy="8" rx="3.4" ry="5" transform="rotate(10 23 8)"/>
    <ellipse cx="30" cy="16" rx="3.4" ry="4.9" transform="rotate(29 30 16)"/>
  </g>
</svg>`;

export function initScrollCat() {
  if (!document.body || document.querySelector('[data-scroll-cat]')) return () => {};

  const root = document.createElement('div');
  root.className = 'scroll-cat';
  root.dataset.scrollCat = '';
  root.dataset.state = 'idle';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `<div class="scroll-cat__trail"></div><div class="scroll-cat__companion"><div class="scroll-cat__orientation"><div class="scroll-cat__peek">${catDrawing}</div></div></div>`;
  document.body.append(root);

  const trail = root.querySelector('.scroll-cat__trail');
  const companion = root.querySelector('.scroll-cat__companion');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compactScreen = window.matchMedia('(max-width: 760px)');
  const prints = [];
  const controller = new AbortController();
  let hideTimer;
  let idleTimer;
  let returnTimer;
  let lastY = window.scrollY;
  let accumulatedDistance = 0;
  let previousDirection = 0;
  let steps = 0;
  let scrolling = false;
  let catHidden = false;
  let activityVersion = 0;
  let placementCycle = 0;
  let currentPlacement;
  let plannedPlacement;
  let journeyStart;
  let journeyStep = 0;
  let obstacles = [];
  let obstacleScrollY = window.scrollY;

  function catSize() {
    if (compactScreen.matches) return { width: 55, height: 86 };
    return window.innerWidth <= 1480 ? { width: 68, height: 107 } : { width: 84, height: 132 };
  }

  function intersects(a, b, padding = 0) {
    return a.left < b.right + padding && a.right > b.left - padding && a.top < b.bottom + padding && a.bottom > b.top - padding;
  }

  function collectObstacles() {
    const top = window.scrollY;
    obstacles = [];
    obstacleScrollY = top;
    const elements = [...document.querySelectorAll(OBSTACLE_SELECTORS)];
    let visibleElements = 0;
    elements.forEach(element => {
      if (visibleElements >= 180) return;
      if (root.contains(element)) return;
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height || box.bottom < -80 || box.top > window.innerHeight + 80) return;
      visibleElements++;
      let rectangles = [box];
      // Use actual text lines, rather than reserving the empty width of a <p>.
      if (element.matches('p, h1, h2, h3')) {
        const range = document.createRange();
        range.selectNodeContents(element);
        const lines = [...range.getClientRects()].filter(rect => rect.width && rect.height);
        if (lines.length) rectangles = lines.slice(0, 12);
      }
      rectangles.forEach(rect => obstacles.push({ owner: element, left: rect.left, right: rect.right, top: rect.top + top, bottom: rect.bottom + top }));
    });
  }

  function clearOfContent(bounds, anchor = null, padding = 4) {
    const documentBounds = { ...bounds, top: bounds.top + window.scrollY, bottom: bounds.bottom + window.scrollY };
    return !obstacles.some(obstacle => obstacle.owner !== anchor && intersects(documentBounds, obstacle, padding));
  }

  function choosePlacement() {
    const size = catSize();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const candidates = [];
    const seed = Math.abs(Math.round(window.scrollY / 137)) + placementCycle;
    let visibleAnchors = 0;
    [...document.querySelectorAll(ANCHOR_SELECTORS)].forEach((anchor, index) => {
      if (visibleAnchors >= 36) return;
      const rect = anchor.getBoundingClientRect();
      if (rect.width < 35 || rect.height < 12 || rect.bottom < 0 || rect.top > viewportHeight) return;
      visibleAnchors++;
      const section = anchor.matches('section');
      const media = anchor.matches('.project-image-link, .motion-stage, .client-preview');
      const overlap = media ? 14 : 0;
      const gap = media ? 0 : 6;
      const label = `${anchor.closest('section')?.id || 'hero'}:${anchor.className.split(' ')[0] || 'section'}:${index}`;
      ['left', 'right', 'top', 'bottom'].forEach(side => {
        const horizontal = side === 'top' || side === 'bottom';
        const width = horizontal ? size.height : size.width;
        const height = horizontal ? size.width : size.height;
        [.28, .72].forEach(fraction => {
          let x = rect.left + rect.width * fraction;
          let y = rect.top + rect.height * fraction;
          if (side === 'left') x = rect.left - width / 2 + overlap - gap;
          if (side === 'right') x = rect.right + width / 2 - overlap + gap;
          if (side === 'top') y = rect.top - height / 2 + overlap - gap;
          if (side === 'bottom') y = rect.bottom + height / 2 - overlap + gap;
          const bounds = { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
          if (bounds.left < 8 || bounds.right > viewportWidth - 8 || bounds.top < 20 || bounds.bottom > viewportHeight - 18) return;
          if (!clearOfContent(bounds, anchor, media ? 2 : 5)) return;
          const repeated = currentPlacement?.anchor === label && currentPlacement?.side === side;
          const score = (media ? 100 : section ? 25 : 65) - Math.abs(y - viewportHeight * .6) * .035 - (repeated ? 55 : 0);
          candidates.push({ x, y, side, anchor: label, score });
        });
      });
    });
    candidates.sort((a, b) => b.score - a.score);
    if (candidates.length) return candidates[seed % Math.min(3, candidates.length)];
    return null;
  }

  function parkCat(placement) {
    currentPlacement = placement;
    if (!placement) {
      companion.style.visibility = 'hidden';
      delete root.dataset.side;
      delete root.dataset.anchor;
      return;
    }
    const size = catSize();
    root.dataset.side = placement.side;
    root.dataset.anchor = placement.anchor;
    companion.style.transform = `translate3d(${placement.x - size.width / 2}px, ${placement.y - size.height / 2}px, 0)`;
  }

  function removePrint(print) {
    const index = prints.indexOf(print);
    if (index !== -1) prints.splice(index, 1);
    print.element.remove();
  }

  function clearTrail() {
    window.clearTimeout(hideTimer);
    window.clearTimeout(idleTimer);
    window.clearTimeout(returnTimer);
    activityVersion++;
    scrolling = false;
    catHidden = false;
    prints.splice(0).forEach(print => print.element.remove());
    companion.style.visibility = '';
    root.dataset.state = 'idle';
    accumulatedDistance = 0;
    previousDirection = 0;
    lastY = window.scrollY;
    collectObstacles();
    parkCat(choosePlacement());
  }

  function revealCat(version) {
    if (version !== activityVersion || scrolling) return;
    // Removing every print first makes the visible states mutually exclusive.
    prints.splice(0).forEach(print => print.element.remove());
    collectObstacles();
    placementCycle++;
    parkCat(choosePlacement());
    catHidden = false;
    companion.style.visibility = currentPlacement ? '' : 'hidden';
    root.dataset.state = 'idle';
  }

  function settle() {
    scrolling = false;
    accumulatedDistance = 0;
    const version = activityVersion;
    if (!prints.length) {
      revealCat(version);
      return;
    }
    root.dataset.state = 'settling';
    prints.forEach(print => print.element.classList.add('is-fading'));
    returnTimer = window.setTimeout(() => revealCat(version), FADE_DURATION);
  }

  function positionPrint(print) {
    const y = print.documentY - window.scrollY;
    print.element.style.transform = `translate3d(${print.x}px, ${y}px, 0) rotate(${print.angle}deg)`;
    if (y < -50 || y > window.innerHeight + 50) removePrint(print);
  }

  function leavePrint(direction) {
    const compact = compactScreen.matches;
    const side = steps++ % 2 ? 1 : -1;
    if (Math.abs(window.scrollY - obstacleScrollY) > window.innerHeight * .4) {
      collectObstacles();
      plannedPlacement = choosePlacement();
      journeyStep = 0;
      const lastPrint = prints.at(-1);
      const origin = currentPlacement || plannedPlacement;
      journeyStart = lastPrint ? { x: lastPrint.x, y: lastPrint.documentY } : origin ? { x: origin.x, y: origin.y + window.scrollY } : null;
    }
    if (!journeyStart || !plannedPlacement) return;
    const start = { x: journeyStart.x, y: Math.max(60, Math.min(window.innerHeight - 40, journeyStart.y - window.scrollY)) };
    const destination = plannedPlacement;
    const progress = Math.min(1, ++journeyStep / 8);
    const dx = destination.x - start.x;
    const dy = destination.y - start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const stride = compact ? 6 : 9;
    const point = {
      x: start.x + dx * progress + Math.sin(progress * Math.PI) * Math.min(65, window.innerWidth * .06) - dy / length * side * stride,
      y: start.y + dy * progress + dx / length * side * stride,
    };
    const printWidth = compact ? 15 : 21;
    const printHeight = compact ? 18 : 25;
    const lanes = [point.x, point.x - 28, point.x + 28, window.innerWidth * .5, window.innerWidth * .25, window.innerWidth * .75, 18, window.innerWidth - printWidth - 18];
    let safePoint;
    for (const offset of [0, -35, 35, -70, 70]) {
      for (const lane of lanes) {
        const x = Math.max(8, Math.min(window.innerWidth - printWidth - 8, lane));
        const y = Math.max(32, Math.min(window.innerHeight - printHeight - 25, point.y + offset));
        if (clearOfContent({ left: x - 3, right: x + printWidth + 3, top: y - 3, bottom: y + printHeight + 3 }, null, 2)) {
          safePoint = { x, y };
          break;
        }
      }
      if (safePoint) break;
    }
    if (!safePoint) return;
    const element = document.createElement('span');
    element.className = 'scroll-cat__print';
    element.innerHTML = pawDrawing;
    const print = {
      element,
      x: safePoint.x,
      documentY: window.scrollY + safePoint.y,
      angle: length > 12 ? Math.atan2(dy, dx) * 180 / Math.PI + 90 + side * 10 : (direction > 0 ? 180 : 0) + side * 13,
    };
    prints.push(print);
    trail.append(element);
    positionPrint(print);
    while (prints.length > MAX_PRINTS) removePrint(prints[0]);
  }

  function hideCat() {
    root.dataset.state = 'hiding';
    collectObstacles();
    plannedPlacement = choosePlacement();
    const origin = currentPlacement || plannedPlacement;
    journeyStart = origin ? { x: origin.x, y: origin.y + window.scrollY } : null;
    journeyStep = 0;
    hideTimer = window.setTimeout(() => {
      if (!scrolling) return;
      // Explicit visibility prevents a delayed paint from overlapping a paw.
      companion.style.visibility = 'hidden';
      catHidden = true;
      root.dataset.state = 'walking';
      if (accumulatedDistance >= STEP_DISTANCE) {
        leavePrint(previousDirection);
        accumulatedDistance %= STEP_DISTANCE;
      }
    }, HIDE_DURATION);
  }

  function isObscured() {
    return document.body.classList.contains('menu-open') || Boolean(document.querySelector('dialog[open]'));
  }

  function onScroll() {
    const currentY = window.scrollY;
    const delta = currentY - lastY;
    lastY = currentY;
    if (Math.abs(delta) < .5 || reducedMotion.matches || document.hidden || isObscured()) return;

    activityVersion++;
    scrolling = true;
    window.clearTimeout(returnTimer);
    if (root.dataset.state === 'idle') hideCat();
    else if (catHidden) root.dataset.state = 'walking';

    const direction = delta > 0 ? 1 : -1;
    // A new direction starts a fresh stride, preventing jitter from making tracks.
    if (direction !== previousDirection) accumulatedDistance = 0;
    previousDirection = direction;
    accumulatedDistance += Math.abs(delta);
    prints.slice().forEach(positionPrint);
    root.dataset.direction = direction > 0 ? 'down' : 'up';
    if (catHidden && accumulatedDistance >= STEP_DISTANCE) {
      leavePrint(direction);
      accumulatedDistance %= STEP_DISTANCE;
    }
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(settle, IDLE_DELAY);
  }

  const menuObserver = new MutationObserver(records => {
    const overlayChanged = records.some(record => record.attributeName === 'open' || record.target === document.body);
    if (overlayChanged && isObscured()) clearTrail();
  });
  menuObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'open'], subtree: true });

  function onPageHide(event) {
    clearTrail();
    if (!event.persisted) destroy();
  }

  function destroy() {
    clearTrail();
    controller.abort();
    menuObserver.disconnect();
    root.remove();
  }

  const options = { signal: controller.signal };
  window.addEventListener('scroll', onScroll, { ...options, passive: true });
  window.addEventListener('resize', clearTrail, { ...options, passive: true });
  window.addEventListener('pagehide', onPageHide, options);
  window.addEventListener('pageshow', event => {
    if (event.persisted) clearTrail();
  }, options);
  document.addEventListener('visibilitychange', clearTrail, options);
  reducedMotion.addEventListener('change', clearTrail, options);
  collectObstacles();
  parkCat(choosePlacement());
  return destroy;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScrollCat, { once: true });
} else {
  initScrollCat();
}
