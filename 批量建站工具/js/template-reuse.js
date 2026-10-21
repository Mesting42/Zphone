/** Static template reuse: plan routes, local data, related cards and images together.
 * Both preview and export consume this pure transformation; uploaded JS is never executed here. */
import { entryText, textEntry, publicPage, titleSelector, bodySelector,
    resolveLocal, relativePath, createAssetMapper, renderBody } from './template-reuse-content.js';
import { planTemplateGames, installTemplateGame } from './template-reuse-games.js';
import { retainCategoryAllocation, templateListingCards, setTemplateText } from './template-reuse-layout.js';
export { parseContentJson, extractStaticSiteContent } from './template-reuse-content.js';
const htmlFile = path => /\.html?$/i.test(path);
const parse = entry => new DOMParser().parseFromString(entryText(entry), 'text/html');
const serialize = doc => '<!doctype html>\n' + doc.documentElement.outerHTML;
const first = (root, selectors) => selectors.split(',').map(selector => root.querySelector(selector)).find(Boolean);
const setText = setTemplateText;
const originalId = path => path.match(/(?:^|\/)article([^/]+)\.html?$/i)?.[1];

/** Recognize the builder's local JSON renderer through its complete known shape. */
function localRenderer(entries, metadata) {
    for (const entry of entries) {
        if (!/\.js$/i.test(entry.path) || entry.path === metadata.adPath) continue;
        const source = entryText(entry);
        if (!/function\s+createCard\(/.test(source) || !/CONFIG\.dataFile/.test(source) || !/details\/article/.test(source)) continue;
        const dataFile = source.match(/\bdataFile\s*:\s*['"]([^'"]+)['"]/)?.[1];
        const mapping = source.match(/\bfieldMapping\s*:\s*(\{[^{}]*\})/)?.[1];
        const categories = source.match(/\bcategories\s*:\s*(\[[^\]]*\])/)?.[1];
        const dataPath = dataFile && resolveLocal(dataFile, metadata.homePath, metadata.siteRoot);
        const data = entries.find(item => item.path === dataPath);
        if (!data || !categories) continue;
        try {
            const rows = JSON.parse(entryText(data));
            if (Array.isArray(rows) && rows.length) return { path: entry.path, source, dataPath, rows,
                mapping: mapping ? JSON.parse(mapping) : {}, categories: JSON.parse(categories), categoriesLiteral: categories,
                imageField: source.match(/\bimageField\s*:\s*['"]([^'"]+)['"]/)?.[1] || 'image' };
        } catch { /* Unrelated configs are never executed or guessed. */ }
    }
    return null;
}

/** Upload checks must reject unknown markup before claiming successful reuse. */
export function inspectTemplate(site) {
    const entries = site.entries || [], metadata = site.metadata || {};
    const byPath = new Map(entries.map(entry => [entry.path, entry]));
    const details = (metadata.detailPaths || []).filter(path => !publicPage(path));
    if (!details.length) throw new Error('模板没有可复用的内容详情页。');
    const unsupported = details.filter(path => { const doc = parse(byPath.get(path)); return !first(doc, bodySelector) || !first(doc, titleSelector); });
    if (unsupported.length) throw new Error('无法识别正文容器，不支持直接复用：' + unsupported.slice(0, 3).join('、'));
    const runtime = localRenderer(entries, metadata), home = byPath.get(metadata.homePath);
    if (!home) throw new Error('模板首页不存在。');
    if (!runtime && !templateListingCards(parse(home), metadata.homePath, metadata).length) throw new Error('首页由未识别的脚本渲染，不支持直接复用；请提供可识别的静态成品包。');
    return { details, renderer: runtime };
}

function planRoutes(site, items, inspection) {
    const available = [...inspection.details].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    if (inspection.renderer) available.sort((a, b) => {
        const index = path => inspection.renderer.rows.findIndex((row, i) => String(row.id ?? row._index ?? i + 1) === originalId(path));
        return index(a) - index(b);
    });
    const used = new Set(available);
    return items.map((item, index) => {
        let path = available[index];
        if (!path) { let serial = index + 1; do { path = site.metadata.siteRoot + 'details/articleSF' + serial++ + '.html'; } while (used.has(path)); used.add(path); }
        return { item, path, id: originalId(path) || 'SF' + (index + 1), templatePath: available[index] || available[0] };
    });
}

