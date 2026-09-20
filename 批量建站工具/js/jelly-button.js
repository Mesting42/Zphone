/*
 * Reusable native implementation of the liquid jelly interaction.
 * It only decorates existing controls and never intercepts click or navigation.
 */
(function () {
    'use strict';

    var FILTER_ID = 'sitefoundry-jelly-goo';

    function installFilter() {
        if (document.getElementById(FILTER_ID)) return;
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.innerHTML = '<defs><filter id="' + FILTER_ID + '" color-interpolation-filters="sRGB">' +
            '<feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />' +
            '<feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -9" result="goo" />' +
            '<feComposite in="SourceGraphic" in2="goo" operator="atop" />' +
            '</filter></defs>';
        document.body.appendChild(svg);
    }

    function setPointerPosition(control, event) {
        var bounds = control.getBoundingClientRect();
        var offsetX = event.clientX - (bounds.left + bounds.width / 2);
        var offsetY = event.clientY - (bounds.top + bounds.height / 2);
        control.style.setProperty('--jelly-blob-x', offsetX + 'px');
        control.style.setProperty('--jelly-blob-y', offsetY + 'px');
        control.style.setProperty('--jelly-body-x', (offsetX * 0.02) + 'px');
        control.style.setProperty('--jelly-body-y', (offsetY * 0.02) + 'px');
        control.style.setProperty('--jelly-label-x', (offsetX * 0.05) + 'px');
        control.style.setProperty('--jelly-label-y', (offsetY * 0.05) + 'px');
    }

    // Dynamic workflow buttons must update this label rather than clearing the
    // decorated control with element.textContent. That preserves the goo layer.
    function setLabel(control, text) {
        if (!control) return;
        var label = control.querySelector('.jelly-explore-label');
        if (label) {
            label.textContent = text;
            return;
        }
        control.textContent = text;
    }

    function enhance(control) {
        if (!control || control.dataset.jellyEnhanced === 'true') return;
        control.dataset.jellyEnhanced = 'true';
        control.classList.add('jelly-explore-button');
        if (control.matches('.btn-next, .btn-prev, .btn-reupload')) control.classList.add('jelly-hover-only');
        if (control.matches('.btn-prev, .btn-reupload')) control.classList.add('jelly-workflow-secondary');
        if (control.matches('.preview-tab, .size-btn, .preview-fullscreen-btn')) {
            control.classList.add('jelly-toolbar-button');
        }

        var label = document.createElement('span');
        label.className = 'jelly-explore-label';
        while (control.firstChild) label.appendChild(control.firstChild);

        var goo = document.createElement('span');
        goo.className = 'jelly-explore-goo';
        goo.setAttribute('aria-hidden', 'true');
        goo.innerHTML = '<span class="jelly-explore-body"></span><span class="jelly-explore-blob"></span>';
        var shadow = document.createElement('span');
        shadow.className = 'jelly-explore-shadow';
        shadow.setAttribute('aria-hidden', 'true');

        control.appendChild(shadow);
        control.appendChild(goo);
        control.appendChild(label);

        control.addEventListener('pointerenter', function (event) {
            if (control.matches(':disabled, [aria-disabled="true"]')) return;
            control.classList.add('is-jelly-active');
            setPointerPosition(control, event);
        });
        control.addEventListener('pointermove', function (event) {
            if (control.matches(':disabled, [aria-disabled="true"]')) return;
            setPointerPosition(control, event);
        });
        control.addEventListener('pointerleave', function () {
            control.classList.remove('is-jelly-active', 'is-jelly-pressed');
            control.style.setProperty('--jelly-blob-x', '0px');
            control.style.setProperty('--jelly-blob-y', '0px');
            control.style.setProperty('--jelly-body-x', '0px');
            control.style.setProperty('--jelly-body-y', '0px');
            control.style.setProperty('--jelly-label-x', '0px');
            control.style.setProperty('--jelly-label-y', '0px');
        });
        control.addEventListener('pointerdown', function () {
            if (!control.matches(':disabled, [aria-disabled="true"]')) control.classList.add('is-jelly-pressed');
        });
        ['pointerup', 'pointercancel'].forEach(function (eventName) {
            control.addEventListener(eventName, function () { control.classList.remove('is-jelly-pressed'); });
        });
    }

    function init() {
        installFilter();
        document.querySelectorAll('.btn-next, .btn-prev, .btn-reupload, .tool-return-link, .preview-tab, .size-btn, .preview-fullscreen-btn').forEach(enhance);
    }

    window.SiteFoundryJellyButton = { setLabel: setLabel };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
