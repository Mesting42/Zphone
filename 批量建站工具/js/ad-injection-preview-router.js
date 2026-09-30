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

function normalizePreviewHost(value) {
    return String(value || '').trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

/**
 * Only route links that can be proven to belong to the uploaded site.
 * Relative and root-relative paths are always local. Absolute URLs must match
 * one of the hosts detected from the uploaded site or its paired ad code.
 */
export function isPreviewInternalHref(href, allowedHosts) {
    var raw = String(href || '').trim();
    if (!raw || raw.charAt(0) === '#' || /^(?:mailto|tel|javascript|data|blob):/i.test(raw)) return false;
    if (!/^(?:https?:)?\/\//i.test(raw)) return true;

    var hosts = (allowedHosts || []).map(normalizePreviewHost).filter(Boolean);
    if (!hosts.length) return false;
    try {
        var target = new URL(raw, 'https://sitefoundry-preview.invalid/');
        if (!/^https?:$/i.test(target.protocol)) return false;
        return hosts.indexOf(normalizePreviewHost(target.hostname)) !== -1;
    } catch (error) {
        return false;
    }
}

export function resolvePreviewHtmlEntry(entries, href, fromPath, rootPath, allowedHosts) {
    var raw = String(href || '').trim();
    if (!isPreviewInternalHref(raw, allowedHosts)) return null;

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

/**
 * 判断文件是否属于可在“详情页”标签中直接预览的内容详情页。
 * 这里要求内容目录后仍有一个具体条目，避免把 /games/、/blog/ 等列表页
 * 当成详情页；规则集中在路由模块中，便于后续扩展新的内容领域。
 */
export function isPreviewDetailEntry(entryPath, rootPath) {
    var path = normalizePreviewPath(entryPath);
    var root = previewRootPath(rootPath);
    var route = root && path.toLowerCase().indexOf(root.toLowerCase()) === 0 ? path.slice(root.length) : path;
    return /^(?:details?|articles?|news|posts?|stories?|guides?|blog|tools|games?)\/[^/]+\/index\.html?$/i.test(route)
        || /^(?:detail|article|post|story|news)[^/]*\.html?$/i.test(route);
}
