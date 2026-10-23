import { createHeroScene } from './hero-scene.js';

// Decorative motion is optional: the complete page remains readable without JS.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const revealItems = [...document.querySelectorAll('[data-reveal]')];
const revealObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.remove('reveal-pending');
    revealObserver.unobserve(entry.target);
  }
}, { threshold: 0.12 });
if (!reducedMotion.matches) {
  for (const item of revealItems) {
    if (item.getBoundingClientRect().top < window.innerHeight) continue;
    item.classList.add('reveal-pending');
    revealObserver.observe(item);
  }
}

const hero = document.querySelector('.hero');
const heroScene = createHeroScene(document.querySelector('[data-hero-scene]'), { hero });
const heroMotionToggle = document.querySelector('[data-hero-motion-toggle]');
let heroMotionUserPaused = false;
let heroVisible = true;
function syncHeroMotion() {
  hero.classList.toggle('motion-paused', heroMotionUserPaused || reducedMotion.matches);
  heroScene?.setPaused(heroMotionUserPaused || reducedMotion.matches || !heroVisible || document.hidden);
  if (!heroMotionToggle) return;
  const label = heroMotionUserPaused ? 'Продолжить анимацию' : 'Приостановить анимацию';
  heroMotionToggle.hidden = reducedMotion.matches || !heroScene;
  heroMotionToggle.setAttribute('aria-pressed', String(heroMotionUserPaused));
  heroMotionToggle.setAttribute('aria-label', label);
  heroMotionToggle.title = label;
}
heroMotionToggle?.addEventListener('click', () => {
  heroMotionUserPaused = !heroMotionUserPaused;
  syncHeroMotion();
});
syncHeroMotion();
new IntersectionObserver(entries => {
  heroVisible = entries[0].isIntersecting;
  hero.classList.toggle('ambient-paused', !heroVisible || document.hidden);
  syncHeroMotion();
}).observe(hero);

const preview = document.querySelector('#motion-preview');
const toggle = document.querySelector('.motion-toggle');
let previewVisible = false;
let userPaused = false;
let userRequestedPlay = false;
function reflectPlayback() {
  const playing = !preview.paused;
  toggle.setAttribute('aria-pressed', String(playing));
  toggle.setAttribute('aria-label', playing ? 'Приостановить превью' : 'Воспроизвести превью');
}
async function syncPlayback() {
  if (previewVisible && !document.hidden && !userPaused && (!reducedMotion.matches || userRequestedPlay)) {
    try { await preview.play(); } catch { /* The poster remains usable when autoplay is blocked. */ }
  } else preview.pause();
  reflectPlayback();
}
new IntersectionObserver(entries => {
  previewVisible = entries[0].isIntersecting;
  syncPlayback();
}, { threshold: 0.2 }).observe(preview);
toggle.addEventListener('click', () => {
  userPaused = !preview.paused;
  userRequestedPlay = !userPaused;
  syncPlayback();
});
preview.addEventListener('play', reflectPlayback);
preview.addEventListener('pause', reflectPlayback);
document.addEventListener('visibilitychange', () => {
  hero.classList.toggle('ambient-paused', !heroVisible || document.hidden);
  syncHeroMotion();
  syncPlayback();
});
reducedMotion.addEventListener('change', () => {
  syncHeroMotion();
  if (reducedMotion.matches) {
    revealObserver.disconnect();
    revealItems.forEach(item => item.classList.remove('reveal-pending'));
    userRequestedPlay = false;
  }
  syncPlayback();
});
