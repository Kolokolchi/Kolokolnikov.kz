(() => {
  const allowed = ['blue', 'lime', 'orange'];
  let value = 'blue';
  try { const saved = localStorage.getItem('kk-theme'); if (allowed.includes(saved)) value = saved; } catch {}
  document.documentElement.dataset.theme = value;
  window.setBrandTheme = (theme) => {
    if (!allowed.includes(theme)) return;
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('kk-theme', theme); } catch {}
    document.querySelectorAll('[data-brand-mark]').forEach(image => image.src = `assets/brand/mark-${theme}.svg`);
    document.querySelectorAll('[data-set-theme]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.setTheme === theme)));
  };
  document.addEventListener('DOMContentLoaded', () => {
    window.setBrandTheme(value);
    document.querySelectorAll('[data-set-theme]').forEach(button => button.addEventListener('click', () => window.setBrandTheme(button.dataset.setTheme)));
    document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
  });
})();
