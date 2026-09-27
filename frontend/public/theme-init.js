// Applies the saved theme before first paint to avoid a light/dark flash. Loaded as an
// external blocking script (not inline) so a strict Content-Security-Policy can be used.
(function () {
  var theme = 'system';
  try {
    theme = localStorage.getItem('qrcare-theme') || 'system';
  } catch {
    // Storage unavailable: fall back to the system preference.
  }
  var dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
})();
