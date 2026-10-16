// Colours describe actions and sections. A saved V1 theme must not override them.
document.documentElement.removeAttribute('data-theme');
document.addEventListener('DOMContentLoaded', () => {
  const colours = ['blue', 'lime', 'orange'];
  document.querySelectorAll('[data-brand-mark]').forEach(image => {
    const colour = image.dataset.brandColor || image.closest('[data-accent]')?.dataset.accent || 'blue';
    image.src = `assets/brand/mark-${colours.includes(colour) ? colour : 'blue'}.svg`;
  });
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
});
