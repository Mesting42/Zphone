/**
 * Workbench-only connectivity notice. No external health check, downloads or
 * changes to uploaded content. Resource inspection is text-only: parsing an
 * untrusted HTML document must never execute scripts or request its images.
 */
(function(global, document) {
    'use strict';
    var sources = new Map();
    var notice = document.createElement('section');
    notice.className = 'offline-resource-notice';
    notice.id = 'offline-resource-notice';
    notice.hidden = true;
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.setAttribute('aria-atomic', 'true');
    var heading = document.querySelector('.workflow-command-bar');
    if (heading) heading.insertAdjacentElement('afterend', notice);
    else document.body.prepend(notice);

    function external(value) {
        var raw = String(value || '').trim().replace(/&amp;/g, '&');
        if (!/^(?:https?:)?\/\//i.test(raw)) return false;
        try {
            var url = new URL(raw, location.href);
            return /^https?:$/.test(url.protocol) && url.origin !== location.origin
                && !/^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i.test(url.hostname);
        } catch (error) { return false; }
    }

    function resources(html) {
        var found = new Set();
        var text = String(html || '');
        // Ignore navigational links, canonical/JSON-LD URLs and SVG namespaces.
        var tags = text.match(/<(?:img|script|iframe|source|video|audio|embed|object|link)\b[^>]*>/gi) || [];
        tags.forEach(function(tag) {
            if (/^<link\b/i.test(tag) && !/\brel\s*=\s*["'](?:stylesheet|icon|shortcut icon|preload|modulepreload)["']/i.test(tag)) return;
            for (var match of tag.matchAll(/\b(?:src|href|data|poster|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
                var value = match[1] || match[2] || match[3] || '';
                (value.match(/(?:https?:)?\/\/[^\s,'"<>]+/gi) || []).forEach(function(url) { if (external(url)) found.add(url); });
            }
        });
        for (var css of text.matchAll(/(?:url\(\s*["']?|@import\s*["'])([^\s)'";]+)["']?\s*\)?/gi)) {
            if (external(css[1])) found.add(css[1]);
        }
        return found;
    }

    function render() {
        var dependent = Array.from(sources.values()).some(function(set) { return set.size > 0; });
        var show = navigator.onLine === false && dependent;
        notice.hidden = !show;
        var message = show ? '当前处于离线状态：素材中的远程图片、外部游戏或广告/统计需要联网才能加载。本地导入、配置、建站和导出仍可继续；外链地址会原样保留。' : '';
        // Preview refreshes can be frequent. Announce only a changed status,
        // rather than re-announcing identical text for every configuration edit.
        if (notice.textContent !== message) notice.textContent = message;
    }

    function trackState(state) {
        var found = new Set();
        var mapping = state && state.fieldMapping || {};
        (state && state.data || []).forEach(function(item) {
            ['image', 'link', 'gameUrl', 'iframeUrl'].forEach(function(role) {
                var value = item[mapping[role] || role];
                if (external(value)) found.add(value);
            });
            Object.values(item).forEach(function(value) {
                if (typeof value === 'string' && /<(?:img|iframe|script|video|audio)\b/i.test(value)) resources(value).forEach(function(url) { found.add(url); });
            });
        });
        sources.set('data', found);
        render();
    }

    function scanFrames() {
        var frames = new Set(document.querySelectorAll('iframe'));
        sources.forEach(function(value, key) { if (typeof key !== 'string' && !frames.has(key)) sources.delete(key); });
        frames.forEach(function(frame) { sources.set(frame, resources(frame.getAttribute('srcdoc') || '')); });
        render();
    }

    // The iframe may have an opaque sandbox origin; its srcdoc attribute remains
    // inspectable without weakening sandbox permissions or reading its Window.
    var observer = new MutationObserver(function(records) {
        if (records.some(function(record) {
            return record.type === 'attributes' && record.target.tagName === 'IFRAME'
                || record.type === 'childList' && Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(function(node) {
                    return node.nodeType === 1 && (node.tagName === 'IFRAME' || node.querySelector('iframe'));
                });
        })) scanFrames();
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['srcdoc', 'src'] });
    global.addEventListener('online', render);
    global.addEventListener('offline', render);
    global.addEventListener('pageshow', scanFrames);
    global.OfflineStatus = { resources: resources, trackState: trackState };
    scanFrames();
})(window, document);
