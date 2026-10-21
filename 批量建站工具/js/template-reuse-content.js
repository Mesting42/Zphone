/** Content import and asset paths for template reuse. No uploaded code is executed. */
export const entryText = entry => typeof entry?.text === 'string' ? entry.text : new TextDecoder().decode(entry?.bytes || []);
export const textEntry = (path, value) => ({ path, bytes: new TextEncoder().encode(value) });
export const publicPage = path => /(?:^|\/)(?:about(?:-us)?|contact(?:-us)?|privacy(?:-policy)?|terms(?:-of-(?:service|use))?|legal|cookie(?:-policy)?|404|disclaimer|editorial-policy)(?:\.|\/|$)/i.test(path);
export const titleSelector = '[data-content-title],.detail-title,.article-title,.post-title,h1';
export const bodySelector = '[data-content-body],.detail-content,.article-content,.post-content,.article-body,.entry-content';
export const cardSelector = '[data-article],[data-post],.item-card,.post-card,.article-card,.content-card,.story-card,.news-card,.game-card,.related-card';
const cleanText = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function normalizePath(path) {
    const parts = [];
    for (const part of String(path).replace(/\\/g, '/').split('/')) {
        if (part === '..') { if (!parts.length) throw new Error('压缩包路径超出站点目录。'); parts.pop(); }
        else if (part && part !== '.') parts.push(part);
    }
    return parts.join('/');
}