function setImage(node, item, outputPath, assets) {
    if (!node) return;
    node.removeAttribute('srcset');
    if (!item.image) { node.removeAttribute('src'); node.hidden = true; return; }
    node.removeAttribute('hidden'); node.setAttribute('src', assets.image(item.image, item.ownerPath, outputPath)); node.setAttribute('alt', item.title);
}
const cardLink = card => card.matches('a[href]') ? card : card.querySelector('a[href]');
function fillCard(card, route, outputPath, assets) {
    const item = route.item;
    setText(first(card, '[data-content-title],.card-title,.related-name,.post-title,[class*="title"],[class*="name"],h2,h3,h4'), item.title);
    setText(first(card, '[data-content-summary],.card-desc,.related-excerpt,.excerpt,.summary,.description,p'), item.summary);
    setText(card.querySelector('.related-genres,.card-genres,[data-content-category],.category,.tag'), item.category);
    setImage(card.querySelector('img'), item, outputPath, assets);
    const link = cardLink(card); if (link) link.setAttribute('href', relativePath(outputPath, route.path));
}

function fillDetail(entry, route, routes, assets, sourceRoutes, host, siteRoot, games) {
    const doc = parse(entry), item = route.item, title = first(doc, titleSelector), oldTitle = title.textContent;
    const body = first(doc, bodySelector);
    // Preserve advertisements embedded in prose, including their paragraph gap.
    const adSelector = '[id^="adv"],[id^="div-gpt-ad-banner"],[data-sitefoundry-ad]';
    const ads = [...body.querySelectorAll(adSelector)].filter(node => !node.parentElement?.closest(adSelector))
        .map(node => ({ node: node.cloneNode(true), index: [...body.children].indexOf(node) }));
    body.innerHTML = renderBody(item, route.path, assets, sourceRoutes);
    ads.forEach(({ node, index }) => body.insertBefore(node, body.children[Math.max(0, index)] || null));
    setText(title, item.title);
    setImage(first(doc, '[data-content-image],.detail-hero-image,.article-hero img'), item, route.path, assets);
    for (const [selector, value] of [['[data-content-summary],.standfirst,.article-summary', item.summary], ['[data-content-author],.byline,.article-author', item.author], ['[data-content-date],time,.article-date', item.date], ['[data-content-category],.article-category', item.category]]) setText(doc.querySelector(selector), value);
    const action = doc.querySelector('.action-btn');
    if (action && !item.game) { if (/^https?:\/\//i.test(item.actionUrl)) action.setAttribute('href', item.actionUrl); else action.remove(); }
    if (item.game) installTemplateGame(doc, item, route.path, games, body);
    else doc.querySelectorAll('.game-frame-shell,.game-stage,[data-sitefoundry-game-player],style[data-sitefoundry-game-style]').forEach(node => node.remove());
    if (doc.title) doc.title = doc.title.includes(oldTitle) ? doc.title.replace(oldTitle, item.title) : item.title;
    doc.querySelectorAll('meta[name="description"],meta[property="og:description"]').forEach(node => node.setAttribute('content', item.summary));
    doc.querySelectorAll('meta[property="og:title"],meta[name="twitter:title"]').forEach(node => node.setAttribute('content', item.title));
    doc.querySelectorAll('meta[name="keywords"]').forEach(node => node.setAttribute('content', [item.title, item.category].filter(Boolean).join(', ')));
    const pageUrl = host ? 'https://' + host + '/' + route.path.slice(siteRoot.length) : '';
    if (pageUrl) {
        doc.querySelectorAll('link[rel="canonical"]').forEach(node => node.setAttribute('href', pageUrl));
        doc.querySelectorAll('meta[property="og:url"]').forEach(node => node.setAttribute('content', pageUrl));
    }
    // Values such as author/platform/price belong to the article, not the shell.
    doc.querySelectorAll('.meta-item').forEach(node => {
        const label = node.querySelector('.meta-label')?.textContent.trim().replace(/:$/, '').toLowerCase();
        const value = item.raw[label] ?? ({ author: item.author, date: item.date, category: item.category })[label];
        setText(node.querySelector('.meta-value'), Array.isArray(value) ? value.join(', ') : value || '');
    });
    doc.querySelectorAll('script[type="application/ld+json"]').forEach(node => {
        try {
            const update = value => {
                if (!value || typeof value !== 'object') return;
                if (/Article|Posting/i.test(String(value['@type']))) {
                    value.headline = item.title; value.description = item.summary; delete value.articleBody;
                    delete value.image; delete value.author; delete value.datePublished; delete value.dateModified;
                    if (pageUrl) { value.url = pageUrl; value.mainEntityOfPage = pageUrl; }
                }
                if (item.game && /Article|Posting|VideoGame/i.test(String(value['@type']))) {
                    value['@type'] = 'VideoGame'; value.name = item.title; value.description = item.summary;
                    delete value.headline; delete value.articleBody; delete value.author;
                }
                Object.values(value).forEach(child => { if (Array.isArray(child)) child.forEach(update); else if (child && typeof child === 'object') update(child); });
            };
            const value = JSON.parse(node.textContent); update(value); node.textContent = JSON.stringify(value).replace(/</g, '\\u003c');
        } catch { node.remove(); }
    });
    const others = routes.filter(item => item.path !== route.path);
    [...doc.querySelectorAll('.related-card')].forEach((card, index) => { if (index < others.length) fillCard(card, others[index], route.path, assets); else card.remove(); });
    return textEntry(route.path, serialize(doc));
}

function fillListing(entry, routes, metadata, assets) {
    const doc = parse(entry), byPath = new Map(routes.map(route => [route.path.toLowerCase(), route]));
    const cards = templateListingCards(doc, entry.path, metadata);
    const models = new Map(); let cursor = 0;
    cards.forEach(card => {
        const parent = card.parentElement; if (!models.has(parent)) models.set(parent, card.cloneNode(true));
        const path = resolveLocal(cardLink(card)?.getAttribute('href'), entry.path, metadata.siteRoot);
        const route = path ? byPath.get(path.toLowerCase()) : routes[cursor++];
        if (route) fillCard(card, route, entry.path, assets); else card.remove();
    });
    if (routes.length > cards.length && models.size) {
        const [parent, model] = [...models.entries()].at(-1);
        // Insert before the original trailing ad/decoration, never append after
        // it. All preceding section/card boundaries remain where they were.
        const last = cards.filter(card => card.parentElement === parent).at(-1);
        const boundary = last?.nextSibling || null;
        routes.slice(cards.length).forEach(route => { const card = model.cloneNode(true); fillCard(card, route, entry.path, assets); parent.insertBefore(card, boundary); });
    }
    return textEntry(entry.path, serialize(doc));
}

function rendererData(renderer, routes, metadata, assets, games) {
    return routes.map(route => {
        const item = route.item, row = { ...item.raw, id: route.id, _index: route.id };
        const actionUrl = item.game ? games.url(item, metadata.homePath) : item.actionUrl;
        const fields = { title: item.title, content: item.summary, excerpt: item.summary, image: item.image, category: item.category, author: item.author, date: item.date, store_url: actionUrl };
        if (item.game) {
            // Catalogs retain entry-file aliases for downstream export checks.
            // They must point at the relocated game just like the rendered URL.
            row.url = actionUrl;
            for (const key of ['gameUrl', 'game_url', 'embedUrl', 'embed_url', 'local_entry', 'game_file', 'gameFile']) if (key in row) row[key] = actionUrl;
        }
        for (const [key, value] of Object.entries(fields)) row[renderer.mapping[key] || key] = key === 'image' ? assets.image(value, item.ownerPath, metadata.homePath) : value;
        const imagePath = assets.image(item.image, item.ownerPath, metadata.homePath);
        row[renderer.imageField] = imagePath;
        // Keep aliases coherent too: preflight and downstream consumers may read
        // image/cover even when this template renders thumb.
        for (const key of ['cover', 'image', 'thumbnail', 'image_url', 'imageUrl', 'thumb', 'coverFile', 'coverUrl', 'thumbnailUrl']) if (key in row) row[key] = imagePath;
        // The original card renderer uses innerHTML. Escape display fields while
        // retaining the template renderer and its layout unchanged.
        Object.keys(row).forEach(key => { if (typeof row[key] === 'string') row[key] = row[key].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); });
        return row;
    });
}

/** Colour-only tokens: no width, font, spacing, border radius or layout changes. */
export function applyThemePalette(entries, palette, options = {}) {
    if (!palette) return { entries, applied: false, warnings: [] };
    const declarations = Object.entries(palette.vars || palette).filter(([key, value]) => /^--(?:color-[\w-]+|navbar-bg)$/.test(key) && !/[;{}<>]/.test(String(value))).map(([key, value]) => key + ':' + value).join(';');
    if (!declarations) throw new Error('主题配色没有有效的颜色变量。');
    const id = String(options.id || palette.id || 'palette').replace(/[^\w-]/g, '');
    const css = ':root{' + declarations + '}body{background-color:var(--color-bg);color:var(--color-text)}.item-card,.post-card,.article-card{background-color:var(--color-card-bg);border-color:var(--color-border)}.navbar{background-color:var(--navbar-bg)}';
    const output = entries.map(entry => {
        if (!htmlFile(entry.path)) return entry;
        const doc = parse(entry); doc.querySelectorAll('style[data-sitefoundry-template-theme]').forEach(node => node.remove());
        const style = doc.createElement('style'); style.setAttribute('data-sitefoundry-template-theme', id); style.textContent = css; doc.head.appendChild(style);
        return textEntry(entry.path, serialize(doc));
    });
    return { entries: output, applied: true, warnings: [] };
}

/** Return a full site copy; template entries and metadata are never mutated. */
export function reuseTemplateSite(site, source, options = {}) {
    const items = source.contentItems || source.items || [];
    if (!items.length) throw new Error('请先选择有效的新内容。');
    const inspection = inspectTemplate(site), routes = planRoutes(site, items, inspection);
    const byPath = new Map(site.entries.map(entry => [entry.path, entry]));
    const assets = createAssetMapper(source.assets || [], site.metadata.siteRoot);
    const games = items.some(item => item.game) ? planTemplateGames(source, site) : null;
    const sourceRoutes = new Map(routes.filter(route => route.item.sourcePath).map(route => [route.item.sourcePath.toLowerCase(), route.path]));
    const oldDetails = new Set(inspection.details);
    const output = site.entries.filter(entry => !oldDetails.has(entry.path)).map(entry => ({ ...entry, bytes: entry.bytes ? new Uint8Array(entry.bytes) : undefined }));
    for (const route of routes) output.push(fillDetail(byPath.get(route.templatePath), route, routes, assets, sourceRoutes, options.host || site.metadata.detectedHost, site.metadata.siteRoot, games));
    const renderer = inspection.renderer;
    if (renderer) {
        output[output.findIndex(entry => entry.path === renderer.dataPath)] = textEntry(renderer.dataPath, JSON.stringify(rendererData(renderer, routes, site.metadata, assets, games), null, 2));
        {
            const categories = retainCategoryAllocation(renderer.categories, items.length);
            output[output.findIndex(entry => entry.path === renderer.path)] = textEntry(renderer.path, renderer.source.replace(renderer.categoriesLiteral, JSON.stringify(categories)));
        }
    }
    for (let index = 0; index < output.length; index++) {
        const entry = output[index];
        if (!htmlFile(entry.path) || publicPage(entry.path) || routes.some(route => route.path === entry.path)) continue;
        if (templateListingCards(parse(entry), entry.path, site.metadata).length) output[index] = fillListing(entry, routes, site.metadata, assets);
    }
    output.push(...assets.entries());
    if (games) output.push(...games.entries);
    const host = options.host || site.metadata.detectedHost;
    const sitemapIndex = output.findIndex(entry => entry.path === site.metadata.siteRoot + 'sitemap.xml');
    if (sitemapIndex >= 0 && host) {
        const pages = output.filter(entry => htmlFile(entry.path) && entry.path.startsWith(site.metadata.siteRoot) && !games?.entries.some(game => game.path === entry.path));
        output[sitemapIndex] = textEntry(output[sitemapIndex].path, '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + pages.map(entry => '<url><loc>https://' + host + '/' + entry.path.slice(site.metadata.siteRoot.length) + '</loc></url>').join('') + '</urlset>');
    }
    const palette = applyThemePalette(output, source.palette, { id: source.paletteId });
    const report = { schema: 'sitefoundry-template-reuse/v2', sourceItems: items.length, detailPages: routes.length,
        removedOldPages: inspection.details.filter(path => !routes.some(route => route.path === path)).length,
        createdPages: routes.filter(route => !oldDetails.has(route.path)).length, copiedAssets: assets.entries().length,
        localDataUpdated: !!renderer, paletteApplied: palette.applied, gameFiles: games ? games.entries.filter(entry => /\.html?$/i.test(entry.path)).length : 0,
        siteType: games ? 'games' : 'editorial', warnings: [], routes: routes.map(route => ({ path: route.path, title: route.item.title })) };
    return { ...site, preserveTemplateLayout: true, entries: palette.entries, metadata: { ...site.metadata, detailPaths: routes.map(route => route.path) }, templateReuseReport: report };
}
