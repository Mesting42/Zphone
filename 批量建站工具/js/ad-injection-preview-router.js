export function normalizePreviewPath(value) {
    var parts = String(value || '').replace(/\\/g, '/').split('/');
    var normalized = [];
    parts.forEach(function(part) {
        if (!part || part === '.') return;
        if (part === '..') normalized.pop();
        else normalized.push(part);
    });
    return normalized.join('/');
}

function previewRootPath(value) {
    var root = normalizePreviewPath(value);
    return root ? root + '/' : '';
}

export function resolvePreviewHtmlEntry(entries, href, fromPath, rootPath) {
    var raw = String(href || '').trim();
    if (!raw || raw.charAt(0) === '#' || /^(?:mailto|tel|javascript|data):/i.test(raw)) return null;

    var root = previewRootPath(rootPath);
    var current = normalizePreviewPath(fromPath);
    var currentRelative = root && current.toLowerCase().indexOf(root.toLowerCase()) === 0
        ? current.slice(root.length)
        : current.replace(/^.*\//, '');
    var pathname = '';
    try {
        pathname = decodeURIComponent(new URL(raw, 'https://sitefoundry-preview.invalid/' + currentRelative).pathname);
    } catch (error) {
        return null;
    }

    var route = normalizePreviewPath(pathname.replace(/^\/+/, ''));
    var candidates = route
        ? /\.html?$/i.test(route)
            ? [root + route]
            : [root + route + '/index.html', root + route + '/index.htm', root + route + '.html', root + route + '.htm']
        : [root + 'index.html', root + 'index.htm'];
    var byPath = {};
    (entries || []).forEach(function(entry) {
        if (/\.html?$/i.test(entry && entry.path || '')) byPath[normalizePreviewPath(entry.path).toLowerCase()] = entry;
    });
    for (var index = 0; index < candidates.length; index += 1) {
        var match = byPath[normalizePreviewPath(candidates[index]).toLowerCase()];
        if (match) return match;
    }
    return null;
}

export function previewPageTypeForEntry(entryPath, rootPath) {
    var path = normalizePreviewPath(entryPath);
    var root = previewRootPath(rootPath);
    var route = root && path.toLowerCase().indexOf(root.toLowerCase()) === 0 ? path.slice(root.length) : path;
    route = route.replace(/(?:^|\/)index\.html?$/i, '').replace(/\.html?$/i, '').replace(/^\/+|\/+$/g, '');
    if (!route) return 'home';
    if (/^(?:about|contact|privacy|terms)$/i.test(route)) return route.toLowerCase();
    return 'detail';
}