/** Resolve archive-relative references against the file that actually owns them. */
export function resolveLocal(ref, owner, root = '') {
    if (!ref || /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(ref)) return '';
    let path = String(ref).split(/[?#]/)[0];
    try { path = decodeURIComponent(path); } catch { /* Unencoded filenames are valid too. */ }
    return normalizePath(path.startsWith('/') ? root + path.slice(1) : owner.replace(/[^/]*$/, '') + path);
}

export function relativePath(owner, target) {
    const from = normalizePath(owner).split('/'); from.pop();
    const to = normalizePath(target).split('/');
    while (from.length && to.length && from[0] === to[0]) { from.shift(); to.shift(); }
    return [...from.map(() => '..'), ...to].join('/') || './';
}

function stringField(value) {
    if (Array.isArray(value)) return value.map(stringField).filter(Boolean).join(', ');
    if (value && typeof value === 'object') return String(value.name || value.url || '');
    return String(value ?? '');
}

/** Invalid JSON or an empty source is an import error, never a successful zero-row import. */
export function parseContentJson(value, options = {}) {
    let parsed;
    try { parsed = typeof value === 'string' ? JSON.parse(value) : value; }
    catch { throw new Error('JSON 格式无效，请检查文件。'); }
    const rows = Array.isArray(parsed) ? parsed : parsed && (parsed.articles || parsed.data || parsed.items || parsed.posts);
    if (!Array.isArray(rows) || !rows.length) throw new Error('内容源没有可用的文章列表。');
    return rows.map((row, index) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('第 ' + (index + 1) + ' 项不是有效内容对象。');
        const title = cleanText(row.title || row.name || row.headline);
        const body = stringField(row.content || row.body || row.description || row.summary || row.excerpt);
        if (!title || !body.trim()) throw new Error('第 ' + (index + 1) + ' 项缺少标题或正文。');
        return {
            id: String(row.id ?? row.slug ?? index + 1), title, body,
            summary: cleanText(row.summary || row.excerpt || row.standfirst || row.description || body.replace(/<[^>]*>/g, ' ')).slice(0, 800),
            image: stringField(row.cover || row.image || row.thumbnail || row.image_url || row.imageUrl || row.thumb),
            category: stringField(row.category || row.section || row.type || row.genres),
            author: stringField(row.author || row.byline), date: stringField(row.published || row.date || row.updated),
            actionUrl: stringField(row.store_url || row.url), raw: { ...row },
            ownerPath: options.ownerPath || 'content.json', sourcePath: options.sourcePath || ''
        };
    });
}

/** Use detail bodies first; public pages and repeated home/related cards are not articles. */
export function extractStaticSiteContent(entries) {
    const items = [], fallback = [];
    for (const entry of entries) {
        if (!/\.html?$/i.test(entry.path) || publicPage(entry.path)) continue;
        const doc = new DOMParser().parseFromString(entryText(entry), 'text/html');
        const body = doc.querySelector(bodySelector), title = doc.querySelector(titleSelector);
        if (body && title) {
            items.push({ id: entry.path, title: cleanText(title.textContent), body: body.innerHTML,
                summary: cleanText(doc.querySelector('[data-content-summary],.excerpt,.standfirst,.summary,meta[name="description"]')?.getAttribute('content') || body.textContent).slice(0, 800),
                image: doc.querySelector('[data-content-image],.detail-hero-image,.article-hero img,article > img')?.getAttribute('src') || '',
                category: cleanText(doc.querySelector('[data-content-category],.article-category')?.textContent), author: '', date: '',
                actionUrl: doc.querySelector('.action-btn')?.getAttribute('href') || '', raw: {}, ownerPath: entry.path, sourcePath: entry.path });
        } else {
            // Card-only static exports are supported, without swallowing the whole main/nav/footer.
            for (const card of doc.querySelectorAll(cardSelector)) {
                if (card.parentElement?.closest(cardSelector)) continue;
                const heading = card.querySelector('.card-title,.related-name,h2,h3');
                const paragraph = card.querySelector('.card-desc,.excerpt,.summary,p');
                if (!heading || !paragraph) continue;
                fallback.push({ id: entry.path + '#' + fallback.length, title: cleanText(heading.textContent), body: paragraph.innerHTML,
                    summary: cleanText(paragraph.textContent), image: card.querySelector('img')?.getAttribute('src') || '',
                    category: '', author: '', date: '', actionUrl: '', raw: {}, ownerPath: entry.path, sourcePath: '' });
            }
        }
    }
    if (items.length) return items;
    // Known local-data exports have empty home grids, so import their local content JSON.
    const data = entries.find(entry => /(?:^|\/)data\.json$/i.test(entry.path));
    if (data) { try { return parseContentJson(entryText(data), { ownerPath: data.path }); } catch { /* Try visible cards before reporting no content. */ } }
    if (!fallback.length) throw new Error('未识别到静态文章正文；请提供包含标题和正文的 HTML 或 JSON/图片 ZIP。');
    return fallback;
}

/** Preserve asset subdirectories to avoid two cover.webp files overwriting each other. */
export function createAssetMapper(sourceEntries, siteRoot) {
    const entries = new Map(sourceEntries.map(entry => [normalizePath(entry.path).toLowerCase(), entry]));
    const copied = new Map();
    function image(ref, owner, outputPath) {
        if (!ref) return '';
        if (/^(?:https?:\/\/|data:image\/)/i.test(ref)) return ref;
        if (/^\/\//.test(ref)) return ref;
        const path = resolveLocal(ref, owner);
        let entry = entries.get(path.toLowerCase());
        // Static ZIPs commonly wrap a site in one folder while HTML uses /assets.
        // A unique suffix is safe; ambiguous same-named assets remain an error.
        if (!entry && String(ref).startsWith('/')) {
            const candidates = [...entries.values()].filter(candidate => candidate.path.toLowerCase().endsWith('/' + path.toLowerCase()));
            if (candidates.length === 1) entry = candidates[0];
        }
        if (!entry || !/\.(?:avif|gif|jfif|jpe?g|png|svg|webp)$/i.test(entry.path)) throw new Error('内容图片不存在：' + ref + '（来源 ' + owner + '）。');
        const target = siteRoot + 'assets/template-reuse/' + normalizePath(entry.path);
        copied.set(target, { path: target, bytes: new Uint8Array(entry.bytes || new TextEncoder().encode(entryText(entry))) });
        return relativePath(outputPath, target);
    }
    return { image, entries: () => [...copied.values()] };
}

/** Keep prose semantics, removing the source site's CSS/layout and executable widgets. */
export function renderBody(item, outputPath, assets, routes = new Map()) {
    const html = /<[a-z][\s\S]*>/i.test(item.body) ? item.body : String(item.body).split(/\n\s*\n/).map(block => {
        const heading = block.match(/^(#{1,6})\s+([^\n]+)$/);
        return heading ? `<h${heading[1].length}>${escape(heading[2])}</h${heading[1].length}>` : '<p>' + escape(block).replace(/\n/g, '<br>') + '</p>';
    }).join('');
    const doc = new DOMParser().parseFromString('<!doctype html><html><body>' + html + '</body></html>', 'text/html');
    doc.querySelectorAll('script,style,link,meta,iframe,object,embed,form,nav,header,footer,aside').forEach(node => node.remove());
    doc.querySelectorAll('*').forEach(node => {
        for (const attr of Array.from(node.attributes)) if (/^(?:on|style$|class$|id$)/i.test(attr.name)) node.removeAttribute(attr.name);
        if (node.tagName === 'IMG') {
            node.setAttribute('src', assets.image(node.getAttribute('src'), item.ownerPath, outputPath));
            node.removeAttribute('srcset');
        }
        if (node.tagName === 'A') {
            const href = node.getAttribute('href') || '';
            if (/^(?:https?:|mailto:|tel:|#)/i.test(href)) return;
            const target = routes.get(resolveLocal(href, item.ownerPath).toLowerCase());
            if (target) node.setAttribute('href', relativePath(outputPath, target));
            else node.removeAttribute('href');
        }
    });
    return doc.body.innerHTML;
}
