import { catHeadDrawing, catTailDrawing, catSlidingDrawing, catLoungeDrawing, catDrawingMetrics } from './cat-drawings.js';

// One character, one destination: the companion and its tracks take turns.
const MAX_PRINTS = 3;
const HIDE_DURATION = 120;
const IDLE_DELAY = 220;
const FADE_DURATION = 750;
const STEP_DISTANCE = 92;
const FINISH_STEP_DELAY = 120;
const PRINT_ENTRANCE = 180;
const PRINT_LIFETIME = 900;
const hasTail = placement => placement.pose === 'paired' || (placement.pose === 'peek' && ['left', 'right'].includes(placement.side));
// The perspective-rotated client preview has no straight screen-space edge.
const ANCHOR_SELECTORS = '.project-image-link, .motion-stage, .expertise-list, .reel-button';
const OBSTACLE_SELECTORS = 'h1, h2, h3, p, a, button, summary, .project-image-link, .motion-stage, .client-preview, .site-header, .site-footer';

function weightedPick(items, weight = () => 1) {
  const weights = items.map(weight);
  let roll = Math.random() * weights.reduce((sum, value) => sum + value, 0);
  return items.find((_, index) => (roll -= weights[index]) < 0) || items.at(-1);
}

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
  root.innerHTML = `<div class="scroll-cat__trail"></div><div class="scroll-cat__companion"><div class="scroll-cat__part scroll-cat__head"><div class="scroll-cat__orientation"><div class="scroll-cat__peek"></div></div></div><div class="scroll-cat__part scroll-cat__tail"><div class="scroll-cat__orientation"><div class="scroll-cat__tail-peek"></div></div></div><div class="scroll-cat__slider"></div></div>`;
  document.body.append(root);

  const trail = root.querySelector('.scroll-cat__trail');
  const companion = root.querySelector('.scroll-cat__companion');
  const head = root.querySelector('.scroll-cat__head');
  const tail = root.querySelector('.scroll-cat__tail');
  const slider = root.querySelector('.scroll-cat__slider');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compactScreen = window.matchMedia('(max-width: 760px)');
  const prints = [];
  const appearances = [];
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
  let currentPlacement;
  let plannedPlacement;
  let obstacles = [];
  let obstacleScrollY = window.scrollY;
  let anchorFrame;
  let destroyed = false;

  function catSize(pose = 'peek', side = 'top', part = 'head') {
    const base = compactScreen.matches ? 66 : window.innerWidth <= 1480 ? 84 : 96;
    const metrics = catDrawingMetrics(side, pose, part);
    const width = base * metrics.scale;
    return { width, height: width * metrics.ratio };
  }

  function partBounds(x, y, width, height, side) {
    const sideways = side === 'left' || side === 'right';
    const w = sideways ? height : width;
    const h = sideways ? width : height;
    return { left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 };
  }

  // Recompute both attachment points from the live edge, including resized cards.
  function anchoredCoordinates(placement, rect) {
    const size = catSize(placement.pose, placement.side);
    const tailDimensions = catSize(placement.pose, placement.side, 'tail');
    const overlap = catDrawingMetrics(placement.side, placement.pose).overlap * size.height;
    const tailOverlap = catDrawingMetrics(placement.side, placement.pose, 'tail').overlap * tailDimensions.height;
    const { side, fraction } = placement;
    let x = rect.left + rect.width * fraction;
    let y = rect.top + rect.height * fraction;
    let tailX = x;
    let tailY = y;
    if (side === 'left') { x = rect.left - size.height / 2 + overlap; tailX = rect.right + tailDimensions.height / 2 - tailOverlap; }
    if (side === 'right') { x = rect.right + size.height / 2 - overlap; tailX = rect.left - tailDimensions.height / 2 + tailOverlap; }
    if (side === 'top') { y = rect.top - size.height / 2 + overlap; tailY = rect.bottom + tailDimensions.height / 2 - tailOverlap; }
    if (side === 'bottom') { y = rect.bottom + size.height / 2 - overlap; tailY = rect.top - tailDimensions.height / 2 + tailOverlap; }
    return { ...placement, x, y, tailX, tailY };
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
    const tilt = Math.abs((placement.tilt || 0) * Math.PI / 180);
    const size = placement.pose === 'glide'
      ? { width: placement.width * Math.cos(tilt) + placement.height * Math.sin(tilt), height: placement.height * Math.cos(tilt) + placement.width * Math.sin(tilt) + 60 }
      : catSize(placement.pose, placement.side);
    return partBounds(placement.x, placement.y, size.width, size.height, placement.pose === 'glide' ? 'top' : placement.side);
  }

  function safeBounds(bounds, element = null) {
    return bounds.left >= 8 && bounds.right <= window.innerWidth - 8 && bounds.top >= 20 && bounds.bottom <= window.innerHeight - 18 && clearOfContent(bounds, element, 4);
  }

  function resolvePlacement(placement) {
    if (placement?.pose === 'glide') return safeBounds(placementBounds(placement)) ? placement : null;
    if (!placement?.element.isConnected) return null;
    const rect = placement.element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const resolved = anchoredCoordinates(placement, rect);
    const bounds = placementBounds(resolved);
    if (!safeBounds(bounds, placement.element)) return null;
    if (hasTail(resolved)) {
      const size = catSize(resolved.pose, resolved.side, 'tail');
      if (!safeBounds(partBounds(resolved.tailX, resolved.tailY, size.width, size.height, resolved.side), placement.element)) return null;
    }
    return resolved;
  }

  function approachTo(placement) {
    const compact = compactScreen.matches;
    const stride = compact ? 34 : 46;
    const spread = compact ? 4 : 6;
    const gap = compact ? 12 : 16;
    const width = compact ? 15 : 21;
    const height = compact ? 18 : 25;
    const heading = { left: 0, right: Math.PI, top: Math.PI / 2, bottom: -Math.PI / 2 }[placement.side];
    const landingX = -Math.cos(heading) * 8;
    const landingY = -Math.sin(heading) * 8;
    // Try several approaches, then shorten the walk in a narrow free gap.
    const turns = [0, -.3, .3, -.6, .6, -1, 1, -1.3, 1.3, -Math.PI / 2, Math.PI / 2];
    for (const length of [MAX_PRINTS, 2, 1]) {
      for (const turn of turns) {
        const angle = heading + turn;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const route = Array.from({ length }, (_, index) => {
          const distance = gap + stride * (length - 1 - index);
          const side = index % 2 ? 1 : -1;
          return { offsetX: landingX - dx * distance - dy * side * spread, offsetY: landingY - dy * distance + dx * side * spread, angle: angle * 180 / Math.PI + 90 + side * 6, width, height };
        });
        if (route.every(point => safeStep(placement, point))) return route;
      }
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
    const viewportHeight = window.innerHeight;
    const candidates = [];
    let visibleAnchors = 0;
    [...document.querySelectorAll(ANCHOR_SELECTORS)].forEach((anchor, index) => {
      if (visibleAnchors >= 36) return;
      const rect = anchor.getBoundingClientRect();
      if (rect.width < 35 || rect.height < 12 || rect.bottom < 0 || rect.top > viewportHeight) return;
      visibleAnchors++;
      const media = anchor.matches('.project-image-link, .motion-stage, .client-preview');
      const label = `${anchor.closest('section')?.id || 'hero'}:${anchor.className.split(' ')[0] || 'section'}:${index}`;
      ['left', 'right', 'top', 'bottom'].forEach(side => {
        [.15, .29, .43, .57, .71, .85].map(value => value + (Math.random() - .5) * .08).forEach(fraction => {
          for (const pose of ['paired', 'peek', 'lounge']) {
            if (!media && pose !== 'peek') continue;
            // A relaxed body rests on a horizontal ledge; side poses use a grip.
            if (pose === 'lounge' && side !== 'top') continue;
            if (side === 'bottom' && pose !== 'paired') continue;
            if (['left', 'right'].includes(side) && pose === 'paired') continue;
            const position = anchoredCoordinates({ side, pose, fraction }, rect);
            // Preserve the supplied pose and its paw grip without an added tilt.
            const candidate = { ...position, anchor: label, element: anchor, media, tilt: 0 };
            if (resolvePlacement(candidate)) candidates.push(candidate);
          }
        });
      });
    });
    // A single occasional glide uses an empty side corridor, never the content.
    const free = [];
    const width = compactScreen.matches ? 56 : 74;
    const height = width * 384 / 182;
    const rotatedWidth = width * Math.cos(Math.PI / 30) + height * Math.sin(Math.PI / 30);
    for (const x of [rotatedWidth / 2 + 12, window.innerWidth - rotatedWidth / 2 - 12]) {
      for (const fraction of [.28, .52, .74]) {
        const candidate = { x, y: viewportHeight * fraction, width, height, side: 'top', pose: 'glide', anchor: `whitespace:${x}:${fraction}`, tilt: x < window.innerWidth / 2 ? -6 : 6 };
        if (resolvePlacement(candidate)) free.push(candidate);
      }
    }
    const eligible = items => withApproach
      ? items.map(candidate => ({ ...candidate, route: approachTo(candidate) })).filter(candidate => candidate.route)
      : items;
    const anchored = eligible(candidates);
    const glides = eligible(free);
    if (glides.length && (!anchored.length || (appearances.at(-1)?.pose !== 'glide' && Math.random() < .18))) return weightedPick(glides);
    if (!anchored.length) return null;
    // Choose the element first so a card with more valid poses cannot dominate.
    const anchors = [...new Set(anchored.map(candidate => candidate.anchor))];
    const anchor = weightedPick(anchors, label => {
      const count = appearances.filter(previous => previous.anchor === label).length;
      return (appearances.at(-1)?.anchor === label ? .25 : 1) / (1 + count);
    });
    return weightedPick(anchored.filter(candidate => candidate.anchor === anchor), candidate => {
      const count = appearances.filter(previous => previous.anchor === anchor && previous.side === candidate.side && previous.pose === candidate.pose).length;
      const last = appearances.at(-1);
      const nearby = last?.anchor === anchor && last.side === candidate.side && Math.abs(last.fraction - candidate.fraction) < .2;
      return (nearby ? .2 : 1) / (1 + count * 3);
    });
  }

  function parkCat(placement, renderArtwork = true) {
    currentPlacement = placement;
    if (!placement) {
      companion.style.visibility = 'hidden';
      delete root.dataset.side;
      delete root.dataset.anchor;
      return;
    }
    root.dataset.side = placement.side;
    root.dataset.anchor = placement.anchor;
    root.dataset.pose = placement.pose;
    root.dataset.tail = String(hasTail(placement));
    if (renderArtwork) {
      appearances.push({ anchor: placement.anchor, side: placement.side, pose: placement.pose, fraction: placement.fraction });
      if (appearances.length > 8) appearances.shift();
    }
    if (placement.pose === 'glide') {
      slider.innerHTML = catSlidingDrawing();
      slider.style.width = `${placement.width}px`;
      slider.style.height = `${placement.height}px`;
      slider.style.left = `${placement.x - placement.width / 2}px`;
      slider.style.top = `${placement.y - placement.height / 2}px`;
      slider.style.setProperty('--cat-tilt', `${placement.tilt}deg`);
      return;
    }
    const rect = placement.element.getBoundingClientRect();
    currentPlacement.rect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    const angle = { top: 0, bottom: 180, left: -90, right: 90 }[placement.side];
    function placePart(part, x, y, size, edgeSide, drawing) {
      const bounds = partBounds(x, y, size.width, size.height, placement.side);
      const width = bounds.right - bounds.left;
      const height = bounds.bottom - bounds.top;
      // The supplied paws grip a few pixels over the edge. The image mask keeps
      // the face/body behind it while exposing only those original paw pixels.
      const bleed = part === head ? catDrawingMetrics(placement.side, placement.pose).bleed * size.height : 0;
      Object.assign(part.style, { width: `${width}px`, height: `${height}px`, transform: `translate3d(${bounds.left}px, ${bounds.top}px, 0)` });
      const inset = { top: -200, right: -200, bottom: -200, left: -200 };
      if (edgeSide === 'left') inset.right = width - (rect.left - bounds.left) - bleed;
      if (edgeSide === 'right') inset.left = rect.right - bounds.left - bleed;
      if (edgeSide === 'top') inset.bottom = height - (rect.top - bounds.top) - bleed;
      if (edgeSide === 'bottom') inset.top = rect.bottom - bounds.top - bleed;
      part.style.clipPath = `inset(${inset.top}px ${inset.right}px ${inset.bottom}px ${inset.left}px)`;
      const orientation = part.querySelector('.scroll-cat__orientation');
      Object.assign(orientation.style, { width: `${size.width}px`, height: `${size.height}px`, transform: `translate(-50%, -50%) rotate(${angle}deg)` });
      const artwork = orientation.firstElementChild;
      if (renderArtwork) artwork.innerHTML = drawing;
      artwork.style.setProperty('--cat-tilt', `${placement.tilt}deg`);
    }
    const size = catSize(placement.pose, placement.side);
    placePart(head, placement.x, placement.y, size, placement.side, renderArtwork ? (placement.pose === 'lounge' ? catLoungeDrawing(placement.side) : catHeadDrawing(placement.side, placement.pose)) : '');
    if (hasTail(placement)) {
      const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[placement.side];
      placePart(tail, placement.tailX, placement.tailY, catSize(placement.pose, placement.side, 'tail'), opposite, renderArtwork ? catTailDrawing(placement.side) : '');
    }
    followAnchor();
  }

  function syncAnchoredCat() {
    if (!currentPlacement?.element || !['idle', 'hiding'].includes(root.dataset.state)) return;
    const box = currentPlacement.element.getBoundingClientRect();
    const previous = currentPlacement.rect;
    if (previous && ['left', 'top', 'width', 'height'].every(key => Math.abs(box[key] - previous[key]) < .1)) return;
    collectObstacles();
    parkCat(resolvePlacement(currentPlacement), false);
  }

  // One bounds read while visible also follows image loading, layout reveals and
  // expanding details. Artwork and animations are never recreated by this loop.
  function followAnchor() {
    if (anchorFrame || destroyed || document.hidden || !currentPlacement?.element || !['idle', 'hiding'].includes(root.dataset.state)) return;
    anchorFrame = requestAnimationFrame(() => {
      anchorFrame = null;
      syncAnchoredCat();
      followAnchor();
    });
  }

  function removePrint(print) {
    window.clearTimeout(print.fadeTimer);
    window.clearTimeout(print.removeTimer);
    print.element.remove();
    const index = prints.indexOf(print);
    if (index !== -1) prints.splice(index, 1);
  }

  function clearPrints() {
    [...prints].forEach(removePrint);
  }

  function fadePrint(print) {
    if (print.element.classList.contains('is-fading')) return;
    window.clearTimeout(print.fadeTimer);
    print.element.classList.add('is-fading');
    print.removeTimer = window.setTimeout(() => removePrint(print), FADE_DURATION);
  }

  function clearTrail() {
    cancelAnimationFrame(anchorFrame);
    anchorFrame = null;
    window.clearTimeout(hideTimer);
    window.clearTimeout(idleTimer);
    window.clearTimeout(returnTimer);
    window.clearTimeout(finishTimer);
    activityVersion++;
    scrolling = false;
    catHidden = false;
    clearPrints();
    companion.style.visibility = '';
    root.dataset.state = 'idle';
    accumulatedDistance = 0;
    previousDirection = 0;
    finishingJourney = false;
    journeyStep = 0;
    plannedPlacement = null;
    delete root.dataset.destination;
    delete root.dataset.destinationX;
    delete root.dataset.destinationY;
    lastY = window.scrollY;
    collectObstacles();
    parkCat(choosePlacement());
  }

  function revealCat(version) {
    if (version !== activityVersion || scrolling) return;
    // Removing every print first makes the visible states mutually exclusive.
    clearPrints();
    collectObstacles();
    // Reveal at the same element the final steps approach; never roll a new target.
    const destination = resolvePlacement(plannedPlacement);
    if (!destination && plannedPlacement) {
      // A layout change during the fade needs its own visible final approach.
      planJourney();
      if (plannedPlacement) {
        finishJourney(version);
        return;
      }
    }
    parkCat(destination);
    plannedPlacement = null;
    delete root.dataset.destination;
    delete root.dataset.destinationX;
    delete root.dataset.destinationY;
    finishingJourney = false;
    catHidden = false;
    companion.style.visibility = currentPlacement ? '' : 'hidden';
    root.dataset.state = 'idle';
    followAnchor();
  }

  function settle() {
    scrolling = false;
    accumulatedDistance = 0;
    const version = activityVersion;
    finishingJourney = true;
    collectObstacles();
    // Commit a reachable final destination after the viewport has stopped.
    // An exhausted or faded preview is walked again instead of becoming stuck.
    const resolved = resolvePlacement(plannedPlacement);
    const route = resolved && approachTo(resolved);
    const fresh = prints.some(print => !print.element.classList.contains('is-fading'));
    if (!route) planJourney();
    else if (!fresh || journeyStep >= plannedPlacement.route.length) {
      clearPrints();
      journeyStep = 0;
      plannedPlacement = { ...resolved, route };
    }
    companion.style.visibility = 'hidden';
    catHidden = true;
    finishJourney(version);
  }

  function positionPrint(print) {
    const x = plannedPlacement.x + print.point.offsetX - print.point.width / 2;
    const y = plannedPlacement.y + print.point.offsetY - print.point.height / 2;
    print.element.dataset.x = String(x + print.point.width / 2);
    print.element.dataset.y = String(y + print.point.height / 2);
    print.element.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${print.point.angle}deg)`;
  }

  function resetJourney() {
    clearPrints();
    plannedPlacement = null;
    journeyStep = 0;
    delete root.dataset.destination;
    delete root.dataset.destinationX;
    delete root.dataset.destinationY;
  }

  function planJourney() {
    resetJourney();
    plannedPlacement = choosePlacement(true);
    if (plannedPlacement) describeDestination();
  }

  function describeDestination() {
    root.dataset.destination = plannedPlacement.anchor;
    root.dataset.destinationX = String(plannedPlacement.x);
    root.dataset.destinationY = String(plannedPlacement.y);
  }

  function syncJourney() {
    const resolved = resolvePlacement(plannedPlacement);
    if (!resolved || !resolved.route.every(point => safeStep(resolved, point))) {
      resetJourney();
      return false;
    }
    plannedPlacement = resolved;
    describeDestination();
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
    print.fadeTimer = window.setTimeout(() => fadePrint(print), PRINT_LIFETIME);
    while (prints.length > MAX_PRINTS) removePrint(prints[0]);
    return true;
  }

  function finishJourney(version) {
    if (version !== activityVersion || scrolling) return;
    collectObstacles();
    if (!syncJourney()) planJourney();
    if (!plannedPlacement) { revealCat(version); return; }
    if (journeyStep < plannedPlacement.route.length) {
      root.dataset.state = 'walking';
      leavePrint();
      const delay = journeyStep === plannedPlacement.route.length ? PRINT_ENTRANCE : FINISH_STEP_DELAY;
      finishTimer = window.setTimeout(() => finishJourney(version), delay);
      return;
    }
    finishingJourney = false;
    root.dataset.state = 'settling';
    prints.forEach(fadePrint);
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
    if (Math.abs(delta) < .5 || document.hidden || isObscured()) return;
    // Move the attachment and mask before the 120ms retreat, even on large jumps.
    syncAnchoredCat();
    if (reducedMotion.matches) {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        if (!currentPlacement) clearTrail();
      }, IDLE_DELAY);
      return;
    }

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
    destroyed = true;
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
