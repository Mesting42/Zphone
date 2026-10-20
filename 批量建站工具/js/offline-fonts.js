/**
 * Font packaging shared by previews and all generators. Preview URLs point to
 * this workbench; exported CSS/fonts/licenses are relative to the exported site.
 * Uploaded websites retain ownership of their own font/resource references.
 */
(function(global) {
    'use strict';
    var script = document.currentScript;
    var fontRoot = new URL('../fonts/', script.src).href;
    var catalog = global.OfflineFontCatalog;
    var cache = new Map();

    function familyNames(html, config) {
        var declarations = (String(html).match(/(?:font-family|--ref-(?:body|display))\s*:[^;}]+/gi) || []).join(';');
        if (config && config.typography) declarations += ';' + config.typography.body + ';' + config.typography.display;
        var selected = config && config.style && catalog.presets[config.style.fontStyle] || [];
        return Object.keys(catalog.families).filter(function(name) {
            // Family names must be complete CSS tokens, never a substring such
            // as Inter inside another family. Escape catalog names defensively.
            var escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return selected.indexOf(name) !== -1 || new RegExp('(?:^|[\\s:,;\'\"])' + escaped + '(?=[\\s,;\'\"]|$)', 'i').test(declarations);
        });
    }

    function documentHTML(html, config, preview) {
        html = html.replace(/<link\b[^>]*data-sitefoundry-font[^>]*>/gi, '');
        var names = familyNames(html, config);
        if (config) config.offlineFontFamilies = Array.from(new Set((config.offlineFontFamilies || []).concat(names)));
        // Preserve depth for both classic css/ pages and differentiated assets/.
        var stylesheet = html.match(/href=["']((?:\.\.\/)*)(?:css\/|assets\/site\.css)/i);
        var base = preview ? fontRoot : (stylesheet ? stylesheet[1] : '') + 'fonts/';
        var links = names.map(function(name) {
            return '<link rel="stylesheet" data-sitefoundry-font href="' + base + catalog.families[name].css + '">';
        }).join('\n');
        html = html.replace(/<link\b[^>]*href=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/gi, '');
        return html.replace('</head>', links + '\n</head>');
    }

    function read(path) {
        if (!cache.has(path)) {
            cache.set(path, fetch(new URL(path, fontRoot).href).then(function(response) {
                if (!response.ok) throw new Error('本地字体资源缺失：' + path + '（HTTP ' + response.status + '）');
                return response.arrayBuffer();
            }).catch(function(error) { cache.delete(path); throw error; }));
        }
        return cache.get(path);
    }

    async function exportAssets(folder, config) {
        var names = config.offlineFontFamilies || familyNames('', config);
        for (var name of names) {
            var family = catalog.families[name];
            var paths = [family.css, family.license].concat(family.files.map(function(file) { return file.path; }));
            // Bounded per-family copying avoids large concurrent allocations on
            // mobile devices; rejected reads are retriable on the next export.
            for (var path of paths) folder.file('fonts/' + path, await read(path));
        }
    }

    /** Local-only asset provider for source exporters. Keep fetching/caching
     * here; source transforms must not know workbench URLs or contact a CDN. */
    async function familyAssets(name) {
        var family = catalog.families[name];
        if (!family) throw new Error('本地字体库尚未包含：' + name);
        var paths = [family.css, family.license].concat(family.files.map(function(file) { return file.path; }));
        var assets = [];
        for (var path of paths) assets.push({ path: path, bytes: new Uint8Array(await read(path)) });
        return { family: name, css: new TextDecoder().decode(assets[0].bytes), files: assets, license: family.license };
    }
    global.OfflineFonts = { documentHTML: documentHTML, exportAssets: exportAssets, familyNames: familyNames, familyAssets: familyAssets };
})(globalThis);
