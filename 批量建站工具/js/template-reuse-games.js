/** Game-specific adaptation. Catalog loading, template layout and ad policy
 * remain separate responsibilities; this module owns game assets and players. */
import { normalizeGameCatalog, safeGameAsset } from './game-catalog-source.js';
import { parseContentJson, normalizePath, relativePath, textEntry, entryText } from './template-reuse-content.js';

export async function gameCatalogContent(catalog) {
    const games = normalizeGameCatalog(catalog.games, catalog.id);
    if (!games.length) throw new Error('所选目录没有可用的游戏。');
    const assets = [];
    for (const [path, image] of Object.entries(catalog.localImages || {})) {
        assets.push({ path: normalizePath(path), bytes: image instanceof Uint8Array ? image : new Uint8Array(await image.arrayBuffer()) });
    }
    const gameFiles = {};
    for (const [path, value] of Object.entries(catalog.localGameFiles || {})) {
        gameFiles[path] = typeof value === 'string' ? value : value && typeof value.arrayBuffer === 'function'
            ? new Uint8Array(await value.arrayBuffer()) : ArrayBuffer.isView(value)
                ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : new Uint8Array(value);
    }
    const items = parseContentJson(games.map(game => ({ ...game, content: game.description || game.title,
        category: game.category || game.genres || 'Games' })));
    items.forEach((item, index) => {
        // Explicit game data survives the prose sanitizer without admitting
        // arbitrary uploaded iframes or scripts into article body HTML.
        item.game = { url: games[index].url };
        item.actionUrl = games[index].url;
        if (!/^https?:/i.test(item.image)) {
            const direct = assets.find(asset => asset.path === item.image);
            const matches = assets.filter(asset => asset.path.split('/').pop() === item.image.split('/').pop());
            if (!direct && matches.length === 1) item.image = matches[0].path;
        }
    });
    return { items, assets, kind: '内置游戏目录', name: catalog.name,
        gameFiles, sourceNotice: catalog.sourceNotice || null,
        categories: catalog.categories || [] };
}

/** Preserve a game's complete directory tree so its relative scripts, images
 * and styles still resolve after export. Never flatten colliding filenames. */
export function planTemplateGames(source, site) {
    const files = new Map(), root = site.metadata.siteRoot || '';
    let directory = root + 'assets/template-reuse-games/';
    // Reimported templates may already contain an older game's asset namespace.
    while (site.entries.some(entry => entry.path.startsWith(directory))) directory = directory.replace(/\/$/, '-new/');
    for (const [path, value] of Object.entries(source.gameFiles || {})) {
        if (!safeGameAsset(path)) throw new Error('本地游戏路径无效：' + path);
        const normalized = normalizePath(path);
        files.set(normalized, typeof value === 'string' ? textEntry(directory + normalized, value) : { path: directory + normalized, bytes: new Uint8Array(value) });
    }
    function url(item, owner) {
        const ref = item.game.url;
        if (/^https?:\/\//i.test(ref)) return ref;
        if (!safeGameAsset(ref)) throw new Error('游戏地址无效：' + ref);
        const path = normalizePath(ref.split(/[?#]/)[0]);
        const candidates = [path, path.replace(/^games\//, ''), 'games/' + path];
        const key = candidates.find(candidate => files.has(candidate));
        if (!key) throw new Error('目录缺少本地游戏文件：' + ref);
        return relativePath(owner, files.get(key).path) + (ref.match(/[?#].*$/)?.[0] || '');
    }
    const entries = [...files.values()];
    // Existing bundled games may include a "Game catalog" link. Point that
    // link at this template's actual homepage after relocating the game files.
    entries.forEach(entry => {
        if (!/\.html?$/i.test(entry.path)) return;
        const doc = new DOMParser().parseFromString(entryText(entry), 'text/html');
        doc.querySelectorAll('a[href]').forEach(link => {
            if (/^(?:游戏目录|game catalog)$/i.test(link.textContent.trim())) link.setAttribute('href', relativePath(entry.path, site.metadata.homePath));
        });
        entry.bytes = textEntry(entry.path, '<!doctype html>\n' + doc.documentElement.outerHTML).bytes;
    });
    if (source.sourceNotice?.licenseText) {
        entries.push(textEntry(directory + 'LICENSE.txt', source.sourceNotice.licenseText));
        entries.push(textEntry(directory + 'SOURCE.txt', ['Game source: ' + (source.sourceNotice.repository || ''), 'Revision: ' + (source.sourceNotice.revision || ''), 'License: ' + (source.sourceNotice.license || '')].join('\n')));
    }
    return { url, entries };
}

/** Reuse an existing native player when present, otherwise add a scoped player
 * inside the template's content area without changing global CSS or ad nodes. */
export function installTemplateGame(doc, item, owner, plan, body) {
    const entry = plan.url(item, owner);
    // Replace a previous template's cover-only stage before adding a player.
    // Otherwise a Poki fallback could retain the old game's cover and link.
    doc.querySelectorAll('.game-stage').forEach(stage => {
        stage.setAttribute('aria-label', 'Play ' + item.title);
        if (!stage.querySelector('iframe')) stage.remove();
        else stage.querySelectorAll('.game-stage-note a').forEach(link => link.setAttribute('href', entry));
    });
    let frame = doc.querySelector('.game-frame-shell iframe,.game-stage iframe,[data-sitefoundry-game-player]');
    if (!frame) {
        frame = doc.createElement('iframe');
        frame.setAttribute('data-sitefoundry-game-player', '');
        body.insertBefore(frame, body.firstChild);
        const style = doc.createElement('style');
        style.setAttribute('data-sitefoundry-game-style', '');
        style.textContent = 'iframe[data-sitefoundry-game-player]{display:block;width:100%;max-width:100%;height:70vh;min-height:320px;max-height:760px;border:0;margin:0 0 24px;background:#10141b}';
        doc.head.appendChild(style);
    }
    frame.setAttribute('src', entry);
    frame.setAttribute('title', item.title);
    frame.setAttribute('allow', 'autoplay; fullscreen; gamepad');
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock');
    // Match the existing game builder's known non-embeddable Poki behavior.
    // The original page remains accessible through the visible action link.
    if (/^https?:\/\/(?:www\.)?poki\.com(?:\/|$)/i.test(entry)) {
        const launch = doc.createElement('a');
        launch.href = entry; launch.target = '_blank'; launch.rel = 'noopener noreferrer';
        launch.textContent = 'Play ' + item.title + ' on Poki ↗';
        frame.replaceWith(launch);
    }
    const action = doc.querySelector('.action-btn');
    if (action) { action.setAttribute('href', entry); action.textContent = 'Play game'; }
}
