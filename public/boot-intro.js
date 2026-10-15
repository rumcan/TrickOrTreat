// Start the film before the SDK/React bundle finishes. The video element survives
// React mounting so its playback never jumps back to the beginning.
(() => {
  const overlay = document.getElementById('loading-overlay');
  const film = document.getElementById('boot-film');
  if (!overlay || !film) return;
  const events = new AbortController();
  const listen = (target, name, callback) => target.addEventListener(name, callback, { signal: events.signal });
  let startTimeout, stallTimeout, totalTimeout;
  const clearTimers = () => [startTimeout, stallTimeout, totalTimeout].forEach(clearTimeout);
  const hold = () => {
    if (overlay.dataset.phase === 'holding') return;
    clearTimers();
    film.pause();
    overlay.dataset.phase = 'holding';
    overlay.dataset.heldAt = String(performance.now());
    window.dispatchEvent(new Event('tot:intro-held'));
  };
  const skip = () => { overlay.dataset.skipped = 'true'; hold(); };
  listen(overlay, 'click', event => { if (event.target.closest('[data-skip-intro]')) skip(); });
  listen(overlay, 'tot:skip-intro', skip);
  listen(document, 'keydown', event => {
    if (!overlay.isConnected || overlay.dataset.phase !== 'playing') return;
    if (['Escape', ' ', 'Enter'].includes(event.key)) { event.preventDefault(); skip(); }
  });
  listen(overlay, 'tot:boot-dismiss', () => {
    clearTimers(); events.abort(); film.pause(); film.removeAttribute('src'); film.load();
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches || navigator.connection?.saveData) {
    overlay.dataset.skipped = 'true';
    overlay.dataset.heldAt = String(performance.now());
    return;
  }
  overlay.dataset.phase = 'playing';
  listen(reduced, 'change', event => { if (event.matches) skip(); });
  listen(film, 'ended', hold);
  listen(film, 'error', hold);
  listen(film, 'playing', () => { clearTimeout(startTimeout); clearTimeout(stallTimeout); });
  listen(film, 'waiting', () => { clearTimeout(stallTimeout); stallTimeout = setTimeout(hold, 6000); });
  // A slow/missing movie never blocks entry to the game indefinitely.
  startTimeout = setTimeout(hold, 6000);
  totalTimeout = setTimeout(hold, 20000);
  film.muted = true;
  film.src = film.dataset.src;
  film.play().catch(hold);
})();
