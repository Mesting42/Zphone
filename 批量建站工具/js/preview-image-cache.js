/**
 * Reuse preview URLs by Blob identity. A new upload or site switch retires the
 * previous images after the iframe's existing 1.4-second refresh recovery window.
 * Filename matching remains owned by the generators, including its precedence.
 */
(function(global) {
    'use strict';
    var active = new Map();
    var retired = new Set();

    function revoke(record) {
        record.urls.forEach(function(url) { global.URL.revokeObjectURL(url); });
        retired.delete(record);
    }

    function acquire(images) {
        var next = new Map();
        var result = {};
        var created = [];
        try { Object.keys(images || {}).forEach(function(path) {
            var blob = images[path];
            var url = next.get(blob) || active.get(blob);
            if (!url) { url = global.URL.createObjectURL(blob); created.push(url); }
            next.set(blob, url);
            var filename = path.split('/').pop().split('\\').pop();
            result[filename] = url;
        }); } catch (error) {
            created.forEach(function(url) { global.URL.revokeObjectURL(url); });
            throw error;
        }
        var unused = [];
        active.forEach(function(url, blob) { if (!next.has(blob)) unused.push(url); });
        if (unused.length) {
            var record = { urls: unused, timer: null };
            retired.add(record);
            record.timer = global.setTimeout(function() { revoke(record); }, 1500);
        }
        active = next;
        return { byFilename: result, urls: Array.from(next.values()) };
    }

    function clear() {
        active.forEach(function(url) { global.URL.revokeObjectURL(url); });
        active.clear();
        Array.from(retired).forEach(function(record) {
            global.clearTimeout(record.timer);
            revoke(record);
        });
    }

    // A persisted page must keep its URLs for back/forward restoration.
    if (typeof global.addEventListener === 'function') {
        global.addEventListener('pagehide', function(event) { if (!event.persisted) clear(); });
    }
    global.PreviewImageCache = { acquire: acquire, clear: clear };
})(typeof globalThis === 'object' ? globalThis : this);
