// Behaviour for the prerendered video pages (video/<id>/index.html, scripts/build-seo.mjs).
const status = document.querySelector('#video-status');
const field = document.querySelector('[data-share-field]');
const pageUrl = document.querySelector('link[rel="canonical"]')?.href || location.href;
let hideStatus;
function say(text) {
  status.textContent = text;
  status.hidden = false;
  clearTimeout(hideStatus);
  hideStatus = setTimeout(() => { status.hidden = true; }, 4000);
}
document.querySelector('[data-share-link]')?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(pageUrl);
    say('Ссылка на видеоработу скопирована');
  } catch {
    field.value = pageUrl;
    field.hidden = false;
    field.focus();
    field.select();
    say('Ссылка выделена — скопируйте её.');
  }
});
const player = document.querySelector('.video-stage video');
const error = document.querySelector('[data-video-error]');
player?.addEventListener('error', () => { error.hidden = false; }, true);
player?.querySelector('source')?.addEventListener('error', () => { error.hidden = false; });
