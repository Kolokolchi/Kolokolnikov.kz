import { catHeadDrawing, catTailDrawing, catSlidingDrawing, catLoungeDrawing, catDrawingMetrics } from './cat-drawings.js';
import { createCatVoice } from './cat-meow.js';

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
// The scruff: top of the head between the raised paws of the glide artwork (panel 6), as a share of its box.
const SCRUFF = { x: (1077 - 985) / 182, y: (551 - 426) / 384 };
// How far from a surface edge a carried cat may be released and still settle on it.
const DROP_RADIUS = 150;
const DROP_DURATION = 170;

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
  const catAction = 'type="button" data-cat-voice aria-label="Погладить котика — услышать мяу" title="Погладить котика" disabled';
  root.innerHTML = `<div class="scroll-cat__trail" aria-hidden="true"></div><div class="scroll-cat__landing" aria-hidden="true"></div><div class="scroll-cat__companion" inert><button class="scroll-cat__part scroll-cat__head" ${catAction}><span class="scroll-cat__orientation"><span class="scroll-cat__peek"></span></span></button><button class="scroll-cat__part scroll-cat__tail" ${catAction} tabindex="-1"><span class="scroll-cat__orientation"><span class="scroll-cat__tail-peek"></span></span></button><button class="scroll-cat__slider" ${catAction}></button></div>`;
  document.body.append(root);

  const trail = root.querySelector('.scroll-cat__trail');
  const companion = root.querySelector('.scroll-cat__companion');
  const head = root.querySelector('.scroll-cat__head');
  const tail = root.querySelector('.scroll-cat__tail');
  const slider = root.querySelector('.scroll-cat__slider');
  const landing = root.querySelector('.scroll-cat__landing');
  const voice = createCatVoice();
  root.append(voice.audio);
  const catButtons = [...root.querySelectorAll('[data-cat-voice]')];
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
  let glideFinished = false;
  let carry = null;
  let suppressSliderClick = false;

  function updateCatInteraction() {
    const active = Boolean(currentPlacement) && root.dataset.state === 'idle' && !glideFinished && !document.hidden && !isObscured();
    companion.inert = !active;
    catButtons.forEach(button => { button.disabled = !active; });
  }

  catButtons.forEach(button => button.addEventListener('click', event => {
    if (button.disabled || isObscured()) return;
    event.stopPropagation();
    // Picking the slider up already meowed; the click that follows the release adds nothing.
    if (button === slider && suppressSliderClick) { suppressSliderClick = false; return; }
    voice.play();
  }, { signal: controller.signal }));
  slider.addEventListener('animationend', event => {
    if (!['scroll-cat-glide', 'scroll-cat-reglide'].includes(event.animationName)) return;
    glideFinished = true;
    updateCatInteraction();
  }, { signal: controller.signal });
  slider.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || carry || slider.disabled || currentPlacement?.pose !== 'glide' || root.dataset.state !== 'idle' || isObscured()) return;
    event.preventDefault();
    startCarry(event);
  }, { signal: controller.signal });

  // Catching the sliding cat lifts it by the scruff: it dangles from the pointer and swings with the hand.
  // Released near a surface edge it settles there in one of its regular poses; on free side space it
  // slides on from there; over content it loses its grip and drops away. A click without a move is
  // still a meow, and the cat slides on.
  function startCarry(event) {
    const { width, height } = currentPlacement;
    const left = parseFloat(slider.style.left);
    const top = parseFloat(slider.style.top);
    const transform = getComputedStyle(slider).transform;
    const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
    // Where the scruff is on screen right now, mid-slide and tilted.
    const scruff = matrix.transformPoint(new DOMPoint((SCRUFF.x - .5) * width, (SCRUFF.y - .5) * height));
    const listeners = new AbortController();
    carry = {
      id: event.pointerId, x0: event.clientX, y0: event.clientY, px: event.clientX, py: event.clientY,
      sx: left + width / 2 + scruff.x, sy: top + height / 2 + scruff.y, width, height,
      angle: currentPlacement.tilt || 0, spin: 0, vx: 0, moveTime: performance.now(), frameTime: performance.now(),
      moved: false, target: null, lookup: 0, frame: 0, listeners,
    };
    try { slider.setPointerCapture(event.pointerId); } catch {}
    collectObstacles();
    root.dataset.carry = '';
    document.documentElement.classList.add('scroll-cat-carrying');
    suppressSliderClick = true;
    voice.play();
    const options = { signal: listeners.signal };
    window.addEventListener('pointermove', onCarryMove, options);
    window.addEventListener('pointerup', onCarryEnd, options);
    window.addEventListener('pointercancel', onCarryEnd, options);
    window.addEventListener('keydown', key => { if (key.key === 'Escape') finishCarry('back'); }, options);
    carry.frame = requestAnimationFrame(carryFrame);
  }

  function carryFrame(now) {
    if (!carry) return;
    const dt = Math.min(.05, (now - carry.frameTime) / 1000);
    carry.frameTime = now;
    // The scruff catches up with the hand quickly; the body hangs below it like a pendulum,
    // trailing the hand's sideways speed and swinging back to rest.
    const follow = 1 - Math.exp(-dt * 30);
    carry.sx += (carry.px - carry.sx) * follow;
    carry.sy += (carry.py - carry.sy) * follow;
    carry.vx *= Math.exp(-dt * 7);
    if (reducedMotion.matches) carry.angle = 0;
    else {
      const goal = Math.max(-32, Math.min(32, carry.vx * .024));
      carry.spin += ((goal - carry.angle) * 120 - carry.spin * 9) * dt;
      carry.angle += carry.spin * dt;
    }
    slider.style.left = `${carry.sx - SCRUFF.x * carry.width}px`;
    slider.style.top = `${carry.sy - SCRUFF.y * carry.height}px`;
    slider.style.setProperty('--carry-angle', `${carry.angle.toFixed(2)}deg`);
    carry.frame = requestAnimationFrame(carryFrame);
  }

  function onCarryMove(event) {
    if (!carry || event.pointerId !== carry.id) return;
    const now = performance.now();
    const speed = (event.clientX - carry.px) / Math.max(4, now - carry.moveTime) * 1000;
    carry.vx = carry.vx * .55 + speed * .45;
    carry.moveTime = now;
    carry.px = event.clientX;
    carry.py = event.clientY;
    if (!carry.moved && Math.hypot(carry.px - carry.x0, carry.py - carry.y0) > 6) carry.moved = true;
    // Looking for a landing place is cheap but not free: a few times a second is enough.
    if (carry.moved && now - carry.lookup > 60) {
      carry.lookup = now;
      showLanding(findLanding(carry.px, carry.py));
    }
  }

  function onCarryEnd(event) {
    if (!carry || event.pointerId !== carry.id) return;
    if (event.type === 'pointercancel' || !carry.moved) { finishCarry('back'); return; }
    showLanding(findLanding(carry.px, carry.py));
    finishCarry(carry.target ? 'land' : 'release');
  }

  function edgeOf(placement) {
    const rect = placement.element.getBoundingClientRect();
    if (placement.side === 'top' || placement.side === 'bottom') {
      return { x: rect.left + rect.width * placement.fraction, y: placement.side === 'top' ? rect.top : rect.bottom };
    }
    return { x: placement.side === 'left' ? rect.left : rect.right, y: rect.top + rect.height * placement.fraction };
  }

  // The nearest edge of a visible surface around the hand, in a pose that fits there: a relaxed
  // lounge or paired grip on top, a side peek, the upside-down pair below a media card.
  function findLanding(px, py) {
    let best = null;
    [...document.querySelectorAll(ANCHOR_SELECTORS)].forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      if (rect.width < 35 || rect.height < 12 || rect.bottom < 0 || rect.top > window.innerHeight) return;
      if (px < rect.left - DROP_RADIUS || px > rect.right + DROP_RADIUS || py < rect.top - DROP_RADIUS || py > rect.bottom + DROP_RADIUS) return;
      const media = element.matches('.project-image-link, .motion-stage, .client-preview');
      const label = `${element.closest('section')?.id || 'hero'}:${element.className.split(' ')[0] || 'section'}:${index}`;
      const along = { top: (px - rect.left) / rect.width, bottom: (px - rect.left) / rect.width, left: (py - rect.top) / rect.height, right: (py - rect.top) / rect.height };
      const poses = { top: media ? ['lounge', 'paired', 'peek'] : ['peek'], bottom: media ? ['paired'] : [], left: ['peek'], right: ['peek'] };
      for (const side of ['top', 'left', 'right', 'bottom']) {
        const base = Math.min(.85, Math.max(.15, along[side]));
        for (const pose of poses[side]) {
          for (const shift of [0, -.07, .07, -.14, .14, -.21, .21]) {
            const fraction = base + shift;
            if (fraction < .1 || fraction > .9) continue;
            const candidate = resolvePlacement({ side, pose, fraction, anchor: label, element, media, tilt: 0 });
            if (!candidate) continue;
            const edge = edgeOf(candidate);
            const distance = Math.hypot(px - edge.x, py - edge.y);
            if (distance < DROP_RADIUS && (!best || distance < best.distance)) best = { ...candidate, distance };
            break;
          }
        }
      }
    });
    if (best) delete best.distance;
    return best;
  }

  // A short line on the edge where the cat would settle.
  function showLanding(target) {
    if (carry) carry.target = target;
    if (!target) { delete landing.dataset.side; return; }
    const edge = edgeOf(target);
    const length = (compactScreen.matches ? .75 : 1) * (target.pose === 'lounge' ? 140 : 96);
    const horizontal = target.side === 'top' || target.side === 'bottom';
    landing.dataset.side = target.side;
    Object.assign(landing.style, horizontal
      ? { width: `${length}px`, height: '3px', transform: `translate3d(${edge.x - length / 2}px, ${edge.y - 1.5}px, 0)` }
      : { width: '3px', height: `${length}px`, transform: `translate3d(${edge.x - 1.5}px, ${edge.y - length / 2}px, 0)` });
  }

  function stopCarrying() {
    if (!carry) return null;
    const done = carry;
    carry = null;
    cancelAnimationFrame(done.frame);
    done.listeners.abort();
    try { slider.releasePointerCapture(done.id); } catch {}
    document.documentElement.classList.remove('scroll-cat-carrying');
    delete landing.dataset.side;
    // The click that may follow this release belongs to the grab.
    window.setTimeout(() => { suppressSliderClick = false; }, 0);
    return done;
  }

  function finishCarry(outcome) {
    const done = stopCarrying();
    if (!done) return;
    const version = activityVersion;
    const glidePlacement = { ...currentPlacement, anchor: 'whitespace:carried', tilt: 0 };
    if (outcome === 'land') {
      // A short drop towards the edge; then the usual pose rises from behind it.
      const edge = edgeOf(done.target);
      slider.style.transition = `left ${DROP_DURATION}ms ease-in, top ${DROP_DURATION}ms ease-in, opacity ${DROP_DURATION}ms ease-in`;
      slider.style.left = `${edge.x - SCRUFF.x * done.width}px`;
      slider.style.top = `${edge.y - SCRUFF.y * done.height}px`;
      slider.style.opacity = '0';
      window.setTimeout(() => {
        slider.style.transition = '';
        slider.style.opacity = '';
        delete root.dataset.carry;
        if (version !== activityVersion || destroyed) return;
        settleOn(resolvePlacement(done.target));
      }, DROP_DURATION);
      return;
    }
    if (outcome === 'release') {
      const x = done.sx + (.5 - SCRUFF.x) * done.width;
      const y = done.sy + (.5 - SCRUFF.y) * done.height;
      const placement = resolvePlacement({ ...glidePlacement, x, y, tilt: x < window.innerWidth / 2 ? -6 : 6 });
      if (!placement) { dropAway(); return; }
      glidePlacement.x = placement.x;
      glidePlacement.y = placement.y;
      glidePlacement.tilt = placement.tilt;
    }
    // Back on the glass: the slide carries on from where the cat was let go, without fading in again.
    root.dataset.reglide = '';
    delete root.dataset.carry;
    parkCat(outcome === 'back' ? { ...currentPlacement } : glidePlacement);
  }

  function settleOn(target) {
    if (!target) { parkCat(null); return; }
    root.dataset.state = 'settling';
    delete root.dataset.reglide;
    parkCat(target);
    companion.style.visibility = '';
    catHidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (destroyed || currentPlacement !== target || root.dataset.state !== 'settling') return;
      root.dataset.state = 'idle';
      updateCatInteraction();
      followAnchor();
    }));
  }

  function dropAway() {
    // Over content there is nothing to hold on to: it drops out of the window and the slide is over.
    root.dataset.falling = '';
    const finish = () => {
      delete root.dataset.falling;
      delete root.dataset.carry;
      glideFinished = true;
      parkCat(null);
    };
    if (reducedMotion.matches) { finish(); return; }
    slider.addEventListener('animationend', finish, { once: true, signal: controller.signal });
  }

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
    if (renderArtwork) glideFinished = false;
    updateCatInteraction();
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
    // Resizing, a hidden tab or an opened menu puts a carried cat down without ceremony.
    stopCarrying();
    delete root.dataset.carry;
    delete root.dataset.falling;
    delete root.dataset.reglide;
    slider.style.transition = '';
    slider.style.opacity = '';
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
    voice.stop();
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
    // A new appearance slides in with its usual fade; only a carried cat continues mid-slide.
    delete root.dataset.reglide;
    parkCat(destination);
    plannedPlacement = null;
    delete root.dataset.destination;
    delete root.dataset.destinationX;
    delete root.dataset.destinationY;
    finishingJourney = false;
    catHidden = false;
    companion.style.visibility = currentPlacement ? '' : 'hidden';
    root.dataset.state = 'idle';
    updateCatInteraction();
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
    updateCatInteraction();
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
    // A carried cat stays in the hand while the page moves under it (or is dropping away).
    if (carry || 'carry' in root.dataset) {
      if (carry) { collectObstacles(); showLanding(findLanding(carry.px, carry.py)); }
      return;
    }
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
    else if (overlayChanged) updateCatInteraction();
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
    voice.destroy();
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
