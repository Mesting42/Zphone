import { normalizePreviewPath, resolvePreviewHtmlEntry } from './ad-injection-preview-router.js';
import { rewritePreviewCss } from './preview-css.js';
import { previewResourceUrl, previewResourceMime } from './preview-resource-url.js';

/** 原站预览适配器。资源副本可在隔离 iframe 中读取；导出由策略核心处理。 */
export function createPolicyPreview() {
    // 自包含地址随 srcdoc 释放，无浏览器 Blob 注册表需要清理；保留调用方生命周期接口。
    function dispose() {}
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
        const mime = previewResourceMime;
        // 二进制先创建地址，CSS/JS 后处理依赖，保持动态封面和字体可用。
        byPath.forEach((entry, path) => { if (!/\.(?:html?|css|m?js|cjs)$/i.test(path)) assetUrls[path] = previewResourceUrl(entry.bytes || text(entry), mime(path)); });
        const building = new Set();
        function asset(path) {
            if (assetUrls[path]) return assetUrls[path];
            const entry = byPath.get(path);
            if (!entry || building.has(path)) return '';
            building.add(path);
            let source = text(entry);
            // Local games live inside nested sandboxed iframes. Give their HTML
            // the same self-contained dependencies as the parent preview; raw
            // archive paths cannot be fetched from an opaque srcdoc origin.
            if (/\.html?$/i.test(path)) {
                const child = new DOMParser().parseFromString(source, 'text/html');
                child.querySelectorAll('base,meta[http-equiv="Content-Security-Policy"]').forEach(node => node.remove());
                child.querySelectorAll('[src],[href],[poster],[style],style').forEach(node => {
                    for (const attribute of ['src', 'href', 'poster']) {
                        if (node.tagName === 'A' && attribute === 'href') continue;
                        const dependency = resolve(node.getAttribute(attribute), path);
                        if (dependency && dependency !== path) node.setAttribute(attribute, asset(dependency));
                    }
                    if (node.hasAttribute('style')) node.setAttribute('style', css(node.getAttribute('style'), path));
                    if (node.tagName === 'STYLE') node.textContent = css(node.textContent, path);
                });
                const storage = child.createElement('script');
                storage.textContent = '(' + installPreviewStorage.toString() + ')();';
                child.head.insertBefore(storage, child.head.firstChild);
                source = '<!doctype html>' + child.documentElement.outerHTML;
            }
            if (/\.css$/i.test(path)) source = css(source, path);
            if (/\.(?:m?js|cjs)$/i.test(path)) source = source.replace(/(["'])([^"'\n]+)\1/g, (match, quote, ref) => {
                const resolved = resolve(ref, path);
                return resolved && !/\.html?$/i.test(resolved) ? quote + asset(resolved) + quote : match;
            });
            building.delete(path);
            return assetUrls[path] = previewResourceUrl(source, mime(path));
        }
        function css(source, from) {
            return rewritePreviewCss(source, from, (reference, ownerPath) => {
                const path = resolve(reference, ownerPath);
                return path ? asset(path) : '';
            });
        }
        byPath.forEach((entry, path) => { if (/\.(?:css|m?js|cjs)$/i.test(path) && path !== String(metadata.adPath || '').toLowerCase()) asset(path); });
        let html = text(byPath.get(entryPath.toLowerCase()));
        if (options.placing != null && options.placeMarkers) html = options.placeMarkers(html);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        // 重新放置时只隐藏正在调整的容器；源站与已保存策略不受影响，取消后会重新显示。
        if (options.placing != null && /^banner[123]$/.test(options.selectedUnit || '')) {
            const selected = doc.getElementById('adv' + options.selectedUnit.slice(-1));
            if (selected) selected.remove();
        }
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
                if (path && (!/\.html?$/i.test(path) || node.tagName === 'IFRAME' && attribute === 'src')) node.setAttribute(attribute, asset(path));
            });
            if (node.hasAttribute('srcset')) node.setAttribute('srcset', node.getAttribute('srcset').split(',').map(item => {
                const [ref, ...size] = item.trim().split(/\s+/); const path = resolve(ref, entryPath);
                return (path ? asset(path) : ref) + ' ' + size.join(' ');
            }).join(','));
            if (node.hasAttribute('style')) node.setAttribute('style', css(node.getAttribute('style'), entryPath));
            if (node.tagName === 'STYLE') node.textContent = css(node.textContent, entryPath);
        });
        const style = doc.createElement('style');
        style.textContent = '[id^="div-gpt-ad-banner"]{display:grid;place-items:center;color:#245c93;background:rgba(224,240,255,.8);outline:1px dashed #7ca9dc;font:13px system-ui;} .sf-policy-place{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;min-width:0;min-height:46px;padding:8px 12px;margin:12px 0;border:2px dashed #4a9eff;border-radius:8px;color:#172b43;background:#e9f3ff;cursor:pointer;font:700 13px/1.35 system-ui;text-align:center;grid-column:1/-1;flex-basis:100%;} .sf-policy-place:hover{border-style:solid;background:#d6eaff;} .sf-policy-place:focus-visible{outline:3px solid #1749a3;outline-offset:2px;} .sf-policy-custom{min-height:36px;background:#f4f8ff;font-weight:500;}';
        doc.head.appendChild(style);
        // 同步生成模板 JS 后动态插入的本地图片，导航由父工作台解析原站路由。
        const config = { assetUrls, root, entryPath, token: options.token, placing: options.placing, page: options.page, showCustom: options.showCustom };
        const runtime = doc.createElement('script');
        runtime.textContent = '(' + installPreviewStorage.toString() + ')();(' + previewRuntime.toString() + ')(' + JSON.stringify(config).replace(/</g, '\\u003c') + ');';
        doc.head.insertBefore(runtime, doc.head.firstChild);
        return '<!doctype html>' + doc.documentElement.outerHTML;
    }
    return { build, dispose, resolveNavigation: resolvePreviewHtmlEntry };
}

