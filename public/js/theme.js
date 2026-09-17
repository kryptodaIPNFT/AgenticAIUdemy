/* ============================================================
   Video Portal — global light / dark mode toggle (Phase 1)
   - Flips data-theme on <html>
   - Persists choice in localStorage ('vp-theme')
   - Falls back to the OS color-scheme until the user chooses
   The initial theme is applied pre-paint by an inline script in
   index.html; this file only wires up the toggle behavior.
   ============================================================ */
(function initThemeToggle() {
  'use strict';

  const STORAGE_KEY = 'vp-theme';
  const root = document.documentElement;
  const button = document.getElementById('themeToggle');
  if (!button) return;

  const currentTheme = () => root.getAttribute('data-theme') || 'light';

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    );
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* storage unavailable (e.g. private mode) — toggle still works this session */
    }
  }

  button.setAttribute('aria-pressed', String(currentTheme() === 'dark'));

  button.addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });

  /* Keep in sync with OS preference until the user makes an explicit choice. */
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) {
          root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      } catch (err) {
        /* ignore */
      }
    });
  }
})();

(function applyCustomLogo() {
  'use strict';
  function setLogo(url, mime) {
    document.querySelectorAll('.brand img, .brand-logo').forEach((img) => {
      img.src = url;
    });
    document.querySelectorAll('link[rel="icon"]').forEach((link) => {
      link.href = url;
      if (mime) link.type = mime;
    });
  }
  fetch('/api/logo', { credentials: 'include' })
    .then((res) => res.json())
    .then((body) => {
      if (body && body.url) setLogo(body.url, body.mime);
    })
    .catch(() => {});
})();

console.log('naeed — Phase 1 (theme toggle) loaded.');