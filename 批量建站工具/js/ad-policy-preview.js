import { normalizePreviewPath, resolvePreviewHtmlEntry } from './ad-injection-preview-router.js';

/** 原站预览适配器。只把资源地址改为本机 Blob，并停用广告请求；导出由策略核心处理。 */
export function createPolicyPreview() {
    let urls = [];
    function dispose() { urls.forEach(url => URL.revokeObjectURL(url)); urls = []; }
    function blob(content, type) {
        const url = URL.createObjectURL(new Blob([content], { type }));
        urls.push(url); return url;
    }
    function text(entry) { return typeof entry.text === 'string' ? entry.text : typeof entry.content === 'string' ? entry.content : new TextDecoder().decode(entry.bytes || new Uint8Array()); }
    function build(entries, entryPath, metadata, options = {}) {
        dispose();
        const byPath = new Map(entries.map(entry => [normalizePreviewPath(entry.path).toLowerCase(), entry]));
        const assetUrls = {};
        const root = metadata.siteRoot || '';
        function resolve(ref, from) {
            if (!ref || /^(?:[a-z]+:|#|\/\/)/i.test(ref)) return '';
            let path = ref.split(/[?#]/)[0];
            try { path = decodeURIComponent(path); } catch (_) { /* 未编码资源名直接按原值查找。 */ }
            const candidate = normalizePreviewPath(path.startsWith('/') ? root + path.slice(1) : from.replace(/[^/]+$/, '') + path).toLowerCase();
            return byPath.has(candidate) ? candidate : '';
        }
        const mime = path => /\.css$/i.test(path) ? 'text/css' : /\.js$/i.test(path) ? 'text/javascript' : /\.json$/i.test(path) ? 'application/json' : /\.svg$/i.test(path) ? 'image/svg+xml' : /\.png$/i.test(path) ? 'image/png' : /\.jpe?g$/i.test(path) ? 'image/jpeg' : /\.webp$/i.test(path) ? 'image/webp' : /\.gif$/i.test(path) ? 'image/gif' : /\.woff2?$/i.test(path) ? 'font/woff2' : 'application/octet-stream';
        // 二进制先创建地址，CSS/JS 后处理依赖，保持动态封面和字体可用。
        byPath.forEach((entry, path) => { if (!/\.(?:html?|css|js)$/i.test(path)) assetUrls[path] = blob(entry.bytes || text(entry), mime(path)); });
        const building = new Set();
        function asset(path) {
            if (assetUrls[path]) return assetUrls[path];
            const entry = byPath.get(path);
            if (!entry || building.has(path)) return '';
            building.add(path);
            let source = text(entry);
            if (/\.css$/i.test(path)) source = css(source, path);
            if (/\.js$/i.test(path)) source = source.replace(/(["'])([^"'\n]+)\1/g, (match, quote, ref) => {
                const resolved = resolve(ref, path);
                return resolved && !/\.html?$/i.test(resolved) ? quote + asset(resolved) + quote : match;
            });
            building.delete(path);
            return assetUrls[path] = blob(source, mime(path));
        }
        function css(source, from) {
            return source.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi, (match, quote, ref) => {
                const path = resolve(ref.trim(), from); return path ? 'url("' + asset(path) + '")' : match;
            }).replace(/@import\s+(["'])([^"']+)\1/gi, (match, quote, ref) => {
                const path = resolve(ref, from); return path ? '@import "' + asset(path) + '"' : match;
            });
        }
        byPath.forEach((entry, path) => { if (/\.(?:css|js)$/i.test(path) && path !== metadata.adPath.toLowerCase()) asset(path); });
        const doc = new DOMParser().parseFromString(text(byPath.get(entryPath.toLowerCase())), 'text/html');
        doc.querySelectorAll('base,meta[http-equiv="refresh"],meta[http-equiv="Content-Security-Policy"]').forEach(node => node.remove());
        doc.querySelectorAll('script').forEach(node => {
            const src = node.getAttribute('src') || '';
            if (/googletag|googletagmanager|google-analytics|(?:^|\/)ad\.js(?:[?#]|$)/i.test(src) || (!src && /googletag\.|gtag\(/.test(node.textContent))) { node.remove(); return; }
            const path = resolve(src, entryPath);
            if (src && path) node.src = asset(path);
            else if (src) node.remove(); // 预览不执行外部追踪脚本。
        });
        doc.querySelectorAll('[src],[href],[poster],[srcset],[style],style').forEach(node => {
            ['src', 'href', 'poster'].forEach(attribute => {
                if (node.tagName === 'A' && attribute === 'href') return;
                const path = resolve(node.getAttribute(attribute), entryPath);
                if (path && !/\.html?$/i.test(path)) node.setAttribute(attribute, asset(path));
            });
            if (node.hasAttribute('srcset')) node.setAttribute('srcset', node.getAttribute('srcset').split(',').map(item => {
                const [ref, ...size] = item.trim().split(/\s+/); const path = resolve(ref, entryPath);
                return (path ? asset(path) : ref) + ' ' + size.join(' ');
            }).join(','));
            if (node.hasAttribute('style')) node.setAttribute('style', css(node.getAttribute('style'), entryPath));
            if (node.tagName === 'STYLE') node.textContent = css(node.textContent, entryPath);
        });
        const style = doc.createElement('style');
        style.textContent = '[id^="div-gpt-ad-banner"]{box-sizing:border-box;min-height:250px;max-width:100%;width:300px;margin:0 auto;display:grid;place-items:center;color:#245c93;background:rgba(224,240,255,.8);border:1px dashed #7ca9dc;font:13px system-ui;} .sf-policy-place{display:block;width:100%;padding:10px;margin:8px 0;border:2px dashed #287de1;color:#1758a5;background:#eff7ff;cursor:pointer;font:13px system-ui;grid-column:1/-1;} .sf-policy-place:focus-visible{outline:3px solid #1749a3;outline-offset:2px;}';
        doc.head.appendChild(style);
        // 同步生成模板 JS 后动态插入的本地图片，导航由父工作台解析原站路由。
        const config = { assetUrls, root, entryPath, token: options.token, placing: options.placing, page: options.page };
        const runtime = doc.createElement('script');
        runtime.textContent = '(' + previewRuntime.toString() + ')(' + JSON.stringify(config).replace(/</g, '\\u003c') + ');';
        doc.head.insertBefore(runtime, doc.head.firstChild);
        return '<!doctype html>' + doc.documentElement.outerHTML;
    }
    return { build, dispose, resolveNavigation: resolvePreviewHtmlEntry };
}

/** 此函数在 iframe 中执行。消息带本次渲染 token，父页还校验消息来源。 */
function previewRuntime(config) {
    function resolve(value) {
        if (!value || /^(?:[a-z]+:|#|\/\/)/i.test(value)) return value;
        let path = value.split(/[?#]/)[0];
        try { path = decodeURIComponent(path); } catch (_) { /* 保留原名称。 */ }
        const parts = (path[0] === '/' ? config.root + path.slice(1) : config.entryPath.replace(/[^/]+$/, '') + path).split('/');
        const clean = []; parts.forEach(part => { if (part === '..') clean.pop(); else if (part && part !== '.') clean.push(part); });
        return config.assetUrls[clean.join('/').toLowerCase()] || value;
    }
    const nativeSet = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) { return nativeSet.call(this, name, /^(src|poster)$/i.test(name) ? resolve(String(value)) : value); };
    const imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, get: imageSrc.get, set(value) { imageSrc.set.call(this, resolve(String(value))); } });
    const nativeFetch = window.fetch;
    window.fetch = function(input, options) { return nativeFetch.call(this, typeof input === 'string' ? resolve(input) : input, options); };
    function hydrate() {
        document.querySelectorAll('img[src]').forEach(node => {
            const original = node.getAttribute('src'), mapped = resolve(original);
            if (mapped !== original) nativeSet.call(node, 'src', mapped);
        });
        document.querySelectorAll('[id^="div-gpt-ad-banner"]').forEach(node => {
            if (!node.textContent) node.textContent = 'banner' + node.id.slice(-1) + ' · 广告预览';
        });
    }
    // 原站可通过 innerHTML 渲染卡片；观察新节点，覆盖属性 setter 无法捕获的图片。
    new MutationObserver(hydrate).observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (!link || link.getAttribute('href').startsWith('#')) return;
        event.preventDefault();
        parent.postMessage({ type: 'ad-policy-nav', token: config.token, href: link.getAttribute('href') }, '*');
    }, true);
    function kids(node) {
        return Array.from(node.children).filter(child => !/^(SCRIPT|STYLE|TEMPLATE|HEADER|NAV|FOOTER|ASIDE)$/.test(child.tagName) && !/^adv[123]$/.test(child.id) && !child.hasAttribute('data-sitefoundry-preview-ad') && !child.hasAttribute('data-sitefoundry-runtime-ad') && !child.hasAttribute('data-sitefoundry-middle-ad') && !/(?:^|\s)related(?:-|\s|$)/i.test(child.className || '') && !child.classList.contains('sf-policy-place'));
    }
    document.addEventListener('DOMContentLoaded', () => {
        hydrate();
        if (config.placing == null) return;
        const main = document.querySelector('main') || document.body;
        function mark(parent, path, depth) {
            const children = kids(parent);
            children.forEach((child, index) => {
                const next = path.concat(index);
                if (depth < 2 && child.children.length && !/^(P|LI|A)$/.test(child.tagName)) mark(child, next, depth + 1);
                const button = document.createElement('button'); button.type = 'button'; button.className = 'sf-policy-place';
                button.textContent = '广告位 ' + (config.placing + 1) + ' 放在这里（' + (child.tagName.toLowerCase()) + ' 之后）';
                button.addEventListener('click', () => parentWindow('custom-after-' + next.join('-')));
                child.after(button);
            });
        }
        function parentWindow(position) { window.parent.postMessage({ type: 'ad-policy-place', token: config.token, page: config.page, position }, '*'); }
        mark(main, [], 0);
    });
}