/** Both uploaded pages and nested local games have opaque sandbox origins.
 * Storage is scoped to this preview only; real exported game files are untouched. */
function installPreviewStorage() {
    // 不透明源不能访问工作台存储。为主题等原站脚本提供本次预览独立的
    // 标准 Storage 方法，避免脚本在渲染卡片前因 SecurityError 中断。
    function installMemoryStorage(name) {
        try { void window[name]; return; } catch (_) { /* 仅在浏览器拒绝访问时替代。 */ }
        let values = Object.create(null);
        const storage = {
            get length() { return Object.keys(values).length; },
            key(index) { return Object.keys(values)[index] || null; },
            getItem(key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
            setItem(key, value) { values[String(key)] = String(value); },
            removeItem(key) { delete values[String(key)]; },
            clear() { values = Object.create(null); }
        };
        Object.defineProperty(window, name, { value: storage, configurable: true });
    }
    installMemoryStorage('localStorage');
    installMemoryStorage('sessionStorage');
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
            if (document.readyState === 'loading') return;
            if (!node.hasAttribute('data-sitefoundry-preview-sized')) {
                const bounds = node.getBoundingClientRect();
                const sourceStyle = getComputedStyle(node);
                // Preserve source-sized banners. Only empty unsized GPT slots
                // need a fallback rectangle to make their position visible.
                if (bounds.width < 1 && !(parseFloat(sourceStyle.width) > 0)) { node.style.width = '300px'; node.style.maxWidth = '100%'; }
                if (bounds.height < 1 && !(parseFloat(sourceStyle.height) > 0)) node.style.minHeight = '250px';
                node.setAttribute('data-sitefoundry-preview-sized', '');
            }
            if (!node.textContent) node.textContent = 'banner' + node.id.slice(-1) + ' · 广告预览';
        });
    }
    // 原站可通过 innerHTML 渲染卡片；观察新节点，覆盖属性 setter 无法捕获的图片。
    new MutationObserver(hydrate).observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('click', event => {
        const placement = event.target.closest('[data-policy-position]');
        if (placement && config.placing != null) {
            event.preventDefault(); event.stopPropagation();
            parent.postMessage({ type: 'ad-policy-place', token: config.token, page: config.page, position: placement.dataset.policyPosition }, '*');
            return;
        }
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
        if (config.placing == null || !config.showCustom) return;
        const main = document.querySelector('main') || document.body;
        function mark(parent, path, depth) {
            const children = kids(parent);
            children.forEach((child, index) => {
                const next = path.concat(index);
                if (depth < 2 && child.children.length && !/^(P|LI|A)$/.test(child.tagName)) mark(child, next, depth + 1);
                const button = document.createElement('button'); button.type = 'button'; button.className = 'sf-policy-place sf-policy-custom';
                button.textContent = '＋ 自定义广告位 · 内容区块 ' + next.map(value => value + 1).join('.') + ' 后';
                button.addEventListener('click', () => parentWindow('custom-after-' + next.join('-')));
                child.after(button);
            });
        }
        function parentWindow(position) { window.parent.postMessage({ type: 'ad-policy-place', token: config.token, page: config.page, position }, '*'); }
        mark(main, [], 0);
    });
}
