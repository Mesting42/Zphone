/** Standalone browser controller. No builder globals are captured: exported sites
 * receive this function verbatim, including failure recovery and teardown. */
export function startViewportReveal() {
  var reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var mobile = window.matchMedia ? window.matchMedia('(max-width: 760px)') : null;
  var observer, frame = 0, generation = 0, stopped = false;
  var records = new Map();
  var cards = '.item-card,.related-card';
  var selector = cards + ',.hero-title,.hero-subtitle,.category-title,.section-title,.tpl-heading,.all-articles-title,.detail-title,.detail-hero-image,.detail-content > p,.detail-content > h2,.detail-content > h3,.detail-content > ul,.detail-content > ol,.detail-content > blockquote,.detail-content > figure,.detail-content > table,.page-content > h1,.page-content > h2,.page-content > h3,.page-content > p,.page-content > ul,.page-content > ol,.contact-form,.pagination,.back-link,.footer-links,.footer-copyright';
  // Never move, hide or filter an ad/game, or an ancestor which contains one.
  var protectedSelector = '[id^="div-gpt-ad"],.ad-container,.ad-region,.ad-placeholder,.insert-marker,ins.adsbygoogle,iframe,canvas,.game-player';
  function safe(element) {
    return !element.closest(protectedSelector) && !element.querySelector(protectedSelector);
  }
  function clear() {
    generation++;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (observer) observer.disconnect();
    records.forEach(function(record, element) {
      record.animations.forEach(function(animation) { animation.cancel(); });
      element.classList.remove('sf-reveal', 'sf-reveal-content', 'sf-reveal-visible');
    });
    records.clear();
  }
  function show(element) {
    var record = records.get(element);
    if (!record || record.visible) return;
    record.visible = true;
    element.classList.add('sf-reveal-visible');
    try { record.animations.forEach(function(animation) { animation.play(); }); }
    catch (error) { clear(); }
  }
  function reset(element) {
    var record = records.get(element);
    if (!record) return;
    record.visible = false;
    element.classList.remove('sf-reveal-visible');
    try { record.animations.forEach(function(animation) { animation.pause(); animation.currentTime = 0; }); }
    catch (error) { clear(); }
  }
  function rebuild() {
    clear();
    if (stopped || reduced && reduced.matches || !window.matchMedia || !window.IntersectionObserver || !Element.prototype.animate) return;
    var groups = new Map();
    try {
      // Reveal only the outermost eligible content unit, avoiding double opacity.
      var targets = Array.from(document.querySelectorAll(selector)).filter(safe);
      targets = targets.filter(function(element) {
        return !targets.some(function(parent) { return parent !== element && parent.contains(element); });
      });
      // Capture the reserved regions before any animated transforms are applied.
      // Check geometry rather than DOM adjacency: several grid cards can share
      // the row directly above one full-width advertisement.
      var reserved = Array.from(document.querySelectorAll(protectedSelector + ',[data-sitefoundry-middle-ad]')).map(function(element) {
        return element.getBoundingClientRect();
      }).filter(function(bounds) { return bounds.width > 0 && bounds.height > 0; });
      targets.forEach(function(element) {
        var card = element.matches(cards);
        var index = groups.get(element.parentElement) || 0;
        if (card) groups.set(element.parentElement, index + 1);
        var narrow = mobile.matches;
        var delay = card ? Math.min(index, 4) * 42 : 0;
        element.classList.add('sf-reveal');
        if (!card) element.classList.add('sf-reveal-content');
        // Independent transforms leave CSS hover transform and its lift intact.
        var direction = index % 2 ? 1 : -1;
        var bounds = element.getBoundingClientRect();
        var nearReserved = reserved.some(function(region) {
          return region.top >= bounds.bottom - 1 && region.top - bounds.bottom < 40 && region.left < bounds.right + 24 && region.right > bounds.left - 24;
        });
        var room = direction > 0 ? window.innerWidth - bounds.right : bounds.left;
        // Full-width layouts and tablets may have less than 24px gutter. Limit
        // sideways travel to actual available space instead of hiding overflow.
        var x = narrow || !card || nearReserved ? 0 : direction * Math.min(24, Math.max(0, room - 8));
        // Boundary cards retain the fade while avoiding motion/blur into ads.
        var from = { translate: x + 'px ' + (nearReserved ? 0 : card ? 28 : 14) + 'px', rotate: 'x ' + (nearReserved ? 0 : card ? 1.4 : 0.7) + 'deg', scale: nearReserved ? '1' : card ? '0.988' : '0.996' };
        var to = { translate: '0px 0px', rotate: 'x 0deg', scale: '1' };
        if (!narrow && !nearReserved) { from.filter = 'blur(3px)'; to.filter = 'none'; }
        var animations = [];
        // Record each created animation immediately; a partial failure must also cancel it.
        var record = { animations: animations, visible: false };
        records.set(element, record);
        animations.push(element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 480, delay: delay, fill: 'both' }));
        animations.push(element.animate([from, to], { duration: 900, delay: delay, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' }));
        animations.forEach(function(animation) { animation.pause(); animation.currentTime = 0; });
      });
      observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          // Long blocks cannot reach 12% visibility; use a reachable proportion.
          var threshold = Math.min(0.12, (window.innerHeight * 0.12) / Math.max(1, entry.boundingClientRect.height));
          if (entry.isIntersecting && (entry.intersectionRatio >= threshold || entry.boundingClientRect.height > window.innerHeight)) show(entry.target);
          else if (!entry.isIntersecting) reset(entry.target);
        });
      }, { threshold: [0, 0.01, 0.12] });
      var token = generation;
      frame = requestAnimationFrame(function() {
        frame = requestAnimationFrame(function() {
          frame = 0;
          if (token !== generation || stopped) return;
          records.forEach(function(record, element) {
            observer.observe(element);
            if (element.contains(document.activeElement)) show(element);
          });
        });
      });
    } catch (error) { clear(); }
  }
  function focus(event) {
    records.forEach(function(record, element) { if (element === event.target || element.contains(event.target)) show(element); });
  }
  function pageshow(event) { if (event.persisted) rebuild(); }
  function media(query, add) {
    if (!query) return;
    if (query.addEventListener) query[add ? 'addEventListener' : 'removeEventListener']('change', rebuild);
    else if (query.addListener) query[add ? 'addListener' : 'removeListener'](rebuild);
  }
  media(reduced, true); media(mobile, true);
  window.addEventListener('pageshow', pageshow);
  document.addEventListener('focusin', focus);
  rebuild();
  return { refresh: rebuild, destroy: function() {
    stopped = true; clear(); media(reduced, false); media(mobile, false);
    window.removeEventListener('pageshow', pageshow); document.removeEventListener('focusin', focus);
  } };
}
