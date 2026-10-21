/** Shared game catalog reader for game building and advertised-template reuse.
 * Only bundled catalog scripts are loaded here. Uploaded template code is never
 * evaluated, and large game bundles are loaded only when their source is chosen. */
const scriptLoads = new Map();
// Resolve at runtime: treating a directory as a Vite file asset drops its
// trailing slash and would request catalogs from /js instead of /game-builder/js.
const base = new URL('../game-builder/', new URL('.', import.meta.url));

function loadScript(path) {
    const url = new URL(path, base).href;
    if (!scriptLoads.has(url)) scriptLoads.set(url, new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = () => { scriptLoads.delete(url); script.remove(); reject(new Error('游戏目录组件加载失败，请重试。')); };
        document.head.appendChild(script);
    }));
    return scriptLoads.get(url);
}

const first = (row, keys) => keys.map(key => row[key]).find(value => value != null && String(value).trim()) ?? '';
export const safeGameAsset = value => {
    const path = String(value || '').trim().replace(/\\/g, '/');
    return !!path && !/^(?:\/|[a-z][\w+.-]*:)/i.test(path) && !path.split('/').includes('..');
};

/** This is the existing game workflow's normalization contract, shared rather
 * than approximated by the article importer (which discards game entry files). */
export function normalizeGameCatalog(payload, sourceId) {
    const rows = Array.isArray(payload) ? payload : payload && (['games', 'data', 'items', 'results'].map(key => payload[key]).find(Array.isArray) || Object.values(payload).find(Array.isArray)) || [];
    const seen = new Set();
    const local = /^(?:opensource-local|json-zip|differentiated-zip|saved-local|builtin-source-\d+)$/.test(sourceId);
    return rows.map((row, index) => {
        if (!row || typeof row !== 'object') return null;
        const game = { ...row,
            id: first(row, ['id', 'gameId', 'game_id', 'slug']) || sourceId + '-' + (index + 1),
            title: String(first(row, ['title', 'name', 'gameTitle'])).trim(),
            description: String(first(row, ['description', 'desc_en', 'content', 'summary', 'excerpt'])).trim(),
            url: String(first(row, ['url', 'gameUrl', 'game_url', 'embedUrl', 'embed_url', 'store_url', 'local_entry', 'game_file'])).trim(),
            thumb: String(first(row, ['thumb', 'thumbnailUrl', 'thumbnail', 'image', 'imageUrl', 'cover', 'coverUrl'])).trim(),
            thumbFallback: '', source: sourceId };
        if (!game.title || !(/^https?:\/\//i.test(game.url) || local && safeGameAsset(game.url))
            || !(/^https?:\/\//i.test(game.thumb) || (local || sourceId === 'json-archive') && safeGameAsset(game.thumb)) || seen.has(game.url.toLowerCase())) return null;
        seen.add(game.url.toLowerCase());
        return game;
    }).filter(Boolean);
}

/** Blob and data-URL images share a single byte representation downstream. */
export function gameImageBlob(dataUrl) {
    const [header, body] = String(dataUrl).split(',');
    if (!/^data:image\//i.test(header) || !body) throw new Error('游戏封面数据无效。');
    const binary = /;base64$/i.test(header) ? atob(body) : decodeURIComponent(body);
    return new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], { type: header.slice(5).split(';')[0] });
}

export function openSourceGameCatalog(bundle) {
    if (!bundle?.games?.length) throw new Error('开源游戏包未正确加载。');
    const localImages = {}, localImageDataUrls = {}, localGameFiles = {};
    const games = bundle.games.map(game => {
        localImages[game.coverFile] = gameImageBlob(game.coverData);
        localImageDataUrls[game.coverFile] = game.coverData;
        localGameFiles[game.gameFile] = game.gameHtml;
        const { coverData, gameHtml, ...row } = game;
        return row;
    });
    return { id: 'opensource-local', name: '开源本地 · 首批', games, localImages, localImageDataUrls,
        localGameFiles, categories: bundle.categoryPreset, sourceNotice: bundle.source };
}

/** SavedGameCatalogs is the same classic-script IndexedDB store used by the
 * game workbench. Both pages therefore see the user's existing saved catalogs. */
async function savedStore() {
    if (typeof SavedGameCatalogs === 'undefined') await loadScript('js/saved-game-catalogs.js');
    return SavedGameCatalogs;
}

export async function listGameCatalogs() {
    if (!globalThis.BUILTIN_GAME_SOURCES) await loadScript('js/built-in-game-sources.js');
    const choices = [{ id: 'builtin', name: '当前内置目录' }, ...globalThis.BUILTIN_GAME_SOURCES.map(source => ({ id: 'builtin-' + source.id, name: source.name + ' · ' + source.gameCount + ' 款' })),
        { id: 'opensource', name: '开源本地游戏 · 首批' }];
    const store = await savedStore();
    // Lack of IndexedDB does not prevent bundled catalogs from being selected.
    if (store.isAvailable()) choices.push(...(await store.list()).map(record => ({ id: 'saved:' + record.id, name: '本地内置 · ' + record.name + '（' + record.gameCount + ' 款）' })));
    return choices;
}

export async function loadGameCatalog(value) {
    if (value === 'builtin') {
        if (!globalThis.BUILTIN_GAME_DATA) await loadScript('js/games-data.js');
        return { id: 'builtin', name: '当前内置目录', games: normalizeGameCatalog(globalThis.BUILTIN_GAME_DATA, 'builtin') };
    }
    if (value === 'opensource') {
        if (!globalThis.OPEN_SOURCE_GAME_BUNDLE) await loadScript('js/open-source-games-bundle.js');
        return openSourceGameCatalog(globalThis.OPEN_SOURCE_GAME_BUNDLE);
    }
    if (String(value).startsWith('saved:')) {
        const record = await (await savedStore()).get(value.slice(6));
        if (!record?.data?.length) throw new Error('找不到该本地内置目录，请重新选择。');
        return { ...record, id: 'saved-local', catalogName: record.name, name: '本地内置 · ' + record.name,
            games: normalizeGameCatalog(record.data, 'saved-local') };
    }
    if (!globalThis.BUILTIN_GAME_SOURCES) await loadScript('js/built-in-game-sources.js');
    const source = globalThis.BUILTIN_GAME_SOURCES.find(source => 'builtin-' + source.id === value);
    if (!source) throw new Error('游戏目录不存在，请重新选择。');
    if (typeof GameZipImport === 'undefined') await loadScript('js/game-zip-import.js');
    const response = await fetch(new URL(source.archive, base), { cache: 'force-cache' });
    if (!response.ok) throw new Error('游戏目录请求失败（HTTP ' + response.status + '）。');
    const archive = await GameZipImport.importArchive(new File([await response.blob()], source.archive.split('/').pop()), rows => normalizeGameCatalog(rows, value));
    const localImages = Object.fromEntries(Object.entries(archive.localImageDataUrls).map(([path, url]) => [path, gameImageBlob(url)]));
    return { id: value, name: source.name, games: normalizeGameCatalog(archive.payload, value), localImages, localImageDataUrls: archive.localImageDataUrls };
}
