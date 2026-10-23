// The companion and its tracks take turns: the cat rests, the paws walk.
const MAX_PRINTS = 3;
const HIDE_DURATION = 120;
const IDLE_DELAY = 220;
const FADE_DURATION = 750;
const STEP_DISTANCE = 92;
const FINISH_STEP_DELAY = 120;
const PRINT_ENTRANCE = 180;
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
  let finishTimer;
  let lastY = window.scrollY;
  let accumulatedDistance = 0;
  let previousDirection = 0;
  let journeyStep = 0;
  let finishingJourney = false;
  let scrolling = false;
  let catHidden = false;
  let activityVersion = 0;
  let placementCycle = 0;
  let currentPlacement;
  let plannedPlacement;
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

  function placementBounds(placement) {
    const size = catSize();
    const horizontal = placement.side === 'top' || placement.side === 'bottom';
    const width = horizontal ? size.height : size.width;
    const height = horizontal ? size.width : size.height;
    return { left: placement.x - width / 2, right: placement.x + width / 2, top: placement.y - height / 2, bottom: placement.y + height / 2 };
  }

  function resolvePlacement(placement) {
    if (!placement?.element.isConnected) return null;
    const rect = placement.element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const resolved = { ...placement, x: rect.left + placement.offsetX, y: rect.top + placement.offsetY };
    const bounds = placementBounds(resolved);
    if (bounds.left < 8 || bounds.right > window.innerWidth - 8 || bounds.top < 20 || bounds.bottom > window.innerHeight - 18) return null;
    return clearOfContent(bounds, placement.element, placement.media ? 2 : 5) ? resolved : null;
  }

  function approachTo(placement) {
    const compact = compactScreen.matches;
    const stride = compact ? 34 : 46;
    const spread = compact ? 4 : 6;
    const gap = compact ? 22 : 30;
    const width = compact ? 15 : 21;
    const height = compact ? 18 : 25;
    const heading = { left: 0, right: Math.PI, top: Math.PI / 2, bottom: -Math.PI / 2 }[placement.side];
    const landingX = -Math.cos(heading) * 8;
    const landingY = -Math.sin(heading) * 8;
    // Narrow gaps can be approached along the edge as well as straight toward it.
    for (const turn of [0, -.3, .3, -.6, .6, -1, 1, -1.3, 1.3, -Math.PI / 2, Math.PI / 2]) {
      const angle = heading + turn;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const route = Array.from({ length: MAX_PRINTS }, (_, index) => {
        const distance = gap + stride * (MAX_PRINTS - 1 - index);
        const side = index % 2 ? 1 : -1;
        return { offsetX: landingX - dx * distance - dy * side * spread, offsetY: landingY - dy * distance + dx * side * spread, angle: angle * 180 / Math.PI + 90 + side * 6, width, height };
      });
      if (route.every(point => safeStep(placement, point))) return route;
    }
    return null;
  }

  function safeStep(placement, point) {
    const x = placement.x + point.offsetX - point.width / 2;
    const y = placement.y + point.offsetY - point.height / 2;
    if (x < 8 || x + point.width > window.innerWidth - 8 || y < 32 || y + point.height > window.innerHeight - 25) return false;
    return clearOfContent({ left: x - 3, right: x + point.width + 3, top: y - 3, bottom: y + point.height + 3 }, null, 2);
  }

  function choosePlacement(withApproach = false) {
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
          candidates.push({ x, y, side, anchor: label, score, element: anchor, offsetX: x - rect.left, offsetY: y - rect.top, media });
        });
      });
    });
    candidates.sort((a, b) => b.score - a.score);
    if (candidates.length) {
      const preferred = seed % Math.min(3, candidates.length);
      if (!withApproach) return candidates[preferred];
      const ordered = [candidates[preferred], ...candidates.filter((_, index) => index !== preferred)];
      for (const candidate of ordered) {
        const route = approachTo(candidate);
        if (route) return { ...candidate, route };
      }
    }
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
    const rect = placement.element.getBoundingClientRect();
    const left = placement.x - size.width / 2;
    const top = placement.y - size.height / 2;
    // The anchor edge occludes the silhouette, including its rotated variants.
    const inset = { top: -200, right: -200, bottom: -200, left: -200 };
    if (placement.side === 'left') inset.right = size.width - (rect.left - left);
    if (placement.side === 'right') inset.left = rect.right - left;
    if (placement.side === 'top') inset.bottom = size.height - (rect.top - top);
    if (placement.side === 'bottom') inset.top = rect.bottom - top;
    companion.style.clipPath = `inset(${inset.top}px ${inset.right}px ${inset.bottom}px ${inset.left}px)`;
    root.dataset.side = placement.side;
    root.dataset.anchor = placement.anchor;
    companion.style.transform = `translate3d(${placement.x - size.width / 2}px, ${placement.y - size.height / 2}px, 0)`;
  }

  function clearTrail() {
    window.clearTimeout(hideTimer);
    window.clearTimeout(idleTimer);
    window.clearTimeout(returnTimer);
    window.clearTimeout(finishTimer);
    activityVersion++;
    scrolling = false;
    catHidden = false;
    prints.splice(0).forEach(print => print.element.remove());
    companion.style.visibility = '';
    root.dataset.state = 'idle';
    accumulatedDistance = 0;
    previousDirection = 0;
    finishingJourney = false;
    journeyStep = 0;
    plannedPlacement = null;
    delete root.dataset.destination;
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
    // Reveal at the same element the final steps approach; never roll a new target.
    parkCat(resolvePlacement(plannedPlacement));
    plannedPlacement = null;
    finishingJourney = false;
    catHidden = false;
    companion.style.visibility = currentPlacement ? '' : 'hidden';
    root.dataset.state = 'idle';
  }

  function settle() {
    scrolling = false;
    accumulatedDistance = 0;
    const version = activityVersion;
    finishingJourney = true;
    finishJourney(version);
  }

  function positionPrint(print) {
    const x = plannedPlacement.x + print.point.offsetX - print.point.width / 2;
    const y = plannedPlacement.y + print.point.offsetY - print.point.height / 2;
    print.element.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${print.point.angle}deg)`;
  }

  function resetJourney() {
    prints.splice(0).forEach(print => print.element.remove());
    plannedPlacement = null;
    journeyStep = 0;
    delete root.dataset.destination;
  }

  function planJourney() {
    resetJourney();
    plannedPlacement = choosePlacement(true);
    if (plannedPlacement) root.dataset.destination = plannedPlacement.anchor;
  }

  function syncJourney() {
    const resolved = resolvePlacement(plannedPlacement);
    if (!resolved || !resolved.route.every(point => safeStep(resolved, point))) {
      resetJourney();
      return false;
    }
    plannedPlacement = resolved;
    prints.forEach(positionPrint);
    return true;
  }

  function leavePrint() {
    const point = plannedPlacement?.route[journeyStep];
    if (!point || !catHidden) return false;
    const element = document.createElement('span');
    element.className = 'scroll-cat__print';
    element.innerHTML = pawDrawing;
    const print = { element, point };
    journeyStep++;
    element.dataset.step = String(journeyStep);
    prints.push(print);
    trail.append(element);
    positionPrint(print);
    prints.forEach((item, index) => { item.element.dataset.age = String(prints.length - 1 - index); });
    return true;
  }

  function finishJourney(version) {
    if (version !== activityVersion || scrolling) return;
    collectObstacles();
    if (!syncJourney()) {
      revealCat(version);
      return;
    }
    if (journeyStep < plannedPlacement.route.length) {
      root.dataset.state = 'walking';
      leavePrint();
      const delay = journeyStep === plannedPlacement.route.length ? PRINT_ENTRANCE : FINISH_STEP_DELAY;
      finishTimer = window.setTimeout(() => finishJourney(version), delay);
      return;
    }
    finishingJourney = false;
    root.dataset.state = 'settling';
    prints.forEach(print => print.element.classList.add('is-fading'));
    returnTimer = window.setTimeout(() => revealCat(version), FADE_DURATION);
  }

  function hideCat() {
    root.dataset.state = 'hiding';
    collectObstacles();
    planJourney();
    hideTimer = window.setTimeout(() => {
      if (!scrolling) return;
      // Explicit visibility prevents a delayed paint from overlapping a paw.
      companion.style.visibility = 'hidden';
      catHidden = true;
      root.dataset.state = 'walking';
      if (!syncJourney()) {
        collectObstacles();
        planJourney();
      }
      if (accumulatedDistance >= STEP_DISTANCE) {
        leavePrint();
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

    const direction = delta > 0 ? 1 : -1;
    const restarting = finishingJourney || root.dataset.state === 'settling' || (previousDirection && direction !== previousDirection);
    if (restarting) resetJourney();
    finishingJourney = false;
    activityVersion++;
    scrolling = true;
    window.clearTimeout(returnTimer);
    window.clearTimeout(finishTimer);
    if (root.dataset.state === 'idle') {
      previousDirection = direction;
      hideCat();
    }
    else if (catHidden) root.dataset.state = 'walking';

    // A new direction starts a fresh stride, preventing jitter from making tracks.
    if (direction !== previousDirection) accumulatedDistance = 0;
    previousDirection = direction;
    accumulatedDistance += Math.abs(delta);
    root.dataset.direction = direction > 0 ? 'down' : 'up';
    if (catHidden) {
      if (Math.abs(window.scrollY - obstacleScrollY) > window.innerHeight * .25) collectObstacles();
      if (!syncJourney()) {
        collectObstacles();
        planJourney();
      }
      if (accumulatedDistance >= STEP_DISTANCE) {
        leavePrint();
        accumulatedDistance %= STEP_DISTANCE;
      }
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
