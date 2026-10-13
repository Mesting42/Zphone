/** Adds decorative spans to existing anchors, never new links or layout wrappers.
 * Pagination inserts new cards; only child changes are observed, never pointer styles. */
export function bootSiteMotion(glyph, startReveal, startPointer) {
  var node = document.querySelector('[data-site-motion-settings]');
  if (!node) return;
  var settings;
  try { settings = JSON.parse(node.textContent); } catch (error) { return; }
  if (window.SiteMotionController) window.SiteMotionController.destroy();
  var reveal, pointer, mutation, frame = 0, disposed = false;
  var protectedSelector = '[id^="div-gpt-ad"],.ad-container,.ad-region,.ad-placeholder,.insert-marker,iframe,canvas,.game-player';
  function decorate() {
    var cards = Array.from(document.querySelectorAll('.item-card,.related-card')).filter(function(card) {
      return !card.closest(protectedSelector) && !card.querySelector(protectedSelector);
    });
    cards.forEach(function(card) {
      if (card.hasAttribute('data-sf-card')) return;
      card.setAttribute('data-sf-card', '');
      // Record article media before adding the decorative icon image.
      var hasImage = !!card.querySelector('img');
      if (settings.hover) {
        card.classList.add('sf-card-interactive');
        var glow = document.createElement('span'); glow.className = 'sf-card-glow'; glow.setAttribute('aria-hidden','true'); card.appendChild(glow);
      }
      if (settings.icon && glyph) {
        var icon = document.createElement('span'); icon.className = 'sf-card-orb'; icon.setAttribute('aria-hidden','true');
        var image = document.createElement('img');
        image.src = glyph.src; image.alt = ''; image.width = 24; image.height = 24;
        image.setAttribute('data-domain-icon',glyph.id); image.setAttribute('aria-hidden','true');
        icon.appendChild(image);
        // Prefer the existing media frame: wide/list cards then keep their icon
        // on the picture instead of covering the article title. Direct <img>
        // game cards retain their DOM and use the card corner with reserved text.
        var media = card.querySelector('.card-image-frame');
        (media || card).appendChild(icon);
        if (!media) card.classList.add('sf-card-corner-icon');
      }
      if (settings.arrow) {
        var arrow = document.createElement('span'); arrow.className = 'sf-card-arrow'; arrow.setAttribute('aria-hidden','true'); arrow.textContent = '↗'; card.appendChild(arrow);
      }
      if (!hasImage) card.classList.add('sf-card-no-image');
    });
    return cards;
  }
  function update() {
    if (disposed) return;
    var cards = decorate();
    if (settings.hover) {
      if (pointer) pointer.destroy();
      pointer = startPointer(cards);
    }
    if (settings.reveal) { if (reveal) reveal.refresh(); else reveal = startReveal(); }
  }
  update();
  if (window.MutationObserver) {
    mutation = new MutationObserver(function(changes) {
      var relevant = changes.some(function(change) {
        return !change.target.closest(protectedSelector + ',[data-sf-card]') && Array.from(change.addedNodes).some(function(added) {
          return added.nodeType === 1 && !added.matches(protectedSelector) && (added.matches('.item-card,.related-card') || added.querySelector('.item-card,.related-card'));
        });
      });
      if (!relevant || frame) return;
      frame = requestAnimationFrame(function() { frame = 0; update(); });
    });
    mutation.observe(document.body, { childList: true, subtree: true });
  }
  window.SiteMotionController = { refresh: update, destroy: function() {
    disposed = true; if (frame) cancelAnimationFrame(frame);
    if (mutation) mutation.disconnect(); if (pointer) pointer.destroy(); if (reveal) reveal.destroy();
  } };
}
