/* Pointer-positioned highlights provide a lightweight liquid response without redrawing page content. */
(function () {
    'use strict';

    var surfaceSelector = [
        '.step-progress', '.step-panel', '.build-mode-selector', '.build-mode-card', '.upload-area',
        '.step-nav', '.data-overview', '.config-panel', '.preview-panel', '.config-group', '.theme-card',
        '.detection-card', '.template-card', '.style-card', '.ad-injection-setup', '.legacy-site-upload',
        '.injection-file-card', '.restoration-file-card', '.ad-policy-page-card', '.diff-blueprint-card'
    ].join(', ');
    var interactiveSelector = '.build-mode-card, .theme-card, .detection-card, .template-card, .style-card, .injection-file-card, .restoration-file-card, .ad-policy-page-card, .diff-blueprint-card';

    function enhance(surface) {
        if (surface.dataset.liquidGlassReady === 'true') return;
        surface.dataset.liquidGlassReady = 'true';
        surface.classList.add('liquid-glass-surface');
        if (surface.matches(interactiveSelector)) surface.classList.add('liquid-glass-interactive');

        var queued = false;
        var lastEvent;
        function updateHighlight() {
            queued = false;
            var rect = surface.getBoundingClientRect();
            if (!rect.width || !rect.height || !lastEvent) return;
            surface.style.setProperty('--liquid-x', (((lastEvent.clientX - rect.left) / rect.width) * 100).toFixed(1) + '%');
            surface.style.setProperty('--liquid-y', (((lastEvent.clientY - rect.top) / rect.height) * 100).toFixed(1) + '%');
        }
        surface.addEventListener('pointermove', function (event) {
            lastEvent = event;
            if (!queued) {
                queued = true;
                window.requestAnimationFrame(updateHighlight);
            }
        }, { passive: true });
        surface.addEventListener('pointerleave', function () {
            surface.style.removeProperty('--liquid-x');
            surface.style.removeProperty('--liquid-y');
        }, { passive: true });
        if (surface.classList.contains('liquid-glass-interactive')) {
            surface.addEventListener('pointerdown', function () { surface.classList.add('is-liquid-pressed'); }, { passive: true });
            ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (eventName) {
                surface.addEventListener(eventName, function () { surface.classList.remove('is-liquid-pressed'); }, { passive: true });
            });
        }
    }

    function init() { document.querySelectorAll(surfaceSelector).forEach(enhance); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
}());
