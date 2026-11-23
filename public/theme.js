// Colours describe actions and sections. A saved V1 theme must not override them.
document.documentElement.removeAttribute('data-theme');
// Brand marks resolve next to this script, so nested pages (projects/<id>/, video/<id>/) work too.
const brandBase = new URL('assets/brand/', document.currentScript?.src || location.href);
document.addEventListener('DOMContentLoaded', () => {
  const colours = ['blue', 'lime', 'orange'];
  document.querySelectorAll('[data-brand-mark]').forEach(image => {
    const colour = image.dataset.brandColor || image.closest('[data-accent]')?.dataset.accent || 'blue';
    image.src = new URL(`mark-${colours.includes(colour) ? colour : 'blue'}.svg`, brandBase).href;
  });
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
});
