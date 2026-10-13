/** Pointer code owns only four temporary coordinates. CSS owns all visuals. */
export function startCardPointer(cards) {
  var fine = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;
  var reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var cleanups = [], disposed = false;
  function rebuild() {
    cleanups.forEach(function(cleanup) { cleanup(); }); cleanups = [];
    if (disposed || !fine || !fine.matches || reduced && reduced.matches) return;
    cards.forEach(function(card) {
      var frame = 0, point;
      function reset() {
        if (frame) cancelAnimationFrame(frame);
        frame = 0; point = null;
        ['--sf-tilt-x','--sf-tilt-y','--sf-glow-x','--sf-glow-y'].forEach(function(name) { card.style.removeProperty(name); });
      }
      function move(event) {
        if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
        point = { x: event.clientX, y: event.clientY };
        if (frame) return;
        frame = requestAnimationFrame(function() {
          frame = 0;
          if (!point) return;
          // Read geometry once per frame, before writing any variables.
          var bounds = card.getBoundingClientRect();
          if (!bounds.width || !bounds.height) return;
          var x = Math.max(0, Math.min(1, (point.x - bounds.left) / bounds.width));
          var y = Math.max(0, Math.min(1, (point.y - bounds.top) / bounds.height));
          card.style.setProperty('--sf-tilt-x', ((.5 - y) * 4).toFixed(2) + 'deg');
          card.style.setProperty('--sf-tilt-y', ((x - .5) * 5).toFixed(2) + 'deg');
          card.style.setProperty('--sf-glow-x', (x * 100).toFixed(1) + '%');
          card.style.setProperty('--sf-glow-y', (y * 100).toFixed(1) + '%');
        });
      }
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerleave', reset); card.addEventListener('pointercancel', reset);
      cleanups.push(function() { reset(); card.removeEventListener('pointermove', move); card.removeEventListener('pointerleave', reset); card.removeEventListener('pointercancel', reset); });
    });
  }
  function listen(query, add) {
    if (!query) return;
    if (query.addEventListener) query[add ? 'addEventListener' : 'removeEventListener']('change', rebuild);
    else if (query.addListener) query[add ? 'addListener' : 'removeListener'](rebuild);
  }
  listen(fine, true); listen(reduced, true); rebuild();
  return { refresh: rebuild, destroy: function() { disposed = true; rebuild(); listen(fine, false); listen(reduced, false); } };
}
